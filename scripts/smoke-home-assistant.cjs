// Actual packaged Windows player + real HTTPS + real Web Audio, with generated WAVs.
// Uses a disposable profile, loopback allowlist and ephemeral pairing credentials only.
const assert = require('node:assert/strict');
const path = require('node:path');
const https = require('node:https');
const tls = require('node:tls');
const net = require('node:net');
const { readFile, mkdtemp, mkdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { X509Certificate } = require('node:crypto');
const { _electron: electron } = require(process.env.AMPLY_PLAYWRIGHT_PATH || 'playwright');

function wav() {
  const rate = 22050, bytes = rate * 20 * 2, data = Buffer.alloc(44 + bytes);
  data.write('RIFF'); data.writeUInt32LE(36 + bytes, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(bytes, 40);
  for (let i = 0; i < bytes / 2; i++) data.writeInt16LE(Math.round(Math.sin(i / rate * 440 * Math.PI * 2) * 1000), 44 + i * 2);
  return data;
}
async function until(fn, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw Error(message);
}
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function panel(app, kind) {
  let found;
  await until(async () => {
    for (const page of app.windows()) {
      if (await page.evaluate(() => window.amplyDesktop?.info()).then(p => p?.kind === kind).catch(() => false)) { found = page; return true; }
    }
    return false;
  }, `Native ${kind} panel did not open`);
  return found;
}

(async () => {
  const executablePath = path.resolve(process.argv[2]);
  const profile = await mkdtemp(path.join(tmpdir(), 'amply-ha-smoke-'));
  let app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 60000 });
  const errors = [];
  app.on('window', page => page.on('pageerror', e => errors.push(e.message)));
  try {
    let main = await app.firstWindow(); main.on('pageerror', e => errors.push(e.message));
    await main.getByRole('button', { name: 'Skip startup', exact: true }).click();
    const playlist = await panel(app, 'pl');
    await playlist.locator('.wa-pl input[type=file]').first().setInputFiles(['Alpha', 'Bravo'].map(name => ({ name: name + '.wav', mimeType: 'audio/wav', buffer: wav() })));
    await playlist.waitForFunction(() => document.querySelectorAll('.wa-pl-list > .wa-pl-row').length === 2 && [...document.querySelectorAll('.wa-pl-list > .wa-pl-row')].every(r => r.textContent.includes('0:20')));
    await playlist.locator('.wa-pl-list > .wa-pl-row').first().dblclick();
    await main.getByRole('button', { name: 'Options', exact: true }).click();
    await main.getByRole('menuitem', { name: 'Home Assistant connection…', exact: true }).click();
    const settings = await panel(app, 'connection');
    await settings.getByText('Disabled', { exact: true }).waitFor();
    const listenPort = await port();
    await settings.getByRole('textbox', { name: 'Home Assistant server IPv4 address', exact: true }).fill('127.0.0.1');
    await settings.getByRole('spinbutton', { name: 'Connection port', exact: true }).fill(String(listenPort));
    await settings.getByRole('button', { name: 'ENABLE CONNECTION', exact: true }).click();
    await settings.getByText('Enabled', { exact: true }).waitFor();
    await settings.getByRole('button', { name: 'SHOW PAIRING KEY', exact: true }).click();
    const pairingKey = await settings.getByRole('textbox', { name: 'Pairing key', exact: true }).inputValue();
    const fingerprint = await settings.getByRole('textbox', { name: 'Certificate fingerprint', exact: true }).inputValue();
    await settings.getByRole('button', { name: 'HIDE PAIRING KEY', exact: true }).click();
    const identityPath = path.join(profile, 'home-assistant-connection.json');
    let identity = JSON.parse(await readFile(identityPath, 'utf8'));
    assert.equal(new X509Certificate(identity.cert).fingerprint256.replaceAll(':', '').toLowerCase(), fingerprint);
    assert.equal(JSON.stringify(identity).includes(pairingKey), false);
    assert.equal(JSON.stringify(identity).includes('PRIVATE KEY'), false);
    function request(method = 'GET', body, key = pairingKey) {
      return new Promise((resolve, reject) => {
        const req = https.request({ hostname: '127.0.0.1', servername: 'amply.local', port: listenPort,
          path: method === 'GET' ? '/v1/state' : '/v1/command', method, ca: identity.cert,
          checkServerIdentity: (name, certificate) => {
            if (certificate.fingerprint256.replaceAll(':', '').toLowerCase() !== fingerprint) return Error('Pin mismatch');
            return tls.checkServerIdentity(name, certificate);
          }, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }, response => {
          let bytes = ''; response.on('data', chunk => bytes += chunk); response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(bytes) }));
        }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
      });
    }
    const state = async () => { const r = await request(); assert.equal(r.status, 200); return r.data; };
    const command = async (action, value) => {
      const r = await request('POST', { action, ...(value === undefined ? {} : { value }) });
      assert.equal(r.status, 200); assert.equal(r.data.accepted, true);
    };
    assert.equal((await request('GET', undefined, 'invalid')).status, 401);
    const id = (await state()).id;
    await until(async () => (await state()).position > 0, 'Real WAV playback did not advance');
    await command('pause'); await command('pause');
    await until(async () => (await state()).state === 'paused', 'Remote pause did not pause');
    await main.waitForFunction(() => document.querySelector('.wa-status')?.textContent === '❚❚');
    await command('volume_set', .31); await until(async () => (await state()).volume === .31, 'Volume did not update');
    await command('volume_mute', true); await until(async () => (await state()).muted, 'Mute did not update');
    await command('volume_mute', false);
    await command('seek', 3); await until(async () => Math.abs((await state()).position - 3) < .25, 'Seek did not update');
    await command('next'); await until(async () => (await state()).title.includes('Bravo'), 'Next did not reach the shared queue');
    await command('previous'); await until(async () => (await state()).title.includes('Alpha'), 'Previous did not reach the shared queue');
    await command('stop'); await until(async () => (await state()).state === 'idle', 'Stop did not update');
    await command('play'); await until(async () => (await state()).state === 'playing', 'Play did not update');
    await settings.getByRole('button', { name: 'REGENERATE PAIRING KEY', exact: true }).click();
    await until(async () => (await request()).status === 401, 'Old key was not invalidated');
    await settings.getByRole('button', { name: 'DISABLE CONNECTION', exact: true }).click();
    await settings.getByText('Disabled', { exact: true }).waitFor();
    await assert.rejects(request());
    await settings.getByRole('button', { name: 'ENABLE CONNECTION', exact: true }).click();
    await settings.getByText('Enabled', { exact: true }).waitFor();
    await settings.getByRole('button', { name: 'SHOW PAIRING KEY', exact: true }).click();
    const rotatedKey = await settings.getByRole('textbox', { name: 'Pairing key', exact: true }).inputValue();
    await settings.getByRole('button', { name: 'HIDE PAIRING KEY', exact: true }).click();
    assert.equal((await request('GET', undefined, rotatedKey)).status, 200);
    const evidence = process.env.AMPLY_BRIDGE_EVIDENCE;
    if (evidence) { await mkdir(evidence, { recursive: true }); await settings.screenshot({ path: path.join(evidence, 'connection-settings.png') }); }
    await app.close();
    app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 60000 });
    app.on('window', page => page.on('pageerror', e => errors.push(e.message)));
    main = await app.firstWindow(); main.on('pageerror', e => errors.push(e.message));
    await main.getByRole('button', { name: 'Skip startup', exact: true }).click();
    await until(async () => { const r = await request('GET', undefined, rotatedKey); return r.status === 200 && r.data.id === id; }, 'Pairing did not survive a Windows app restart');
    assert.deepEqual(errors, []);
    console.log('Packaged Windows encrypted pairing, DPAPI storage, actual WAV controls, key rotation, disable and restart passed.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
