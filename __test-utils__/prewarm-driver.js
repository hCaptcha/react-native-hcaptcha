/* eslint-env jest */
import React from 'react';
import vm from 'vm';
import { act, cleanup, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { getLastInjectJavaScriptMock, resetWebViewMockState } from 'react-native-webview';
import ConfirmHcaptcha from '../index';

// Use the published loader, replacing only the native transport and remote SDK boundary.
jest.unmock('@hcaptcha/loader/inline');

export class PrewarmDriver {
  constructor(passive, options = {}) {
    this.passive = passive;
    this.options = options;
    this.documents = [];
    this.attempts = [];
    this.calls = [];
    this.events = [];
    this.tokens = [];
    this.ref = React.createRef();
    this.props = { prewarm: true, passiveSiteKey: passive, siteKey: 'contract-site',
      baseUrl: 'https://contract.test', theme: 'light', rqdata: 'legacy-A', sentry: false };
    if (!options.legacyPayload) {
      this.props.verifyParams = { rqdata: 'legacy-A' };
    }
    if (options.cold) {
      this.props.prewarm = false;
    }
    resetWebViewMockState();
    this.component = render(this.element());
    this.refresh();
  }

  element() {
    return <ConfirmHcaptcha {...this.props} ref={this.ref} onMessage={(event) => {
      if (event.markUsed) {
        const id = this.attempts.findIndex((attempt) => attempt.token === event.nativeEvent.data);
        this.events.push({ kind: 'token', id });
        this.tokens.push(event);
        this.tokenExpires = Date.now() + 120000;
      } else if (event.nativeEvent.description === 'loading timeout') {
        this.events.push({ kind: 'timeout' });
      } else if (event.nativeEvent.data !== 'open') {
        this.events.push({ kind: event.nativeEvent.data });
      }
      this.lastEvent = event;
    }} />;
  }

  configure(props) {
    this.props = { ...this.props, ...props };
    this.passive = this.props.passiveSiteKey;
    this.component.rerender(this.element());
    this.refresh();
  }

  refresh() {
    const webView = this.component.UNSAFE_queryByType('WebView');
    if (!webView) {
      return;
    }
    if (webView === this.current?.webView) {
      this.current.receive = webView.props.onMessage;
      return;
    }
    const document = { webView, receive: webView.props.onMessage, scripts: [], data: {} };
    this.current = document;
    this.documents.push(document);
    const sandbox = {
      console: { log() {}, warn() {}, error() {} },
      document: { URL: 'https://contract.test', body: { style: {} },
        createElement: () => ({}), head: { appendChild: (script) => document.scripts.push(script) } },
      setTimeout, clearTimeout,
      ReactNativeWebView: { postMessage: (data) => {
        if (document.outbox) {
          document.outbox.push(data);
        } else {
          document.receive({ nativeEvent: { data } });
        }
      } },
    };
    sandbox.window = sandbox;
    sandbox.document.defaultView = sandbox;
    sandbox.document.head.ownerDocument = sandbox.document;
    document.context = vm.createContext(sandbox);
    const sdk = {
      render: (container, callbacks) => {
        document.callbacks = callbacks;
        return this.documents.indexOf(document);
      },
      setData: (id, data) => { document.data = JSON.parse(JSON.stringify(data)); },
      reset() {}, // Keep old outcomes deliverable to challenge cancellation ownership.
      execute: (id, options) => {
        const token = `contract-token-${this.attempts.length}-${'x'.repeat(40)}`;
        this.calls.push(document.data);
        const attempt = { document, token, callbacks: document.callbacks, done: false };
        this.attempts.push(attempt);
        document.callbacks['open-callback']();
        if (options?.async) {
          return new Promise((resolve, reject) => {
            attempt.resolve = resolve;
            attempt.reject = reject;
          });
        }
      },
    };
    document.sdk = sdk;
    getLastInjectJavaScriptMock().mockImplementation((source) => vm.runInContext(source, document.context));
    // Evaluate actual serialized config, actual published loader, and actual generated runtime.
    const scripts = [...webView.props.source.html.matchAll(/<script type="text\/javascript">([\s\S]*?)<\/script>/g)];
    act(() => {
      webView.props.onLoadStart();
      for (const script of scripts) {
        vm.runInContext(script[1], document.context);
      }
    });
  }

  async step(action) {
    await act(async () => {
      switch (action) {
        case 'execute': this.ref.current[this.options.showAlias ? 'show' : 'execute'](); break;
        case 'hide': this.ref.current.hide(); break;
        case 'ready':
          this.current.context.hcaptcha = this.current.sdk;
          this.current.scripts.at(-1).onload();
          this.current.context.hCaptchaOnLoad();
          break;
        case 'success':
        case 'error': {
          const attempt = this.attempts.find((entry) => !entry.done);
          if (!attempt) {
            throw new Error('SDK completion has no corresponding execute');
          }
          attempt.done = true;
          if (action === 'success') {
            if (attempt.resolve) {
              attempt.resolve({ response: attempt.token });
            } else {
              attempt.callbacks.callback(attempt.token);
            }
          } else if (attempt.reject) {
            attempt.reject('network-error');
          } else {
            attempt.callbacks['error-callback']('network-error');
          }
          break;
        }
        case 'edit':
          if (this.options.legacyPayload) {
            this.configure({ rqdata: this.props.rqdata === 'legacy-A' ? 'override-B' : 'legacy-A' });
          } else {
            this.configure({ verifyParams: { rqdata: this.props.verifyParams.rqdata === 'override-B' ? 'legacy-A' : 'override-B' } });
          }
          break;
        case 'replace':
          this.configure({ theme: this.props.theme === 'dark' ? 'light' : 'dark' });
          break;
        case 'crash':
          this.current.webView.props[this.passive ? 'onContentProcessDidTerminate' : 'onRenderProcessGone']();
          break;
        case 'timeout': jest.advanceTimersByTime(15000); break;
        case 'consume': this.tokens.at(-1).markUsed(); break;
        case 'expire': jest.advanceTimersByTime(Math.max(0, this.tokenExpires - Date.now())); break;
        default: throw new Error(`Unknown driver action: ${action}`);
      }
    });
    this.refresh();
  }

  snapshot() {
    let visible = null;
    if (!this.passive) {
      visible = this.props.prewarm
        ? this.component.getByTestId('confirm-hcaptcha-prewarm', { includeHiddenElements: true }).props.pointerEvents === 'auto'
        : Boolean(this.component.UNSAFE_queryByType(Modal));
    }
    return { documents: this.documents.length, visible, calls: this.calls, events: this.events };
  }

  async dispose() {
    await act(async () => { cleanup(); });
    jest.clearAllTimers();
    jest.clearAllMocks();
  }
}
