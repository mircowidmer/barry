const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', 'supabase/functions/*'],
  },
  {
    // The rules that need types read tsconfig.json, which leaves out the sketch under docs/.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['docs/**'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
]);
