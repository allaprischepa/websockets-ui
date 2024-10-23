import globals from 'globals';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsEslintParser from '@typescript-eslint/parser';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  eslintConfigPrettier,
  {
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      parser: tsEslintParser,
      globals: {
        ...globals.node,
        ...globals.jest,
      }
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'error',
    },
    files: ['**/*.ts'],
    ignores: ['dist', 'node_modules', 'front']
  }
];
