import { captureExceptionMock, Scope, Sentry } from '@hcaptcha/sentry';

import { reportApiLoadFailure } from '../loaderSentry';

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

  it('reports a terminal api.js load failure with loader context', () => {
    reportApiLoadFailure({
      attempts: 3,
      jsSrc: 'https://js.hcaptcha.com/1/api.js',
      siteKey: '00000000-0000-0000-0000-000000000000',
    });

    const scope = Scope.mock.results[0].value;
    expect(Sentry).toHaveBeenCalledTimes(1);
    expect(scope.setTags).toHaveBeenCalledWith(expect.objectContaining({
      sdk: '@hcaptcha/react-native-hcaptcha',
      sdk_version: '4.0.0',
    }));
    expect(scope.setTag).toHaveBeenCalledWith(
      'sitekey',
      '00000000-0000-0000-0000-000000000000'
    );
    expect(scope.setContext).toHaveBeenCalledWith('api_loader', {
      attempts: 3,
      js_src: 'https://js.hcaptcha.com/1/api.js',
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hCaptcha api.js failed to load' }),
      scope
    );
  });
});
