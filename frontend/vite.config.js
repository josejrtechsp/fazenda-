import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta pode ser sobrescrita via CLI (--port), mas deixamos padrão.
    port: 5173,
    strictPort: false,

    // Proxy local para evitar CORS no desenvolvimento.
    // Front chama /api/* (mesma origem) e o Vite encaminha para o backend :8001.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
