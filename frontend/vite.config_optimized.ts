import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
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
          
          // Scanner und spezielle Features
          'scanner-vendor': ['@zxing/library'],
        },
        // Kleinere Chunks für besseres Caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
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
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@store': resolve(__dirname, 'src/store'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  // Development Server Optimierungen
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
  // PWA Optimierungen
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});