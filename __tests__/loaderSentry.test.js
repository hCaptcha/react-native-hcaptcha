import { captureExceptionMock, Scope, Sentry } from '@hcaptcha/sentry';

import {
  reportApiLoadFailure,
  reportApiLoadTimeout,
} from '../loaderSentry';

jest.mock('@hcaptcha/sentry', () => {
  const captureException = jest.fn();

  return {
    captureExceptionMock: captureException,
    Scope: jest.fn(() => ({
      setContext: jest.fn(),
      setTag: jest.fn(),
      setTags: jest.fn(),
    })),
    Sentry: jest.fn(() => ({
      captureException,
    })),
  };
});

describe('loader Sentry reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports terminal loader failures with native context', () => {
    reportApiLoadFailure({
      attempts: 3,
      elapsedMs: 2500,
      jsSrc: 'https://js.hcaptcha.com/1/api.js',
      reason: 'loader-script-error',
      siteKey: '00000000-0000-0000-0000-000000000000',
    });

    const scope = Scope.mock.results[0].value;
    expect(Sentry).toHaveBeenCalledTimes(1);
    expect(scope.setTags).toHaveBeenCalledWith(expect.objectContaining({
      api_loader_reason: 'loader-script-error',
      sdk: '@hcaptcha/react-native-hcaptcha',
      sdk_version: '4.0.0',
    }));
    expect(scope.setTag).toHaveBeenCalledWith(
      'sitekey',
      '00000000-0000-0000-0000-000000000000'
    );
    expect(scope.setContext).toHaveBeenCalledWith('api_loader', {
      attempts: 3,
      elapsed_ms: 2500,
      js_src: 'https://js.hcaptcha.com/1/api.js',
      reason: 'loader-script-error',
    });
    expect(scope.setContext).toHaveBeenCalledWith('react_native', expect.objectContaining({
      version: expect.anything(),
    }));
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hCaptcha loader failed to load api.js' }),
      scope
    );
  });

  it('reports api.js loading timeouts with elapsed time', () => {
    reportApiLoadTimeout({
      attempts: 1,
      elapsedMs: 15000,
      jsSrc: 'https://js.hcaptcha.com/1/api.js',
      siteKey: '00000000-0000-0000-0000-000000000000',
    });

    const scope = Scope.mock.results[0].value;
    expect(scope.setTags).toHaveBeenCalledWith(expect.objectContaining({
      api_loader_reason: 'timeout',
    }));
    expect(scope.setContext).toHaveBeenCalledWith('api_loader', {
      attempts: 1,
      elapsed_ms: 15000,
      js_src: 'https://js.hcaptcha.com/1/api.js',
      reason: 'timeout',
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hCaptcha api.js loading timed out' }),
      scope
    );
  });
});
