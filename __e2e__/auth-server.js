// Disposable E2E backend. Uses only hCaptcha's public integration-test secret.
/* global AbortSignal */
const http = require('http');
const { Buffer } = require('buffer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { nativeMetrics, crashRenderer, backgroundApp } = require('./native-metrics');
const network = require('./network-proxy')();
const exec = promisify(execFile);
let proxyReady = process.env.HCAPTCHA_E2E_PLATFORM === 'ios';

const port = 8766;
const accounts = new Map();
let sdkLoads = 0;
let submissions = [];
let releaseSdk;
let sdkReady = 0;
let tokensIssued = 0;
let holdAuth = false;
let releaseAuth;
const profile = [];

http
  .createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === '/network-state') {
        res.end(JSON.stringify({ ...network.state, proxyReady }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/proxy-ready') {
        proxyReady = true;
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/network') {
        network.setOffline(url.searchParams.get('offline') === 'true');
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && ['/network-screenshot', '/example-screenshot'].includes(url.pathname)) {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const output = path.join(__dirname, '..', 'output');
        fs.mkdirSync(output, { recursive: true });
        let png = Buffer.concat(chunks);
        if (process.env.HCAPTCHA_E2E_PLATFORM === 'android') {
          // Software View snapshots can omit hardware-accelerated WebView canvases.
          const capture = await exec('adb', ['exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });
          png = capture.stdout;
        }
        const name = url.pathname === '/example-screenshot' ? 'example' : 'prewarm-network';
        const phase = name === 'example' && url.searchParams.get('phase') === 'token' ? '-token' : '';
        fs.writeFileSync(path.join(output, `${name}${phase}-${process.env.HCAPTCHA_E2E_PLATFORM}.png`), png);
        res.end('{}');
        return;
      }
      if (url.pathname.endsWith('/1/api.js')) {
        sdkLoads++;
        if (url.pathname === '/slow/1/api.js') {
          await new Promise((resolve) => {
            releaseSdk = resolve;
          });
        }
        if (['/measured/1/api.js', '/deferred/1/api.js'].includes(url.pathname)) {
          res.setHeader('Content-Type', 'application/javascript');
          // Observe readiness without replacing any real SDK behavior.
          res.end(`
            var callback = window.hCaptchaOnLoad;
            window.hCaptchaOnLoad = function() {
              var asyncExecution = false;
              if (${url.pathname === '/deferred/1/api.js'}) {
                var execute = window.hcaptcha.execute;
                window.hcaptcha.execute = function(widget, options) {
                  asyncExecution = Boolean(options && options.async);
                  var result = execute.apply(this, arguments);
                  if (!asyncExecution) { return result; }
                  return result.then(function(response) {
                    fetch('http://127.0.0.1:${port}/sdk-token', { method: 'POST' });
                    return new Promise(function(resolve) {
                      setTimeout(function() { resolve(response); }, 10000);
                    });
                  });
                };
              }
              var render = window.hcaptcha.render;
              window.hcaptcha.render = function() {
                if (${url.pathname === '/deferred/1/api.js'}) {
                  var options = arguments[1];
                  var tokenCallback = options.callback;
                  options.callback = function(token) {
                    if (asyncExecution) { tokenCallback(token); return; }
                    fetch('http://127.0.0.1:${port}/sdk-token', { method: 'POST' });
                    setTimeout(function() { tokenCallback(token); }, 10000);
                  };
                }
                var id = render.apply(this, arguments);
                fetch('http://127.0.0.1:${port}/sdk-ready', { method: 'POST' });
                return id;
              };
              callback();
            };
            var script = document.createElement('script');
            script.src = ${JSON.stringify(`https://js.hcaptcha.com/1/api.js${url.search}`)};
            document.head.appendChild(script);
          `);
          return;
        }
        const query = new URLSearchParams(url.searchParams);
        if (url.pathname.startsWith('/network/')) {
          query.set('network_case', url.pathname);
        }
        res.writeHead(302, { Location: `https://js.hcaptcha.com/1/api.js?${query}` });
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/state') {
        res.end(JSON.stringify({ sdkLoads, sdkReady, tokensIssued, submissions }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/reset') {
        network.setOffline(false);
        network.state.attempts = [];
        network.state.blocked = [];
        network.state.dropped = 0;
        releaseSdk?.();
        releaseSdk = undefined;
        sdkLoads = 0;
        sdkReady = 0;
        tokensIssued = 0;
        holdAuth = false;
        releaseAuth?.();
        releaseAuth = undefined;
        submissions = [];
        accounts.clear();
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/sdk-ready') {
        sdkReady++;
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/sdk-token') {
        tokensIssued++;
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/hold-auth') {
        holdAuth = true;
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/release-auth') {
        holdAuth = false;
        releaseAuth?.();
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/android-back' && process.env.HCAPTCHA_E2E_PLATFORM === 'android') {
        await exec('adb', ['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/crash-renderer') {
        await crashRenderer(process.env.HCAPTCHA_E2E_PLATFORM);
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/background') {
        await backgroundApp(process.env.HCAPTCHA_E2E_PLATFORM, Number(url.searchParams.get('ms') || 2500));
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/profile') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        const entry = JSON.parse(body);
        entry.native = await nativeMetrics(process.env.HCAPTCHA_E2E_PLATFORM);
        profile.push(entry);
        const output = path.join(__dirname, '..', 'output');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(
          path.join(output, `prewarm-perf-${process.env.HCAPTCHA_E2E_PLATFORM}.json`),
          JSON.stringify(profile, null, 2)
        );
        console.log('PROFILE', JSON.stringify(entry));
        res.end('{}');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/release-sdk') {
        releaseSdk?.();
        res.end('{}');
        return;
      }
      if (req.method !== 'POST' || !['/signup', '/login'].includes(url.pathname)) {
        res.writeHead(404);
        res.end('{}');
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const { email, password, token } = JSON.parse(body);
      const response = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        body: new URLSearchParams({
          secret: '0x0000000000000000000000000000000000000000',
          response: token,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const verification = await response.json();
      submissions.push({
        route: url.pathname,
        email,
        token,
        verified: verification.success,
      });
      if (!verification.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid captcha' }));
        return;
      }
      if (
        !email ||
        typeof password !== 'string' ||
        password.length < 8 ||
        (url.pathname === '/login' && accounts.get(email) !== password)
      ) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }
      if (url.pathname === '/signup') {
        accounts.set(email, password);
      }
      if (holdAuth) {
        await new Promise((resolve) => {
          releaseAuth = resolve;
        });
      }
      res.end(JSON.stringify({ email }));
    } catch (error) {
      console.error(error.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }
  })
  .on('connect', network.connect)
  .listen(port, '127.0.0.1', () => {
    console.log(`Auth E2E backend listening on ${port}`);
    process.send?.('ready');
  });
