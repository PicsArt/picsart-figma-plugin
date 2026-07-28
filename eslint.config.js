const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const figmaPlugin = require('@figma/eslint-plugin-figma-plugins')

module.exports = tseslint.config(
  eslint.configs.recommended,
  // @typescript-eslint/recommended-type-checked is too aggressive for
  // plugin code, so we stick with the non-type-checked recommended set.
  tseslint.configs.recommended,
  {
    languageOptions: {
      // The @figma/figma-plugins recommended set includes type-aware rules
      // (e.g. dynamic-page-find-method-advice), so the parser needs a TS
      // program. tsconfig.eslint.json covers all source dirs, not just the
      // narrow `include` in the build tsconfig.
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@figma/figma-plugins': figmaPlugin,
    },
    rules: {
      ...figmaPlugin.configs.recommended.rules,
      // allow underscore-prefixing of unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: ['dist', 'eslint.config.js', 'webpack.config.js'],
  },
)
