import { Platform } from 'react-native';
import ReactNativeVersion from './reactNativeVersion';

import md5 from './md5';
import hcaptchaPackage from './package.json';

export const HCAPTCHA_READY_EVENT = '__hcaptcha_ready__';

/**
 * Token responses are always longer than this; anything shorter that arrives on the
 * message channel is an event name or an error code.
 */
export const TOKEN_MIN_LENGTH = 35;

export const TOKEN_TIMEOUT = 120000;

export const LOADING_TIMEOUT = 15000;

export const serializeForInlineScript = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const normalizeTheme = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  }

  return value;
};

export const normalizeSize = (value) => {
  if (value == null) {
    return 'invisible';
  }

  return value === 'checkbox' ? 'normal' : value;
};

const getVersionPart = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100
    ? value
    : null
);

const parseReactNativeVersion = (value) => {
  const candidate = value && typeof value === 'object' && value.version ? value.version : value;
  const major = getVersionPart(candidate?.major);
  const minor = getVersionPart(candidate?.minor);
  const patch = getVersionPart(candidate?.patch);

  if (major == null || minor == null || patch == null) {
    return null;
  }

  return { major, minor, patch };
};

export const getReactNativeVersion = (value = Platform?.constants?.reactNativeVersion) =>
  parseReactNativeVersion(value) || parseReactNativeVersion(ReactNativeVersion?.version);

export const buildDebugInfo = (debug, reactNativeVersion = Platform?.constants?.reactNativeVersion) => {
  const result = { ...(debug || {}) };

  try {
    const version = getReactNativeVersion(reactNativeVersion);
    if (version) {
      result[`rnver_${version.major}_${version.minor}_${version.patch}`] = true;
    }
    result['dep_' + md5(Object.keys(global).join(''))] = true;
    result['sdk_' + hcaptchaPackage.version.toString().replace(/\./g, '_')] = true;
  } catch (e) {
    console.log(e);
  }

  return result;
};

export const buildVerifyData = ({
  phoneNumber,
  phonePrefix,
  rqdata,
  userJourney,
  verifyParams,
}) => {
  const normalizedVerifyParams = verifyParams || {};
  const data = {};
  const finalRqdata = normalizedVerifyParams.rqdata ?? rqdata ?? undefined;
  const finalPhonePrefix = normalizedVerifyParams.phonePrefix ?? phonePrefix ?? undefined;
  const finalPhoneNumber = normalizedVerifyParams.phoneNumber ?? phoneNumber ?? undefined;

  if (finalRqdata) {
    data.rqdata = finalRqdata;
  }
  if (finalPhonePrefix) {
    data.mfa_phoneprefix = finalPhonePrefix;
  }
  if (finalPhoneNumber) {
    data.mfa_phone = finalPhoneNumber;
  }
  if (Array.isArray(userJourney) && userJourney.length > 0) {
    data.userjourney = userJourney;
  }

  return data;
};

export const getHcaptchaHost = (host, siteKey) => {
  if (host) {
    return host;
  } else if (siteKey) {
    return `${siteKey}.react-native.hcaptcha.com`;
  } else {
    return 'missing-sitekey.react-native.hcaptcha.com';
  }
};

export function buildHcaptchaLoaderConfig({
  scriptSource,
  siteKey,
  hl,
  theme,
  host,
  sentry,
  endpoint,
  assethost,
  imghost,
  reportapi,
}) {
  return {
    scriptSource: scriptSource || 'https://hcaptcha.com/1/api.js',
    render: 'explicit',
    host: getHcaptchaHost(host, siteKey),
    hl,
    // `typeof null === 'object'`, so an absent theme must be excluded explicitly —
    // otherwise the loader is told to expect a custom theme that never arrives.
    custom: typeof theme === 'object' && theme !== null,
    sentry,
    endpoint,
    assethost,
    imghost,
    reportapi,
  };
}

/**
 * Render config passed to `hcaptcha.render`. Shared so the web widget and the
 * WebView-hosted widget stay configured identically.
 */
export function buildRenderConfig({ siteKey, theme, size, orientation, callbacks }) {
  const config = {
    sitekey: siteKey,
    size,
    callback: callbacks.onData,
    'close-callback': callbacks.onCancel,
    'open-callback': callbacks.onOpen,
    'expired-callback': callbacks.onDataExpired,
    'chalexpired-callback': callbacks.onChalExpired,
    'error-callback': callbacks.onDataError,
  };

  if (theme) {
    config.theme = theme;
  }
  if (orientation) {
    config.orientation = orientation;
  }

  return config;
}
