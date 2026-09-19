const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'src/design-system/icons.generated.ts'] },
  {
    rules: {
      // Architecture guard-rails (see CLAUDE.md).
      'no-restricted-imports': ['error', { paths: [{ name: '@expo/vector-icons', message: 'Use <TechIcon /> from the design system.' }] }],
      'no-restricted-syntax': ['error', { selector: "Literal[value=/service_role/i]", message: 'The service role key must never appear in the mobile app.' }],
    },
  },
]);
