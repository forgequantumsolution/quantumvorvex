import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Backend listens on PORT=5001 (5000 is taken by macOS AirPlay).
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      // Uploaded files (ID documents, logos) are served statically by the
      // backend at /uploads — proxy them so links resolve in dev.
      "/uploads": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
