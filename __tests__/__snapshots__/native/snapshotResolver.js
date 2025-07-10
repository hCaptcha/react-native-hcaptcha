const path = require('path');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    // Store snapshots in __snapshots__/native/
    return path.join(
      path.dirname(testPath),
      '__snapshots__',
      'native',
      path.basename(testPath) + snapshotExtension
    );
  },

  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    // Reverse lookup: from snapshot to test file
    return snapshotFilePath
      .replace(/__snapshots__[\\/]+native[\\/]+/, '')
      .replace(snapshotExtension, '');
  },

  testPathForConsistencyCheck: 'some/example/path/component.test.js',
};
