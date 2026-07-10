import { Platform } from 'react-native';

import hcaptchaPackage from './package.json';

const SENTRY_DSN = 'https://d233059272824702afc8c43834c4912d@sentry.hcaptcha.com/6';

let loaderSentry;
let sentryModule;

const getSentryModule = () => {
  if (!sentryModule) {
    // Keep the reporting dependency dormant while the public sentry option is disabled.
    sentryModule = require('@hcaptcha/sentry');
  }

  return sentryModule;
};

const getLoaderSentry = () => {
  if (!loaderSentry) {
    const { Sentry } = getSentryModule();
    loaderSentry = new Sentry({
      dsn: SENTRY_DSN,
      environment: 'production',
      release: `react-native-hcaptcha@${hcaptchaPackage.version}`,
    });
  }

  return loaderSentry;
};

const reportApiLoadFailure = ({ attempts, jsSrc, siteKey }) => {
  try {
    const { Scope } = getSentryModule();
    const scope = new Scope();
    scope.setTags({
      platform: Platform.OS,
      sdk: '@hcaptcha/react-native-hcaptcha',
      sdk_version: hcaptchaPackage.version,
    });

    if (siteKey) {
      scope.setTag('sitekey', siteKey);
    }

    scope.setContext('api_loader', {
      attempts,
      js_src: jsSrc,
    });

    scope.setContext('react_native', {
      model: Platform.constants?.Model || Platform.constants?.model,
      os_version: Platform.Version,
      version: Platform.constants?.reactNativeVersion,
    });

    getLoaderSentry().captureException(
      new Error('hCaptcha api.js failed to load'),
      scope
    );
  } catch (_) {
    // Loader reporting must never interfere with the challenge flow.
  }
};

export { reportApiLoadFailure };
