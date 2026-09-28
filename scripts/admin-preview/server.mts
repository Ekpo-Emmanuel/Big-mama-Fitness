import { createServer } from "vite";
import path from "node:path";
const root = process.cwd();
const fixture = path.join(root, "scripts/admin-preview/fixtures.ts");
const navigation = path.join(root, "scripts/admin-preview/navigation.tsx");
const server = await createServer({
  configFile: false,
  optimizeDeps: { entries: ["scripts/admin-preview/entry.tsx"] },
  root,
  esbuild: { jsx: "automatic" },
  define: { "process.env.STRIPE_SECRET_KEY": '"test_fixture"' },
  resolve: {
    alias: [
      { find: /^next\/(link|navigation)$/, replacement: navigation },
      {
        find: /^@\/lib\/(admin|auth-server|auth-client|convex|db)$/,
        replacement: fixture,
      },
      { find: "@", replacement: root },
    ],
  },
  plugins: [
    {
      name: "isolated-admin-preview",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/(admin|login)(\/|\?|$)/.test(req.url))
            req.url = "/scripts/admin-preview/index.html";
          next();
        });
      },
    },
  ],
  server: {
    watch: { ignored: ["**/.next/**", "**/artifacts/**"] },
    host: "127.0.0.1",
    port: 3199,
    strictPort: true,
  },
});
await server.listen();
console.log("Isolated admin preview: http://127.0.0.1:3199/admin");
