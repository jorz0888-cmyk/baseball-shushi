import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Each build gets a fresh BUILD_ID. main.jsx appends it to the SW
// registration URL (?v=<id>) so the browser fetches sw.js anew on
// every deploy — that's how the update banner gets a chance to fire.
const BUILD_ID = String(Date.now());

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    open: false,
  },
});
