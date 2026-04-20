import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierDisable from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Ignores
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'functions/lib/**',
      'functions/node_modules/**',
      'functions/test-*.mjs',
      'functions/**/*.js',
      'functions/**/*.mjs',
      'node_modules/**',
      'public/**',
      'backup_13abr_18h50/**',
      'scripts/**/*.mjs',
      '**/*.config.js',
      '**/*.config.ts',
      'seed.ts',
    ],
  },

  // Base JS recommendations
  js.configs.recommended,

  // TypeScript recommendations (non type-checked to avoid slow CI)
  ...tseslint.configs.recommended,

  // Frontend: browser + React
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // A11y — warnings por enquanto; plano é elevar pra error quando corrigir o backlog
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',

      // React hooks — warnings enquanto há débito conhecido a limpar em fase 2.
      // rules-of-hooks permanece ERROR (é o que pega bug real de ordem).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',

      // preserve-caught-error é core ESLint — bom princípio, mas 17 pendências
      // no codebase; manter como warn até tratarmos com {cause} nos service errors
      'preserve-caught-error': 'warn',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Unused vars: allow _prefix convention, warn (maioria é debito leve)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // `any` como warning — high-friction no codebase atual
      '@typescript-eslint/no-explicit-any': 'warn',

      // Sem console.log em produção, mas warn/error ok
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Segurança: rules hard (nunca permitir)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },

  // Functions (Node backend)
  {
    files: ['functions/src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // pdfkit e alguns SDKs são CommonJS-first — `import x = require('...')` é legítimo
      '@typescript-eslint/no-require-imports': 'off',
      'preserve-caught-error': 'warn',
      'no-console': 'off', // Cloud Functions usam console.log pra structured logs
    },
  },

  // Tests
  {
    files: ['test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Permite `const _ = ...` como descarte explícito em testes
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // Scripts
  {
    files: ['scripts/**/*.{ts,mjs,js}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Prettier: desliga regras de formatação conflitantes
  prettierDisable,
);
