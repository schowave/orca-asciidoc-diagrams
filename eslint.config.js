import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'editor/', 'vendor/', 'test-results/', 'playwright-report/', 'docs/', 'node_modules/'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.js'],
    rules: {
      // Orca's frame API and the engines loaded at runtime are untyped on purpose (see src/editor.ts).
      '@typescript-eslint/no-explicit-any': 'off',
      // 11 is today's highest value (renderMath); lower it when that function is split
      complexity: ['error', 11],
      'max-lines': ['error', 500],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        // object keys follow the data they describe (HTML attributes, CSS, JSON, node:test options)
        { selector: ['property', 'objectLiteralProperty', 'import'], format: null },
      ],
      // A skipped or focused test turns the check green while it tests less.
      'no-restricted-properties': [
        'error',
        { object: 'test', property: 'only', message: 'No focused tests.' },
        {
          object: 'test',
          property: 'skip',
          message: 'No skipped tests without removing this rule locally and a ticket.',
        },
        { object: 'describe', property: 'only', message: 'No focused tests.' },
        { object: 'describe', property: 'skip', message: 'No skipped tests.' },
      ],
    },
  },
)
