const path = require('path');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    // Store snapshots in __snapshots__/web/
    return path.join(
      path.dirname(testPath),
      '__snapshots__',
      'web',
      path.basename(testPath) + snapshotExtension
    );
  },

  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    // Reverse lookup: from snapshot to test file
    return snapshotFilePath
      .replace(/__snapshots__[\\/]+web[\\/]+/, '')
      .replace(snapshotExtension, '');
  },

  testPathForConsistencyCheck: 'some/example/path/component.test.js',
};
