import {
  HCAPTCHA_LOADER_PREFIX,
  HCAPTCHA_READY_EVENT,
  parseInternalWebViewMessage,
} from '../webviewMessages';

describe('WebView internal messages', () => {
  it('classifies widget readiness', () => {
    expect(parseInternalWebViewMessage(HCAPTCHA_READY_EVENT)).toEqual({
      type: 'widget-ready',
    });
  });

  it('parses loader lifecycle events', () => {
    expect(parseInternalWebViewMessage(
      HCAPTCHA_LOADER_PREFIX + JSON.stringify({
        type: 'load-started',
        attempts: 1,
        elapsedMs: 25,
      })
    )).toEqual({
      type: 'load-started',
      attempts: 1,
      elapsedMs: 25,
    });
  });

  it('classifies malformed prefixed messages as invalid internals', () => {
    expect(parseInternalWebViewMessage(
      HCAPTCHA_LOADER_PREFIX + '{invalid-json'
    )).toEqual({ type: 'invalid' });
  });

  it('leaves challenge messages for the public handler', () => {
    expect(parseInternalWebViewMessage('open')).toBeNull();
    expect(parseInternalWebViewMessage('challenge-token')).toBeNull();
  });
});
