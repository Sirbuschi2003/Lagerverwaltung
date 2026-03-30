import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from 'node:url';

const appVersion = process.env.npm_package_version ?? "0.0.0";
const buildTimestamp = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest: Eigener SW wird genutzt, Workbox injiziert nur die Precache-Liste
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      // Wir registrieren den SW manuell in serviceWorkerRegistration.ts
      injectRegister: null,
      // Manifest liegt bereits als manifest.webmanifest in public/
      manifest: false,
      injectManifest: {
        // Alle Build-Artefakte für Precaching erfassen
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // Maximale Cache-Größe pro Datei: 5 MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        // Im Dev-Modus deaktiviert um HMR-Konflikte zu vermeiden
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React und Core Libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Material-UI separat
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material', 
            '@emotion/react',
            '@emotion/styled'
          ],
          
          // Zustand State Management
          'zustand-vendor': ['zustand'],
          
          // API und Utils
          'api-vendor': ['axios'],
          
          // Date Libraries
          'date-vendor': ['date-fns'],
          
          // Socket.io
          'socket-vendor': ['socket.io-client'],
          
          // Database
          'idb-vendor': ['idb'],
          
          // Workbox
          'workbox-vendor': ['workbox-background-sync', 'workbox-window'],
        },
        // Kleinere Chunks für besseres Caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          const name = facadeModuleId
            ? facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '') || 'chunk'
            : 'chunk';
          return `assets/${name}-[hash].js`;
        },
      },
    },
    // Größere Chunks erlauben für bessere Compression
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom', 
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      'zustand',
      'axios'
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@store': fileURLToPath(new URL('./src/store', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://192.168.3.113:3000",  // NAS IP
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // PWA Optimierungen
  define: {
    __BUILD_TIME__: JSON.stringify(buildTimestamp),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});


