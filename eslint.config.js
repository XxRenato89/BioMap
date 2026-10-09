import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier';

/**
 * Configuración compartida de ESLint para todo el monorepo.
 * El backend usa globales de Node; el frontend, globales de navegador y JSX.
 * eslint-config-prettier va al final para desactivar reglas de formato.
 */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.superpowers/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['apps/web/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime'],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off',
    },
  },
  {
    /*
     * Los scripts del visor corren en Node (generan datos de la maqueta).
     */
    files: ['apps/web/scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    /*
     * En la maqueta 3D, los elementos JSX son objetos de three.js
     * (react-three-fiber): `position`, `castShadow`, etc. son válidos.
     */
    files: ['apps/web/src/diorama/**/*.jsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
  prettier,
];
