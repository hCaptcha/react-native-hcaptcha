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
  bridgeTimeout: Number(process.env.HARNESS_BRIDGE_TIMEOUT || 120000),
  // A backstop, not the mechanism: each case waits on the widget's own readiness signal and
  // returns as soon as it arrives, so a healthy run finishes well inside this.
  //
  // This has to live here rather than as Jest's `testTimeout`: the harness reads
  // `session.config.testTimeout` first and the schema defaults it to 5000, so it is never
  // undefined and a value in jest.harness.config.mjs is never consulted.
  testTimeout: Number(process.env.HARNESS_TEST_TIMEOUT || 120000),
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
