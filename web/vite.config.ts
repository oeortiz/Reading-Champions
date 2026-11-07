import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dentro de Docker el servidor es el servicio "server"; fuera, localhost
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3000" },
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === "true" },
  },
});
