const path = require('path');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    // Store snapshots in __snapshots__/ with .web suffix
    return path.join(
      path.dirname(testPath),
      '__snapshots__',
      path.basename(testPath) + '.web' + snapshotExtension
    );
  },

  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    // Reverse lookup: from snapshot to test file
    return snapshotFilePath
      .replace(/__snapshots__[\\/]+/, '')
      .replace('.web' + snapshotExtension, '');
  },

  testPathForConsistencyCheck: 'some/example/path/component.test.js',
};
