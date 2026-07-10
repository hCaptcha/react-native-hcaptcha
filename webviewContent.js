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
        </script>
        <script type="text/javascript">
          // api.js loader state is shared by retries and cancellation.
          var apiLoadAttempts = 0;
          var apiLoadCancelled = false;
          var apiLoadComplete = false;
          var apiLoadPromise = null;
          var apiLoadReject = null;
          var apiLoadResolve = null;
          var apiRetryTimerId = null;
          var apiScript = null;

          // Keep loader lifecycle messages internal to the React Native SDK.
          var postLoaderEvent = function(event) {
            window.ReactNativeWebView.postMessage("${loaderMessagePrefix}" + JSON.stringify(event));
          };

          // Remove failed or cancelled script elements from the document.
          var removeApiScript = function(script) {
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
          };

          // Load api.js once per attempt and retry network failures when allowed.
          var loadApiAttempt = function() {
            if (apiLoadCancelled || apiLoadComplete) {
              return;
            }

            apiLoadAttempts += 1;
            postLoaderEvent({
              type: "load-started",
              attempts: apiLoadAttempts
            });

            var script = document.createElement('script');
            apiScript = script;
            script.async = true;
            script.defer = true;
            script.src = hcaptchaConfig.apiUrl;
            script.onerror = function() {
              if (apiLoadCancelled || apiLoadComplete || script !== apiScript) {
                return;
              }

              removeApiScript(script);
              apiScript = null;

              if (apiLoadAttempts <= hcaptchaConfig.maxRetries) {
                apiRetryTimerId = setTimeout(loadApiAttempt, hcaptchaConfig.retryDelay);
                return;
              }

              var error = new Error('hCaptcha api.js failed to load');
              if (apiLoadReject) {
                apiLoadReject(error);
              }

              postLoaderEvent({
                type: "load-failed",
                attempts: apiLoadAttempts
              });
            };

            document.head.appendChild(script);
          };

          // Reuse one promise so repeated load calls cannot inject duplicate scripts.
          var loadApiScript = function() {
            if (apiLoadPromise) {
              return apiLoadPromise;
            }

            apiLoadPromise = new Promise(function(resolve, reject) {
              apiLoadResolve = resolve;
              apiLoadReject = reject;
              loadApiAttempt();
            });

            apiLoadPromise.catch(function() {});
            return apiLoadPromise;
          };

          // Stop the current request and prevent any scheduled retry from starting.
          var cancelApiLoad = function() {
            apiLoadCancelled = true;

            if (apiRetryTimerId !== null) {
              clearTimeout(apiRetryTimerId);
              apiRetryTimerId = null;
            }

            removeApiScript(apiScript);

            apiScript = null;
            if (apiLoadReject) {
              apiLoadReject(new Error('hCaptcha api.js load cancelled'));
            }
          };

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
            if (apiLoadCancelled || apiLoadComplete) {
              return;
            }

            apiLoadComplete = true;
            if (apiRetryTimerId !== null) {
              clearTimeout(apiRetryTimerId);
              apiRetryTimerId = null;
            }

            if (apiLoadResolve) {
              apiLoadResolve(window.hcaptcha);
            }

            try {
              console.log("challenge onload starting");

              hcaptchaWidgetId = hcaptcha.render(
                "hcaptcha-container",
                getRenderConfig(hcaptchaConfig.siteKey, hcaptchaConfig.theme, hcaptchaConfig.size)
              );

              window.ReactNativeWebView.postMessage("${readyEvent}");

              // have loaded by this point; render is sync.
              console.log("challenge render complete");
            } catch (e) {
              console.log("challenge failed to render:", e);
              window.ReactNativeWebView.postMessage(e.name);
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
          const getRenderConfig = function(siteKey, theme, size) {
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

          // Begin loading as soon as the WebView document is evaluated.
          loadApiScript();
        </script>
      </head>
      <body>
        <div id="hcaptcha-container"></div>
      </body>
      </html>`;

export { generateWebViewContent };
