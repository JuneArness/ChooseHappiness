import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // PGlite (the in-browser Postgres used only by preview mode) ships its own WebAssembly files.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
});
