import { configure } from 'reassure';

// Use environment variables for CI optimization
const runs = process.env.REASSURE_RUNS ? parseInt(process.env.REASSURE_RUNS, 10) : 10;
const warmupRuns = process.env.REASSURE_WARMUP_RUNS ? parseInt(process.env.REASSURE_WARMUP_RUNS, 10) : 2;

configure({
  testingLibrary: 'react-native',
  runs,
  warmupRuns,
  outputFile: '.reassure/current.perf',
  verbose: !process.env.REASSURE_SILENT, // Use silent mode if REASSURE_SILENT is set
  testMatch: ['**/*.perf-test.[jt]s?(x)'],
});
