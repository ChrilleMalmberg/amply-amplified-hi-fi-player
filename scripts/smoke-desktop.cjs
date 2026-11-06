// Tests the packaged/installed Windows application, not a development renderer.
const assert = require("node:assert/strict");
const path = require("node:path");
const { mkdtemp } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { _electron: electron } = require(process.env.AMPLY_PLAYWRIGHT_PATH || "playwright");

function wav() {
  const rate = 22050, bytes = rate * 20 * 2, data = Buffer.alloc(44 + bytes);
  data.write("RIFF"); data.writeUInt32LE(36 + bytes, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36);
  data.writeUInt32LE(bytes, 40);
  for (let i = 0; i < bytes / 2; i++) data.writeInt16LE(Math.round(Math.sin(i / rate * 440 * Math.PI * 2) * 1000), 44 + i * 2);
  return data;
}

(async () => {
  const executablePath = path.resolve(process.argv[2]);
  const profile = await mkdtemp(path.join(tmpdir(), "amply-smoke-profile-"));
  const app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 60000 });
  const errors = [];
  app.on("window", page => page.on("pageerror", error => errors.push(error.message)));
  try {
    const main = await app.firstWindow();
    main.on("pageerror", error => errors.push(error.message));
    await main.waitForFunction(() => {
      const img = document.querySelector(".wa-startup-logo");
      return img?.complete && img.naturalWidth > 0;
    });
    await main.getByRole("button", { name: "Skip startup", exact: true }).click();
    await main.locator(".wa-main").waitFor();
    assert.equal(new URL(main.url()).origin, "http://127.0.0.1:47823");
    let playlist;
    const deadline = Date.now() + 30000;
    while (!playlist && Date.now() < deadline) {
      for (const page of app.windows()) {
        const kind = await page.evaluate(() => window.amplyDesktop?.info().then(p => p.kind)).catch(() => null);
        if (kind === "pl") playlist = page;
      }
      if (!playlist) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(playlist, "Independent playlist window opened");
    await playlist.locator(".wa-pl input[type=file]").first().setInputFiles(["Bravo", "Alpha", "Charlie"].map(name => ({ name: name + ".wav", mimeType: "audio/wav", buffer: wav() })));
    await playlist.waitForFunction(() => document.querySelectorAll(".wa-pl-list > .wa-pl-row").length === 3 && [...document.querySelectorAll(".wa-pl-list > .wa-pl-row")].every(row => row.textContent.includes("0:20")));
    await playlist.locator(".wa-pl-list > .wa-pl-row").first().dblclick();
    await main.waitForFunction(() => document.querySelector(".wa-status")?.textContent === "▶");
    await playlist.getByRole("button", { name: "MISC", exact: true }).click();
    await playlist.getByRole("menuitem", { name: "Sort by title", exact: true }).click();
    await playlist.waitForFunction(() => document.querySelector(".wa-current")?.textContent.includes("2. Bravo"));
    await main.getByRole("button", { name: "Next", exact: true }).click();
    await playlist.waitForFunction(() => document.querySelector(".wa-current")?.textContent.includes("Charlie"));
    await playlist.locator(".wa-current").click();
    await playlist.keyboard.press("Delete");
    await main.waitForFunction(() => document.querySelector(".wa-status")?.textContent === "■");
    await main.locator(".wa-main").getByRole("button", { name: "Play", exact: true }).click();
    await playlist.waitForFunction(() => document.querySelector(".wa-current")?.textContent.includes("Alpha"));
    await main.context().setOffline(true);
    await main.getByRole("button", { name: "Next", exact: true }).click();
    await playlist.waitForFunction(() => document.querySelector(".wa-current")?.textContent.includes("Bravo"));
    await main.waitForFunction(() => {
      const text = document.querySelector(".wa-time")?.textContent || "";
      return text.includes("0:01") || text.includes("0:02");
    });
    assert.deepEqual(errors, []);
    console.log("Packaged Windows startup, artwork, native playlist commands and offline WAV playback passed.");
  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
