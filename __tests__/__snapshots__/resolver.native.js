const path = require('path');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => path.join(
    path.dirname(testPath),
    '__snapshots__',
    path.basename(testPath) + '.native' + snapshotExtension
  ),

  resolveTestPath: (snapshotFilePath, snapshotExtension) => snapshotFilePath
    .replace(/__snapshots__[\\/]+/, '')
    .replace('.native' + snapshotExtension, ''),

  testPathForConsistencyCheck: 'some/example/path/component.test.js',
};
