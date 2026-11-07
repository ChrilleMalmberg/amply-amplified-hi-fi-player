const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { HomeAssistantController, localAddress } = require('./home-assistant-controller.cjs');
const { createServer, commandFrom, snapshotFrom } = require('./home-assistant-server.cjs');

const key = randomBytes(32);
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString(value) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([c.update(value, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]); },
  decryptString(value) { const c = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); c.setAuthTag(value.subarray(12, 28)); return Buffer.concat([c.update(value.subarray(28)), c.final()]).toString('utf8'); },
};
const sample = () => ({ state: 'playing', title: 'Fixture song', track_id: '12', duration: 100, position: 12, volume: .6, muted: false, track_count: 2, ready: true });
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amply-bridge-test-'));
  const commands = [];
  const controller = new HomeAssistantController({ directory, encryption, version: '3.2.0-alpha.1', execute: async c => commands.push(c) });
  const port = await freePort();
  await controller.configure('enable', { allowedAddress: '127.0.0.1', port });
  controller.updateState(sample());
  const details = await controller.configure('pairing');
  t.after(async () => { await controller.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const request = (method = 'GET', url = '/v1/state', token = details.token, body, headers = {}) => new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', port, path: url, method, servername: 'amply.local', ca: controller.profile.cert,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
      let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  return { controller, details, commands, request, directory, port };
}

test('only explicit local IPv4 addresses are accepted', () => {
  for (const value of ['192.168.1.65', '10.2.3.4', '172.16.0.1', '100.100.1.2', '127.0.0.1']) assert.equal(localAddress(value), true);
  for (const value of ['0.0.0.0', '8.8.8.8', 'evil.invalid', 'https://192.168.1.1', '172.32.0.1', null, '::1']) assert.equal(localAddress(value), false);
});
test('command schema rejects arbitrary code, URLs, unexpected fields and invalid values', () => {
  for (const c of [null, [], { action: 'open', url: 'file:///secret' }, { action: 'play', value: 'extra' },
    { action: 'volume_set', value: 2 }, { action: 'volume_set', value: true }, { action: 'volume_mute', value: 1 },
    { action: 'seek', value: -1 }, { action: 'seek', value: NaN }, { action: 'next', file: 'secret' }]) assert.throws(() => commandFrom(c));
  assert.deepEqual(commandFrom({ action: 'pause' }), { action: 'pause' });
});
test('snapshot allowlist excludes files, tokens and unsupported fields', () => {
  const state = snapshotFrom({ ...sample(), path: '/secret/song.wav', token: 'secret', key: 'secret', ready: true });
  assert.deepEqual(state, sample());
  assert.equal(snapshotFrom({ state: 'fake' }), null);
  assert.equal(snapshotFrom({ ...sample(), volume: NaN }).volume, 0);
});
test('TLS endpoint requires the pairing key; state includes no credentials or files', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('GET', '/v1/state', '')).status, 401);
  assert.equal((await f.request('GET', '/v1/state', 'wrong')).status, 401);
  const response = await f.request();
  assert.equal(response.status, 200); assert.equal(response.data.protocol, 1); assert.equal(response.data.title, 'Fixture song');
  assert.equal(response.data.version, '3.2.0-alpha.1');
  for (const key of ['token', 'key', 'file', 'url', 'receivedAt', 'ready']) assert.equal(key in response.data, false);
  assert.match(f.details.fingerprint, /^[a-f0-9]{64}$/);
});
test('browser origins and other source IPs cannot control playback', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('POST', '/v1/command', f.details.token, { action: 'play' }, { Origin: 'https://untrusted.invalid' })).status, 403);
  const p = f.controller.profile;
  const other = createServer({ key: f.controller.decrypt(p.encryptedKey), cert: p.cert, token: f.details.token,
    allowedAddress: '127.0.0.2', identity: {}, getState: () => f.controller.state, execute: async () => assert.fail() });
  const address = await other.listen(0, '127.0.0.1'); t.after(() => other.close());
  const status = await new Promise((resolve, reject) => {
    https.get({ host: '127.0.0.1', port: address.port, servername: 'amply.local', ca: p.cert, headers: { Authorization: `Bearer ${f.details.token}` } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403); assert.equal(f.commands.length, 0);
});
test('commands cross the HTTPS boundary once and malformed requests do not execute', async t => {
  const f = await fixture(t);
  const commands = [{ action: 'play' }, { action: 'pause' }, { action: 'stop' }, { action: 'next' }, { action: 'previous' },
    { action: 'seek', value: 42 }, { action: 'volume_set', value: .23 }, { action: 'volume_mute', value: true }];
  for (const command of commands) assert.deepEqual((await f.request('POST', '/v1/command', f.details.token, command)).data, { accepted: true });
  assert.deepEqual(f.commands, commands);
  assert.equal((await f.request('POST', '/v1/command', f.details.token, { action: 'launch', file: 'evil.exe' })).status, 400);
  assert.equal((await f.request('GET', '/v1/command')).status, 405);
  assert.equal((await f.request('GET', '/files/music')).status, 404);
  assert.equal((await f.request('POST', '/v1/command', f.details.token, { action: 'play', junk: 'x'.repeat(1200) })).status, 413);
  assert.equal(f.commands.length, commands.length);
});
test('stale or starting renderer is unavailable rather than reporting stale playback', async t => {
  const f = await fixture(t);
  f.controller.state.receivedAt -= 6000;
  assert.equal((await f.request()).status, 503);
  f.controller.updateState({ ...sample(), ready: false }); assert.equal((await f.request()).status, 503);
  f.controller.invalidateState(); assert.equal((await f.request()).status, 503);
  assert.equal((await f.request('POST', '/v1/command', f.details.token, { action: 'play' })).status, 503);
});
test('key rotation invalidates old authorization while preserving desktop identity', async t => {
  const f = await fixture(t); const identity = f.controller.profile.id;
  await f.controller.configure('rotate');
  assert.equal((await f.request()).status, 401);
  const next = await f.controller.configure('pairing');
  assert.equal((await f.request('GET', '/v1/state', next.token)).status, 200);
  assert.equal(f.controller.profile.id, identity);
  const disk = fs.readFileSync(f.controller.file, 'utf8');
  assert.equal(disk.includes(next.token), false); assert.equal(disk.includes('PRIVATE KEY'), false);
  assert.equal('token' in f.controller.status(), false);
});
test('disable closes the listener; reconnect keeps the certificate and pairing key', async t => {
  const f = await fixture(t);
  await f.controller.configure('disable'); assert.equal(f.controller.status().enabled, false);
  await assert.rejects(f.request());
  await f.controller.configure('enable', { allowedAddress: '127.0.0.1', port: f.port });
  const next = await f.controller.configure('pairing');
  assert.equal(next.token, f.details.token); assert.equal(next.fingerprint, f.details.fingerprint);
  assert.equal((await f.request()).status, 200);
});
test('credential-protection failure never opens a network listener', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amply-storage-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const controller = new HomeAssistantController({ directory, encryption: { isEncryptionAvailable: () => false }, execute: async () => {}, version: 'test' });
  assert.equal(controller.status().enabled, false);
  await assert.rejects(controller.configure('enable', { allowedAddress: '127.0.0.1', port: 47824 }), /protection/);
  assert.equal(controller.bridge, null); assert.equal(fs.existsSync(controller.file), false);
});
