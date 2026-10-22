import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { packager } from "@electron/packager";

// Only runtime files enter the Windows application, never the working checkout.
const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const stage = await mkdtemp(path.join(tmpdir(), "amply-desktop-"));
try {
  await mkdir(path.join(stage, "electron"));
  await mkdir(path.join(stage, "dist-electron"));
  await cp(path.join(root, "dist-electron/client"), path.join(stage, "dist-electron/client"), { recursive: true });
  for (const file of ["main.cjs", "icon.ico"]) {
    await cp(path.join(root, "electron", file), path.join(stage, "electron", file));
  }
  const pointerPath = path.join(root, "src/assets/amply-official-startup.jpg.asset.json");
  const logo = JSON.parse(await readFile(pointerPath, "utf8"));
  const logoPath = path.join(stage, "dist-electron/client", logo.url.replace(/^\//, ""));
  await mkdir(path.dirname(logoPath), { recursive: true });
  execFileSync("lovable-assets", ["get", "--file", pointerPath, "--output", logoPath], { stdio: "inherit" });
  await writeFile(path.join(stage, "package.json"), JSON.stringify({
    name: "amply-hifi-player", version: config.version, main: "electron/main.cjs", description: "AmPly HiFi Player", author: "AmPly",
  }, null, 2));
  const paths = await packager({
    dir: stage, name: "Ampli Player", platform: "win32", arch: "x64",
    electronVersion: config.devDependencies.electron.replace(/^[^\d]+/, ""),
    appVersion: config.version, icon: path.join(stage, "electron/icon.ico"),
    out: path.join(tmpdir(), "amply-v3.0-release"), overwrite: true, prune: false,
    win32metadata: { ProductName: "AmPly HiFi Player", FileDescription: "AmPly HiFi Player V-3.0" },
  });
  console.log("Windows application packaged:", paths.join(", "));
} finally {
  await rm(stage, { recursive: true, force: true });
}