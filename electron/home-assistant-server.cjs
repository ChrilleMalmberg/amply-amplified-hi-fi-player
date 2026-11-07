// Small authenticated HTTPS endpoint; independent of Electron for protocol tests.
const https = require('node:https');
const { createHash, timingSafeEqual } = require('node:crypto');

const ACTIONS = new Set(['play', 'pause', 'stop', 'next', 'previous', 'seek', 'volume_set', 'volume_mute']);
function commandFrom(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !ACTIONS.has(body.action)) throw Error('Invalid command');
  const takesValue = ['seek', 'volume_set', 'volume_mute'].includes(body.action);
  if (Object.keys(body).some(key => key !== 'action' && !(takesValue && key === 'value'))) throw Error('Unexpected field');
  if (body.action === 'volume_mute' && typeof body.value !== 'boolean') throw Error('Invalid mute');
  if (body.action === 'seek' && (!Number.isFinite(body.value) || body.value < 0 || body.value > 864000)) throw Error('Invalid seek');
  if (body.action === 'volume_set' && (!Number.isFinite(body.value) || body.value < 0 || body.value > 1)) throw Error('Invalid volume');
  return takesValue ? { action: body.action, value: body.value } : { action: body.action };
}

function snapshotFrom(input) {
  if (!input || !['idle', 'playing', 'paused'].includes(input.state)) return null;
  const number = (v, limit) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= limit ? v : 0;
  return {
    state: input.state, title: typeof input.title === 'string' ? input.title.slice(0, 512) : '',
    track_id: typeof input.track_id === 'string' ? input.track_id.slice(0, 128) : '',
    position: number(input.position, 864000), duration: number(input.duration, 864000),
    volume: number(input.volume, 1), muted: input.muted === true,
    track_count: Math.floor(number(input.track_count, 1000000)), ready: input.ready === true,
  };
}

function createServer({ key, cert, token, allowedAddress, identity, getState, execute, now = Date.now }) {
  let secret = token;
  let stopped = false;
  const hash = value => createHash('sha256').update(value).digest();
  const respond = (res, status, value) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Connection': 'close' });
    res.end(JSON.stringify(value));
  };
  const server = https.createServer({ key, cert, minVersion: 'TLSv1.2' }, async (req, res) => {
    req.on('error', () => {});
    const address = req.socket.remoteAddress?.replace(/^::ffff:/, '');
    if (stopped || address !== allowedAddress || req.headers.origin !== undefined) { respond(res, 403, { error: 'forbidden' }); req.resume(); return; }
    const supplied = req.headers.authorization;
    if (typeof supplied !== 'string' || supplied.length > 256 || !timingSafeEqual(hash(supplied), hash(`Bearer ${secret}`))) {
      respond(res, 401, { error: 'unauthorized' }); req.resume(); return;
    }
    if (req.url !== '/v1/state' && req.url !== '/v1/command') { respond(res, 404, { error: 'not_found' }); req.resume(); return; }
    const state = getState();
    if (!state || !state.ready || now() - state.receivedAt > 5000) { respond(res, 503, { error: 'player_not_ready' }); req.resume(); return; }
    if (req.url === '/v1/state' && req.method === 'GET') {
      const { receivedAt, ready, ...publicState } = state;
      respond(res, 200, { protocol: 1, ...identity, ...publicState, updated_at: new Date(receivedAt).toISOString() }); return;
    }
    if (req.url !== '/v1/command' || req.method !== 'POST') { respond(res, 405, { error: 'method_not_allowed' }); req.resume(); return; }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) { respond(res, 415, { error: 'json_required' }); req.resume(); return; }
    if (Number(req.headers['content-length']) > 1024) { respond(res, 413, { error: 'too_large' }); req.resume(); return; }
    let raw = '', bytes = 0;
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 1024) { respond(res, 413, { error: 'too_large' }); return; }
        raw += chunk.toString('utf8');
      }
      let command;
      try { command = commandFrom(JSON.parse(raw)); } catch { respond(res, 400, { error: 'invalid_command' }); return; }
      await execute(command);
      respond(res, 200, { accepted: true });
    } catch { respond(res, 503, { error: 'player_command_failed' }); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 24;
  return {
    server,
    setToken(value) { secret = value; },
    listen(port, host = '0.0.0.0') { return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address()); });
    }); },
    close() { stopped = true; server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); },
  };
}
module.exports = { createServer, commandFrom, snapshotFrom };
