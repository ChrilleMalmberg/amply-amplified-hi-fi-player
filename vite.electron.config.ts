// Static single-page build for the Windows desktop app (Electron). Not used by the web preview.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ server: { entry: "server" }, spa: { enabled: true } }),
    viteReact(),
  ],
  build: { outDir: "dist-electron" },
});
