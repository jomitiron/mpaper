import js from '@eslint/js';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import prettier from 'eslint-config-prettier/flat';
import astro from 'eslint-plugin-astro';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

const unusedVars = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
    ignoreRestSiblings: true,
  },
];

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-e2e/**',
      'dist-appservice/**',
      // Git worktrees the build sessions use (git-ignored); each is a full copy of the repo.
      '.worktrees/**',
      '**/.astro/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/lighthouse-report/**',
      '**/.lighthouseci/**',
      'apps/web/public/mockServiceWorker.js',
      'design/**',
      'docs/**',
      'emails/**',
    ],
  },

  // TypeScript and Vue
  ...defineConfigWithVueTs(
    js.configs.recommended,
    pluginVue.configs['flat/recommended'],
    vueTsConfigs.recommended,
    {
      rules: {
        '@typescript-eslint/no-unused-vars': unusedVars,
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        'vue/multi-word-component-names': 'off',
        'vue/require-default-prop': 'off',
        'vue/no-v-html': 'error',
        eqeqeq: ['error', 'smart'],
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      },
    },
  ),

  // Astro (the marketing site)
  ...astro.configs.recommended,

  // Node scripts, config files, the App Service server and the Playwright suite
  {
    files: [
      '**/*.config.{js,mjs,ts}',
      '**/scripts/**/*.{js,mjs}',
      'apps/server/**/*.{js,mjs,ts}',
      'e2e/**/*.{js,mjs,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs,ts,vue}'],
    languageOptions: { globals: globals.browser },
  },

  // Leave formatting to Prettier.
  prettier,
];
