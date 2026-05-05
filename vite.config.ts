import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;

  return {
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    // Sourcemaps são uploadados pro Sentry e removidos do bundle servido,
    // mas precisam existir no build pra plugin processar.
    sourcemap: true,
    rollupOptions: {
      output: {
        // ── Manual chunk splitting: separa vendor, shared e feature modules ────
        // Alvo: app shell <400KB gzip, vendor chunks reutilizáveis, lazy features
        manualChunks(id: string) {
          // Vendor chunks (large, static dependencies)
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/react')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            // pdf.js worker já está em asset separado via pdfConverterLazy
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/zod')) {
            return 'vendor-zod';
          }

          // Feature modules (lazy-loaded per route)
          if (id.includes('src/features/educacao-continuada')) {
            return 'module-educacao';
          }
          if (id.includes('src/features/controle-temperatura')) {
            return 'module-ct';
          }
          if (id.includes('src/features/sgq')) {
            return 'module-sgq';
          }
          if (id.includes('src/features/bulaparser')) {
            return 'module-bulaparser';
          }

          // Shared services (low-churn, referenced by multiple modules)
          if (
            id.includes('src/shared/services/') ||
            id.includes('src/store/') ||
            id.includes('src/utils/')
          ) {
            return 'shared';
          }
        },
      },
    },
    // Aumenta limite de aviso de chunk size (muitos módulos no projeto)
    chunkSizeWarningLimit: 600,
  },
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
    // ── Bundle visualizer (só quando ANALYZE=true) ─────────────────────────
    // Gera dist/stats.html com treemap interativo do bundle. Nunca incluir
    // em build de produção normal — aumenta tempo de build e expõe estrutura.
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: false, // abrir via script npm run analyze
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
    // Upload de source maps + criação de release versionada no Sentry.
    // Sem auth token (CI sem secret, dev local) o plugin é no-op.
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: 'labclin',
            project: 'javascript-react',
            authToken: sentryAuthToken,
            release: { name: `hc-quality@${pkg.version}` },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
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
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'test/**/*.smoke.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/test/**', '**/__tests__/**'],
      thresholds: {
        // Funções puras têm testabilidade máxima — qualquer queda abaixo de
        // 80% indica que código novo não foi acompanhado de testes.
        // Smoke tests are excluded from coverage thresholds as they test
        // integration and external systems (Firebase, Pub/Sub, etc)
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
        // Don't fail on coverage for smoke tests
        autoReport: false,
      },
    },
  },
  };
});
