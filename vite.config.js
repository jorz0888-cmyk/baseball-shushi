import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel will set this automatically for prod builds; locally we serve from /.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: false,
  },
});
