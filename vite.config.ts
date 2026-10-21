import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// VITE_BASE lets the site run from a subfolder, e.g. "/ChooseHappiness/" on GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss()],
  // PGlite (the in-browser Postgres used only by preview mode) ships its own WebAssembly files.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
});
