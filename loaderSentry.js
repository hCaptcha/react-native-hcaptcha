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

const reportApiLoadIssue = ({
  attempts,
  elapsedMs,
  errorMessage,
  jsSrc,
  reason,
  siteKey,
}) => {
  try {
    const { Scope } = getSentryModule();
    const scope = new Scope();
    scope.setTags({
      api_loader_reason: reason,
      platform: Platform.OS,
      sdk: '@hcaptcha/react-native-hcaptcha',
      sdk_version: hcaptchaPackage.version,
    });

    if (siteKey) {
      scope.setTag('sitekey', siteKey);
    }

    const loaderContext = {
      attempts,
      js_src: jsSrc,
      reason,
    };

    if (typeof elapsedMs === 'number') {
      loaderContext.elapsed_ms = elapsedMs;
    }

    scope.setContext('api_loader', loaderContext);

    scope.setContext('react_native', {
      model: Platform.constants?.Model || Platform.constants?.model,
      os_version: Platform.Version,
      version: Platform.constants?.reactNativeVersion,
    });

    getLoaderSentry().captureException(
      new Error(errorMessage),
      scope
    );
  } catch (_) {
    // Loader reporting must never interfere with the challenge flow.
  }
};

const reportApiLoadFailure = ({ attempts, elapsedMs, jsSrc, siteKey }) => {
  reportApiLoadIssue({
    attempts,
    elapsedMs,
    errorMessage: 'hCaptcha api.js failed to load',
    jsSrc,
    reason: 'script-error',
    siteKey,
  });
};

const reportApiLoadTimeout = ({ attempts, elapsedMs, jsSrc, siteKey }) => {
  reportApiLoadIssue({
    attempts,
    elapsedMs,
    errorMessage: 'hCaptcha api.js loading timed out',
    jsSrc,
    reason: 'timeout',
    siteKey,
  });
};

export { reportApiLoadFailure, reportApiLoadTimeout };
