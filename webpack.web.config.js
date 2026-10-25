const path = require('path');

/**
 * Dev-server config for the browser example (`npm run web`).
 *
 * Note how short the alias list is: `react-native` -> `react-native-web` is the only
 * mapping needed. There is no WebView shim, no Modal stub and no animation stub —
 * react-native-web provides Modal, SafeAreaView and the rest, and the web build of the
 * component renders hCaptcha directly instead of hosting it in a WebView.
 */
module.exports = {
  entry: './Example.Web.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  devServer: {
    static: { directory: __dirname },
    port: 8080,
    hot: true,
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
    },
    extensions: ['.web.js', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        // react-native-web ships compiled code, but other react-native packages in
        // node_modules may not, so only this package's own sources are excluded from
        // the default ignore.
        exclude: /node_modules[/\\](?!react-native-web)/,
        use: { loader: 'babel-loader' },
      },
    ],
  },
};
