// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-ci/*', '.check-injected.js', 'ios/*', 'android/*', 'modules/*/ios/*'],
  },
  {
    // roda só no GitHub Actions, que instala o Playwright à parte (ver estacio-cloud.yml)
    files: ['scripts/estacio-cloud/**'],
    rules: { 'import/no-unresolved': ['error', { ignore: ['^playwright$'] }] },
  },
  {
    // Regras novas do React Compiler (react-hooks 7): o código é de antes delas. Ficam como aviso
    // para serem corrigidas aos poucos, tela por tela, sem travar o CI.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]);
