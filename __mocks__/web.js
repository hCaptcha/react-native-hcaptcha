// Web test setup.
//
// Deliberately narrow: the only thing stubbed is the *network* fetch of hCaptcha's
// api.js and the widget API it installs on `window`. The component under test —
// Hcaptcha.web.js and everything it renders — runs for real, so these tests exercise
// the actual render path, loader wiring and event mapping.

const createHcaptchaMock = () => {
  const state = {
    // Controls what the loader does on the next call. `hang` models an api.js request
    // that never settles, which is what the loading timeout exists for.
    loader: { shouldFail: false, error: null, hang: false },
    lastLoaderConfig: null,
    loadCount: 0,
    // Recorded widget interactions.
    renderConfig: null,
    renderTarget: null,
    renderCount: 0,
    renderThrows: false,
    setDataCalls: [],
    executeCount: 0,
    resetCount: 0,
    removeCount: 0,
    widgetId: 'test-widget-id',
  };

  state.api = {
    render: (target, config) => {
      state.renderCount += 1;
      state.renderTarget = target;
      state.renderConfig = config;
      if (state.renderThrows) {
        const error = new Error('render failed');
        error.name = 'RenderError';
        throw error;
      }
      return state.widgetId;
    },
    setData: (widgetId, data) => {
      state.setDataCalls.push({ widgetId, data });
    },
    execute: () => {
      state.executeCount += 1;
    },
    reset: () => {
      state.resetCount += 1;
    },
    remove: () => {
      state.removeCount += 1;
    },
  };

  // Invokes one of the callbacks the component handed to `hcaptcha.render`.
  state.fire = (name, ...args) => {
    const handler = state.renderConfig && state.renderConfig[name];
    if (typeof handler !== 'function') {
      throw new Error(`No hCaptcha callback registered for "${name}"`);
    }
    return handler(...args);
  };

  return state;
};

global.__hcaptcha = createHcaptchaMock();

global.__resetHcaptchaMock = () => {
  global.__hcaptcha = createHcaptchaMock();
  delete global.hcaptcha;
};

jest.mock('@hcaptcha/loader', () => ({
  hCaptchaLoader: (config) => {
    const state = global.__hcaptcha;
    state.lastLoaderConfig = config;
    state.loadCount += 1;

    if (state.loader.hang) {
      return new Promise(() => {});
    }

    if (state.loader.shouldFail) {
      return Promise.reject(state.loader.error || new Error('script-error'));
    }

    // `global` is `window` under jsdom; a jest.mock factory may not close over `window`.
    global.hcaptcha = state.api;
    return Promise.resolve(global.hcaptcha);
  },
}));

jest.mock('../md5', () => () => 'mocked-md5');
