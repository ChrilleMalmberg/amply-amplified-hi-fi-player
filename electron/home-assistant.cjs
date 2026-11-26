// Local-only, opt-in control API. This does not serve files or accept media URLs.
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const PORT = 47824;
const COMMANDS = new Set(["play", "pause", "stop", "next", "previous", "volume", "seek", "shuffle", "repeat", "track"]);
function privateAddress(address = "") {
  const ip = address.replace(/^::ffff:/, "");
  if (ip === "::1" || ip === "127.0.0.1") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}
function validCommand(data) {
  if (!data || typeof data !== "object" || !COMMANDS.has(data.command) || Object.keys(data).some(k => !["command", "value"].includes(k))) return false;
  if (["volume", "seek", "track"].includes(data.command)) return typeof data.value === "number" && Number.isFinite(data.value) && data.value >= 0 && (data.command !== "volume" || data.value <= 1) && (data.command !== "track" || Number.isInteger(data.value));
  if (data.command === "shuffle") return typeof data.value === "boolean";
  if (data.command === "repeat") return ["off", "all", "track"].includes(data.value);
  return data.value === undefined;
}
function authorized(header, token) {
  if (typeof header !== "string" || !token) return false;
  const actual = Buffer.from(header), expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function cleanState(data) {
  if (!data || !["playing", "paused", "idle"].includes(data.state) || !Array.isArray(data.queue) || data.queue.length > 2000) return null;
  for (const key of ["volume", "position", "duration"]) if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || data[key] < 0) return null;
  if (data.volume > 1 || typeof data.shuffle !== "boolean" || !["off", "all", "track"].includes(data.repeat)) return null;
  if (!Number.isInteger(data.current) || data.current < -1 || data.current >= data.queue.length) return null;
  const queue = data.queue.map((title, index) => ({ index, title: typeof title === "string" ? title.slice(0, 300) : "Track" }));
  return { state: data.state, volume: data.volume, position: data.position, duration: data.duration, shuffle: data.shuffle, repeat: data.repeat, current: data.current, title: queue[data.current]?.title || "", queue };
}
function createController({ configPath, sendCommand, deviceId }) {
  let config = { enabled: false, token: "", device_id: crypto.randomUUID() }, server = null, snapshot = null, updated = 0, error = "";
  const pending = new Map();
  try { const value = JSON.parse(fs.readFileSync(configPath, "utf8")); if (typeof value.token === "string" && /^[a-f0-9]{64}$/.test(value.token)) config = { enabled: value.enabled === true, token: value.token, device_id: typeof value.device_id === "string" && /^[a-f0-9-]{36}$/.test(value.device_id) ? value.device_id : config.device_id }; } catch { /* off on first start */ }
  const save = () => { fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 }); };
  const status = () => ({ enabled: Boolean(server?.listening), token: config.token, port: PORT, error, addresses: Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal && privateAddress(i.address)).map(i => i.address) });
  function update(data) { const clean = cleanState(data); if (clean) { snapshot = clean; updated = Date.now(); } }
  function result(data) {
    const job = pending.get(data?.id); if (!job) return;
    pending.delete(data.id); clearTimeout(job.timer);
    if (data.ok === true) { update(data.state); job.resolve(); } else job.reject(new Error("Player action failed"));
  }
  function command(data) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Player unavailable")); }, 4000);
      pending.set(id, { resolve, reject, timer });
      try { sendCommand({ ...data, id }); } catch { clearTimeout(timer); pending.delete(id); reject(new Error("Player unavailable")); }
    });
  }
  const available = () => snapshot && Date.now() - updated < 8000;
  const reply = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(body)); };
  async function handler(req, res) {
    if (!privateAddress(req.socket.remoteAddress) || req.headers.origin || req.headers["sec-fetch-site"]) return reply(res, 403, { error: "Local service clients only" });
    if (!authorized(req.headers.authorization, config.token)) return reply(res, 401, { error: "Authentication required" });
    if (req.url === "/v1/state" && req.method === "GET") {
      if (!available()) return reply(res, 503, { error: "Open AmPly and finish startup" });
      return reply(res, 200, { ...snapshot, device_id: deviceId || config.device_id, name: "AmPly Windows", api_version: 1 });
    }
    if (req.url !== "/v1/command" || req.method !== "POST") return reply(res, 404, { error: "Not found" });
    if (!available()) return reply(res, 503, { error: "Player unavailable" });
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) return reply(res, 415, { error: "JSON required" });
    if (pending.size >= 16) return reply(res, 429, { error: "Too many commands" });
    try {
      let body = "";
      for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 2048) { reply(res, 413, { error: "Command too large" }); req.destroy(); return; } }
      const data = JSON.parse(body);
      if (!validCommand(data) || (data.command === "track" && data.value >= snapshot.queue.length) || (data.command === "seek" && data.value > snapshot.duration)) return reply(res, 400, { error: "Invalid command" });
      await command(data);
      return reply(res, 200, { ok: true });
    } catch (e) { return reply(res, e instanceof SyntaxError ? 400 : 503, { error: e instanceof SyntaxError ? "Invalid JSON" : "Player did not confirm command" }); }
  }
  async function enable() {
    if (server?.listening) return status();
    if (!config.token) config.token = crypto.randomBytes(32).toString("hex");
    error = "";
    const candidate = http.createServer((req, res) => { void handler(req, res); });
    candidate.requestTimeout = 5000; candidate.headersTimeout = 5000;
    try {
      await new Promise((resolve, reject) => { candidate.once("error", reject); candidate.listen(PORT, "0.0.0.0", resolve); });
      server = candidate; config.enabled = true; save();
    } catch { candidate.close(); server = null; config.enabled = false; error = "Could not open the controller port or save settings."; }
    return status();
  }
  async function disable() {
    config.enabled = false; error = "";
    for (const job of pending.values()) { clearTimeout(job.timer); job.reject(new Error("Controller disabled")); } pending.clear();
    const old = server; server = null; old?.closeAllConnections();
    if (old) await new Promise(resolve => old.close(resolve));
    try { save(); } catch { error = "Could not save settings; disable again before closing."; }
    return status();
  }
  async function rotate() {
    const oldToken = config.token;
    config.token = crypto.randomBytes(32).toString("hex");
    try { save(); error = ""; } catch { config.token = oldToken; error = "Could not save the new pairing key."; }
    return status();
  }
  return { status, update, result, enable, disable, rotate, start: () => config.enabled ? enable() : Promise.resolve(status()) };
}
module.exports = { createController, validCommand, cleanState, privateAddress, PORT };