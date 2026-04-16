import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    port: 3000,
    strictPort: true, // Garante que a porta 3000 será usada (falha em vez de pular para 3001)
    host: '0.0.0.0',  // Ouve conexões externas na rede local (ex.: celular via IP-do-Wifi)
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
        branches:   75,
        functions:  80,
        lines:      80,
      },
    },
  },
});