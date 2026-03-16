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
