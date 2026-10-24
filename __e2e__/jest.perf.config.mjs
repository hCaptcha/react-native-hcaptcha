export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/__e2e__/**/*.profile.js'],
  testPathIgnorePatterns: ['/prewarmNetwork.profile.js$'],
  maxWorkers: 1,
};
