import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@firebase/") || id.includes("/firebase/")) return "vendor-firebase";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router")) {
            return "vendor-react";
          }
          if (id.includes("/@tauri-apps/")) return "vendor-tauri";
          if (
            id.includes("/react-markdown/") ||
            id.includes("/remark-") ||
            id.includes("/rehype-") ||
            id.includes("/highlight.js/") ||
            id.includes("/micromark") ||
            id.includes("/unified/") ||
            id.includes("/vfile/") ||
            id.includes("/mdast-") ||
            id.includes("/hast-") ||
            id.includes("/unist-")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("/framer-motion/") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) {
            return "vendor-motion";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri owns the Rust sources — its own watcher handles rebuilds.
      ignored: ["**/src-tauri/**"],
    },
  },
}));
