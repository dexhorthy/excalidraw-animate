import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import fs from "fs";
import path from "path";

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? "/excalidraw-animate/" : "/",
  server: {
    port: 5174,
  },
  plugins: [
    react(),
    {
      name: 'file-loader',
      configureServer(server) {
        server.middlewares.use('/api/load-file', (req, res) => {
          const url = new URL(req.url || '', `http://localhost`);
          const filePath = url.searchParams.get('path');
          
          if (!filePath) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No path provided' }));
            return;
          }

          try {
            const absolutePath = path.resolve(filePath);
            if (fs.existsSync(absolutePath)) {
              const content = fs.readFileSync(absolutePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(content);
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
            }
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      }
    }
  ],
  build: {
    outDir: "build",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setupTests.ts"],
    exclude: [...configDefaults.exclude],
    deps: {
      interopDefault: true,
    },
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
  },
});
