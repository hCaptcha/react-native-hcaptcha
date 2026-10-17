import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android';
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';

const config = {
  entryPoint: './index.js',
  appRegistryComponentName: 'react_native_hcaptcha_example',

  disableViewFlattening: true,
  bridgeTimeout: 120000,
  // A backstop, not the mechanism: each case waits on the widget's own readiness signal and
  // returns as soon as it arrives, so a healthy run finishes well inside this. The budget it
  // has to cover is mount (10s) + readiness (20s) + paint settle (5s), and it only trips for
  // failures below the SDK, since the SDK reports its own 15s loading timeout first.
  //
  // This has to live here rather than as Jest's `testTimeout`: the harness reads
  // `session.config.testTimeout` first and the schema defaults it to 5000, so it is never
  // undefined and a value in jest.harness.config.mjs is never consulted.
  testTimeout: 60000,
  forwardClientLogs: true,

  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator(process.env.HARNESS_AVD_NAME || 'test'),
      bundleId: 'com.react_native_hcaptcha_example',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator(
        process.env.HARNESS_IOS_DEVICE || 'iPhone 16',
        process.env.HARNESS_IOS_VERSION || '18.5',
      ),
      bundleId: 'org.reactjs.native.example.react-native-hcaptcha-example',
    }),
  ],

  defaultRunner: 'android',
};

export default config;
