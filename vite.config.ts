import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/chat": {
        target: process.env.VITE_BASE_URL,
        changeOrigin: true,
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Connection", "keep-alive");
          });
        },
      },
      "/conversations": {
        target: process.env.VITE_BASE_URL,
        changeOrigin: true,
      },
      "/messages": {
        target: process.env.VITE_BASE_URL,
        changeOrigin: true,
      },
      "/files": {
        target: process.env.VITE_BASE_URL,
        changeOrigin: true,
      },
    },
  },
});
