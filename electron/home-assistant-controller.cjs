const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomBytes, randomUUID, X509Certificate } = require('node:crypto');
const { createServer, snapshotFrom } = require('./home-assistant-server.cjs');

const DEFAULT_PORT = 47824;
function localAddress(value) {
  if (typeof value !== 'string' || net.isIP(value) !== 4) return false;
  const p = value.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168)
    || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
function certificate() {
  const forge = require('node-forge');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + randomBytes(15).toString('hex');
  cert.validity.notBefore = new Date(Date.now() - 60000);
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 86400000);
  cert.setSubject([{ name: 'commonName', value: 'AmPly Home Assistant' }]);
  cert.setIssuer(cert.subject.attributes);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true }, { name: 'subjectAltName', altNames: [{ type: 2, value: 'amply.local' }] }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { key: forge.pki.privateKeyToPem(keys.privateKey), cert: forge.pki.certificateToPem(cert) };
}

class HomeAssistantController {
  constructor({ directory, encryption, execute, version, makeCertificate = certificate }) {
    this.file = path.join(directory, 'home-assistant-connection.json');
    this.encryption = encryption; this.execute = execute; this.version = version;
    this.makeCertificate = makeCertificate; this.profile = null; this.bridge = null;
    this.state = null; this.error = ''; this.task = Promise.resolve();
    try {
      const p = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof p.id !== 'string' || !/^[a-f0-9-]{36}$/.test(p.id) || !localAddress(p.allowedAddress)
        || !Number.isInteger(p.port) || p.port < 1024 || p.port > 65535
        || typeof p.encryptedToken !== 'string' || typeof p.encryptedKey !== 'string' || typeof p.cert !== 'string') throw Error();
      new X509Certificate(p.cert);
      this.profile = p;
    } catch (error) { if (error.code !== 'ENOENT') this.error = 'Saved connection settings could not be read. Enable again to create new pairing details.'; }
  }
  secureStorage() {
    if (!this.encryption.isEncryptionAvailable() || this.encryption.getSelectedStorageBackend?.() === 'basic_text') {
      throw Error('Windows credential protection is unavailable. The connection remains disabled.');
    }
  }
  encrypt(value) { this.secureStorage(); return this.encryption.encryptString(value).toString('base64'); }
  decrypt(value) { this.secureStorage(); return this.encryption.decryptString(Buffer.from(value, 'base64')); }
  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.profile), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
  }
  status() {
    let interfaces = {};
    try { interfaces = os.networkInterfaces(); } catch { /* Restricted hosts can still display and disable connection settings. */ }
    const addresses = [...new Set(Object.values(interfaces).flat().filter(x => x && x.family === 'IPv4' && !x.internal && localAddress(x.address)).map(x => x.address))];
    return { enabled: !!this.bridge, allowedAddress: this.profile?.allowedAddress || '', port: this.profile?.port || DEFAULT_PORT,
      addresses, fingerprint: this.profile ? new X509Certificate(this.profile.cert).fingerprint256.replaceAll(':', '').toLowerCase() : '', error: this.error };
  }
  updateState(input) {
    const state = snapshotFrom(input);
    if (state) this.state = { ...state, receivedAt: Date.now() };
  }
  invalidateState() { this.state = null; }
  async start() {
    if (!this.profile?.enabled) return;
    try { await this.open(); } catch { this.error = 'The saved Home Assistant connection could not start. Check its port or enable it again.'; }
  }
  async open() {
    const p = this.profile;
    const token = this.decrypt(p.encryptedToken);
    const key = this.decrypt(p.encryptedKey);
    const bridge = createServer({ key, cert: p.cert, token, allowedAddress: p.allowedAddress,
      identity: { id: p.id, name: `AmPly on ${os.hostname()}`.slice(0, 128), version: this.version },
      getState: () => this.state, execute: this.execute });
    try { await bridge.listen(p.port); this.bridge = bridge; }
    catch (error) { await bridge.close(); throw error; }
  }
  configure(action, options = {}) {
    const task = this.task.then(() => this.configureNow(action, options));
    this.task = task.catch(() => {});
    return task;
  }
  async configureNow(action, options) {
    if (action === 'status') return this.status();
    if (action === 'pairing') {
      if (!this.bridge) throw Error('Enable the connection first.');
      return { ...this.status(), token: this.decrypt(this.profile.encryptedToken) };
    }
    if (action === 'disable') {
      if (this.profile) { this.profile.enabled = false; this.persist(); }
      const bridge = this.bridge; this.bridge = null;
      if (bridge) await bridge.close();
      return this.status();
    }
    if (action === 'rotate') {
      if (!this.bridge) throw Error('Enable the connection first.');
      const token = randomBytes(32).toString('base64url');
      this.profile.encryptedToken = this.encrypt(token); this.persist(); this.bridge.setToken(token);
      return this.status();
    }
    if (action !== 'enable') throw Error('Unknown connection action.');
    if (!localAddress(options.allowedAddress)) throw Error('Enter your Home Assistant server’s local IPv4 address.');
    const port = options.port ?? DEFAULT_PORT;
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Choose a port between 1024 and 65535.');
    this.secureStorage();
    await this.configureNow('disable', {});
    if (!this.profile) {
      const identity = this.makeCertificate();
      this.profile = { id: randomUUID(), cert: identity.cert, encryptedKey: this.encrypt(identity.key),
        encryptedToken: this.encrypt(randomBytes(32).toString('base64url')) };
    }
    Object.assign(this.profile, { allowedAddress: options.allowedAddress, port, enabled: false });
    this.persist();
    try { await this.open(); this.profile.enabled = true; this.persist(); this.error = ''; }
    catch { if (this.bridge) { await this.bridge.close(); this.bridge = null; } throw Error('Could not listen on that port. Choose a different port and try again.'); }
    return this.status();
  }
  async close() { const bridge = this.bridge; this.bridge = null; if (bridge) await bridge.close(); }
}
module.exports = { HomeAssistantController, localAddress, DEFAULT_PORT };
