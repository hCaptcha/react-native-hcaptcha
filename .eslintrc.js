module.exports = {
  root: true,
  extends: '@react-native',
  // `eslint .` only skips node_modules and dotfiles on its own, so generated output that is
  // merely gitignored still gets linted - a local `dist/` bundle alone reports 57k problems and
  // fails the pre-commit hook. Keep this in sync with the artifact entries in .gitignore.
  ignorePatterns: ['dist/', 'coverage/'],
};
