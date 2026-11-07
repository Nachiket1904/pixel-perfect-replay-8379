// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Dev only: the browser talks to :8080 and Vite forwards /api to FastAPI, so auth cookies are
// first-party (same idea as src/lib/api-proxy.ts in production).
const apiOrigin = process.env["API_ORIGIN"] ?? "http://localhost:8000";

export default defineConfig({
  // nitro: { preset: "node-server" },
  // Vercel builds need the "vercel" preset; local/Codespaces builds keep node-server.
  nitro: {
    preset: process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : "node-server"),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // The Pyodide worker uses import() to load Python from the CDN, which needs a module worker.
    worker: { format: "es" },
    server: {
      proxy: {
        "/api": {
          target: apiOrigin,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              // Lets the API's CSRF Origin check see the host the browser actually used.
              if (req.headers.host) proxyReq.setHeader("x-forwarded-host", req.headers.host);
            });
          },
        },
      },
    },
  },
});
