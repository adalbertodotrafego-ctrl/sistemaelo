// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Sem isso o build usa "cloudflare-module" por padrão (formato de Cloudflare
  // Worker, sem servidor HTTP de verdade) — em produção rodamos com
  // `node .output/server/index.mjs` (Railway), que precisa de um servidor Node
  // real escutando em process.env.PORT. "node-server" é esse preset.
  nitro: { preset: "node-server" },
});
