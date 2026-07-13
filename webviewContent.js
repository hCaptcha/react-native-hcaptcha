const HCAPTCHA_LOADER_URL = 'https://unpkg.com/@hcaptcha/loader@2.3.0/dist/index.es5.js';

const generateWebViewContent = ({
  loaderMessagePrefix,
  readyEvent,
  serializedConfig,
}) => `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <script type="text/javascript">
          // Make SDK metadata available to api.js before it loads.
          var hcaptchaConfig = ${serializedConfig};
          Object.entries(hcaptchaConfig.debugInfo || {}).forEach(function (entry) {
            window[entry[0]] = entry[1];
          });

          // Track loader attempts without changing @hcaptcha/loader itself.
          var apiLoadAttempts = 0;
          var apiLoadObserver = null;
          var loaderLifecycleComplete = false;
          var loaderLifecycleStartedAt = Date.now();

          var postLoaderEvent = function(event) {
            window.ReactNativeWebView.postMessage("${loaderMessagePrefix}" + JSON.stringify(event));
          };

          var getLoaderElapsed = function() {
            return Date.now() - loaderLifecycleStartedAt;
          };

          var stopObservingApiScripts = function() {
            if (apiLoadObserver) {
              apiLoadObserver.disconnect();
              apiLoadObserver = null;
            }
          };

          var finishLoaderLifecycle = function(type, details) {
            if (loaderLifecycleComplete) {
              return;
            }

            loaderLifecycleComplete = true;
            stopObservingApiScripts();
            postLoaderEvent(Object.assign({
              type: type,
              attempts: apiLoadAttempts,
              elapsedMs: getLoaderElapsed()
            }, details || {}));
          };

          var onLoaderSourceError = function() {
            finishLoaderLifecycle("load-failed", {
              reason: "loader-script-error"
            });
          };
        </script>
        <script type="text/javascript" src="${HCAPTCHA_LOADER_URL}" onerror="onLoaderSourceError()"></script>
        <script type="text/javascript">
          // Bridge React Native commands to the rendered hCaptcha widget.
          var hcaptchaWidgetId = null;

          var setData = function(data) {
            hcaptcha.setData(hcaptchaWidgetId, data || {});
          };

          var execute = function() {
            hcaptcha.execute(hcaptchaWidgetId);
          };

          var reset = function() {
            hcaptcha.reset(hcaptchaWidgetId);
          };

          // Render the widget after api.js becomes ready.
          var onloadCallback = function() {
            try {
              console.log("challenge onload starting");

              hcaptchaWidgetId = hcaptcha.render(
                "hcaptcha-container",
                getRenderConfig(hcaptchaConfig.siteKey, hcaptchaConfig.theme, hcaptchaConfig.size)
              );

              window.ReactNativeWebView.postMessage("${readyEvent}");

              // Render is synchronous; the widget can now receive verification data.
              console.log("challenge render complete");
            } catch (error) {
              console.log("challenge failed to render:", error);
              window.ReactNativeWebView.postMessage((error && error.name) || "error");
            }
          };

          // Forward widget lifecycle events and tokens to React Native.
          var onDataCallback = function(response) {
            window.ReactNativeWebView.postMessage(response);
          };

          var onCancel = function() {
            window.ReactNativeWebView.postMessage("challenge-closed");
          };

          var onOpen = function() {
            document.body.style.backgroundColor = hcaptchaConfig.backgroundColor;
            window.ReactNativeWebView.postMessage("open");
            console.log("challenge opened");
          };

          var onDataExpiredCallback = function(error) {
            window.ReactNativeWebView.postMessage(error);
          };

          var onChalExpiredCallback = function(error) {
            window.ReactNativeWebView.postMessage(error);
          };

          var onDataErrorCallback = function(error) {
            console.warn("challenge error callback fired");
            window.ReactNativeWebView.postMessage(error);
          };

          // Keep all widget callbacks in one render configuration object.
          var getRenderConfig = function(siteKey, theme, size) {
            var config = {
              sitekey: siteKey,
              size: size,
              callback: onDataCallback,
              "close-callback": onCancel,
              "open-callback": onOpen,
              "expired-callback": onDataExpiredCallback,
              "chalexpired-callback": onChalExpiredCallback,
              "error-callback": onDataErrorCallback
            };

            if (theme) {
              config.theme = theme;
            }

            return config;
          };

          // Observe every api.js script inserted by @hcaptcha/loader, including retries.
          var observeApiLoadAttempts = function(scriptSource) {
            if (typeof MutationObserver !== "function") {
              return;
            }

            apiLoadObserver = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                Array.prototype.forEach.call(mutation.addedNodes || [], function(node) {
                  if (
                    node
                    && node.tagName === "SCRIPT"
                    && typeof node.src === "string"
                    && node.src.indexOf(scriptSource) === 0
                  ) {
                    apiLoadAttempts += 1;
                    postLoaderEvent({
                      type: "load-started",
                      attempts: apiLoadAttempts,
                      elapsedMs: getLoaderElapsed()
                    });
                  }
                });
              });
            });

            apiLoadObserver.observe(document.head, { childList: true });
          };

          // Delegate loading and retries to the pinned @hcaptcha/loader bundle.
          var loadApiScript = function() {
            if (typeof window.hCaptchaLoader !== "function") {
              finishLoaderLifecycle("load-failed", {
                reason: "loader-unavailable"
              });
              window.ReactNativeWebView.postMessage("error");
              return;
            }

            var apiUrl = hcaptchaConfig.apiUrl.split("?");
            var scriptSource = apiUrl.shift();
            var query = apiUrl.join("?").split("&").filter(function(param) {
              return param.indexOf("onload=") !== 0;
            }).join("&");

            observeApiLoadAttempts(scriptSource);

            window.hCaptchaLoader({
              query: query,
              scriptSource: scriptSource,
              // RN owns loader diagnostics to include native device context.
              sentry: false
            }).then(function() {
              finishLoaderLifecycle("load-succeeded");
              onloadCallback();
            }).catch(function(error) {
              finishLoaderLifecycle("load-failed", {
                reason: "script-error"
              });
              window.ReactNativeWebView.postMessage((error && error.name) || "error");
            });
          };

          loadApiScript();
        </script>
      </head>
      <body>
        <div id="hcaptcha-container"></div>
      </body>
      </html>`;

export { generateWebViewContent };
