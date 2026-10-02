import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
const importRevision = JSON.parse(fs.readFileSync("public/vendor/manifest.json", "utf8")).revision as string;
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Semester OS",
        short_name: "Semester OS",
        description: "Your timetable, courses, attendance, and academic progress.",
        theme_color: "#0b0d11",
        background_color: "#0b0d11",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        globIgnores: ["vendor/**"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        importScripts: ["/sw-maintenance.js"],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === self.location.origin && /^\/vendor\/(ocr|pdf)\/[A-Za-z0-9.-]+$/.test(url.pathname),
          handler: "CacheFirst",
          options: { cacheName: `semester-import-${importRevision}`, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/pdfjs-dist/")) return "pdf-runtime";
          if (id.includes("/tesseract.js/") || id.includes("/zstddec/")) return "ocr-runtime";
          if (id.includes("/three/build/three.module.js"))
            return "three-renderer";
          if (id.includes("/three/")) return "three-runtime";
          if (
            [
              "/@react-three/",
              "/react-reconciler/",
              "/its-fine/",
              "/zustand/",
              "/suspend-react/",
            ].some((part) => id.includes(part))
          )
            return "space-runtime";
          if (id.includes("dexie") || id.includes("/zod/"))
            return "data-runtime";
          if (id.includes("motion")) return "motion-runtime";
          return "ui-runtime";
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
