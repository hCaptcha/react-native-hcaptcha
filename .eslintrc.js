module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // The react-native-web suite lives outside __tests__ so the native Jest project
      // does not pick it up; ESLint still needs the Jest globals here.
      files: ['**/__tests_web__/**/*.js'],
      env: {
        jest: true,
        'jest/globals': true,
      },
    },
  ],
};
