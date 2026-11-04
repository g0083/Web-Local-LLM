import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),

    // process.env.HTTP_ONLY ? null : basicSsl(), 
    // basicSsl(), // Uncomment to enable HTTPS (useful for testing on mobile LAN, but causes Mixed Content errors with local HTTP servers)
    {
      name: 'block-spa-fallback-for-models',
      configureServer(server) {
        // Return a post-hook that runs AFTER internal middlewares (like static file serving)
        // but BEFORE the final 404/SPA fallback (conceptually, though Vite's history fallback is also a middleware)
        // actually, we just need to intercept it if it wasn't handled.
        return () => {
          server.middlewares.use((req, res, next) => {
            // If the request hasn't been handled by now (static files), and it's for a model file, force 404.
            if (req.originalUrl && (req.originalUrl.endsWith('.json') || req.originalUrl.endsWith('.onnx') || req.originalUrl.endsWith('.wasm'))) {
              res.statusCode = 404;
              res.end('Not Found');
              return;
            }
            next();
          });
        };
      }
    }
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // host: true is already handled by command line flag
  },
  // optimizeDeps: {
  //    // Don't exclude unless necessary. The user had a crash when I did this.
  // },
  appType: 'spa', // default
  build: {
    outDir: 'dist2',
    emptyOutDir: true, // This empties dist2, not dist
  }
})
