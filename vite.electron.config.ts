// Static single-page build for the Windows desktop app (Electron). Not used by the web preview.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    viteReact(),
  ],
  build: {
    outDir: "dist-electron/client",
    emptyOutDir: true,
    rolldownOptions: { input: fileURLToPath(new URL("./desktop.html", import.meta.url)) },
  },
});
