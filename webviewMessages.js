const HCAPTCHA_READY_EVENT = '__hcaptcha_ready__';
const HCAPTCHA_LOADER_PREFIX = '__hcaptcha_loader__:';

const parseInternalWebViewMessage = (message) => {
  if (message === HCAPTCHA_READY_EVENT) {
    return { type: 'widget-ready' };
  }

  if (
    typeof message !== 'string'
    || !message.startsWith(HCAPTCHA_LOADER_PREFIX)
  ) {
    return null;
  }

  try {
    const loaderEvent = JSON.parse(
      message.slice(HCAPTCHA_LOADER_PREFIX.length)
    );

    if (
      !loaderEvent
      || typeof loaderEvent !== 'object'
      || typeof loaderEvent.type !== 'string'
    ) {
      return { type: 'invalid' };
    }

    return loaderEvent;
  } catch (_) {
    return { type: 'invalid' };
  }
};

export {
  HCAPTCHA_LOADER_PREFIX,
  HCAPTCHA_READY_EVENT,
  parseInternalWebViewMessage,
};
