import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ============================================================================
// ESLint Config — Fintech Strict Mode
// Per Phase 1 requirements: strict mode, no implicit any, no unused vars.
// ============================================================================
const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // TypeScript strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      
      // No console in production code (use proper logging in audit module)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // Security: no eval, no dynamic imports of user-controlled paths
      'no-eval': 'error',
      'no-implied-eval': 'error',
      
      // Code quality
      'no-var': 'error',
      'prefer-const': 'error',
      'no-floating-decimal': 'error',
      'eqeqeq': ['error', 'always'],
      
      // React safety
      'react/jsx-no-target-blank': 'error',
      'react/no-unescaped-entities': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default eslintConfig;
