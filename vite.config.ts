import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// base './' so Electron / static hosts can load relative assets.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    // Strip algorithm-visualizer phone-home (axios/opn require) at build time.
    'process.env.ALGORITHM_VISUALIZER': JSON.stringify('1'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  // Keep Tracer class names so Commander methods stay Array1DTracer/LogTracer/...
  esbuild: {
    keepNames: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    // prevent aggressive name mangling of the AV library chunk
    minify: 'esbuild',
  },
})
