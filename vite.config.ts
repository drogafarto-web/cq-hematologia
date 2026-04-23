import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // ── PWA ────────────────────────────────────────────────────────────────
    // Instalável em desktop (Chrome/Edge) e mobile (Android/iOS).
    // Service worker gerado automaticamente via Workbox com auto-update
    // em cada deploy — o usuário vê prompt "nova versão disponível".
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'assets/labclin-logo.png',
      ],
      manifest: {
        name: 'HC Quality — Controle de Qualidade Laboratorial',
        short_name: 'CQ Labclin',
        description:
          'Sistema de controle interno de qualidade para laboratórios clínicos — Hematologia, Imunologia, Coagulação e Uroanálise.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#3b82f6',
        background_color: '#0d0d0d',
        categories: ['medical', 'productivity', 'business'],
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Arquivos a precachear — shell do app. Firestore/Storage runtime
        // ficam por conta do Firebase SDK (IndexedDB).
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2}'],
        // Limite generoso pra chunks do React + Firebase (~3MB típico)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Não cachear chamadas de Cloud Functions nem Firestore REST — esses
        // devem sempre ir até o servidor (ou falhar pra trigger offline do SDK).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/, /^\/cloudfunctions/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Liga o SW em dev pra facilitar teste local (vite dev → http://localhost:3000)
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
    strictPort: true, // Garante que a porta 3000 será usada (falha em vez de pular para 3001)
    host: '0.0.0.0', // Ouve conexões externas na rede local (ex.: celular via IP-do-Wifi)
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/test/**'],
      thresholds: {
        // Funções puras têm testabilidade máxima — qualquer queda abaixo de
        // 80% indica que código novo não foi acompanhado de testes.
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
