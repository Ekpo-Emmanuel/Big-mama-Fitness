import { createServer } from "vite";
import path from "node:path";
const root = process.cwd();
const server = await createServer({
  configFile: false,
  root,
  esbuild: { jsx: "automatic" },
  optimizeDeps: { entries: ["scripts/motion-preview/entry.tsx"] },
  define: { "process.env.STRIPE_SECRET_KEY": '"test_fixture"' },
  resolve: {
    alias: [
      {
        find: /^next\/(link|navigation)$/,
        replacement: path.join(root, "scripts/admin-preview/navigation.tsx"),
      },
      {
        find: "next/image",
        replacement: path.join(root, "scripts/motion-preview/image.tsx"),
      },
      {
        find: /^@\/lib\/(admin|auth-server|auth-client|convex|db)$/,
        replacement: path.join(root, "scripts/admin-preview/fixtures.ts"),
      },
      { find: "@", replacement: root },
    ],
  },
  plugins: [
    {
      name: "isolated-motion-preview",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/(motion|admin|login|event)(\/|\?|$)/.test(req.url))
            req.url = "/scripts/motion-preview/index.html";
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 3201,
    strictPort: true,
    watch: { ignored: ["**/.next/**", "**/artifacts/**"] },
  },
});
await server.listen();
console.log("Isolated motion QA: http://127.0.0.1:3201/motion");
