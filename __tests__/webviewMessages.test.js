import {
  HCAPTCHA_LOADER_PREFIX,
  HCAPTCHA_READY_EVENT,
  parseInternalWebViewMessage,
} from '../webviewMessages';

describe('WebView internal messages', () => {
  it('classifies api.js readiness', () => {
    expect(parseInternalWebViewMessage(HCAPTCHA_READY_EVENT)).toEqual({
      type: 'api-ready',
    });
  });

  it('parses loader events', () => {
    expect(parseInternalWebViewMessage(
      HCAPTCHA_LOADER_PREFIX + JSON.stringify({
        type: 'load-failed',
        attempts: 3,
      })
    )).toEqual({
      type: 'load-failed',
      attempts: 3,
    });
  });

  it('classifies malformed prefixed messages as invalid internals', () => {
    expect(parseInternalWebViewMessage(
      HCAPTCHA_LOADER_PREFIX + '{invalid-json'
    )).toEqual({ type: 'invalid' });
  });

  it('leaves challenge messages for the normal handler', () => {
    expect(parseInternalWebViewMessage('open')).toBeNull();
    expect(parseInternalWebViewMessage('challenge-token')).toBeNull();
  });
});
