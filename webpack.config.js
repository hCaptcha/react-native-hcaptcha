const path = require('path');

module.exports = {
    entry: './WebExample.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
        static: {
            directory: __dirname,
        },
        port: 8080,
    },
    resolve: {
        alias: {
            'react-native/Libraries/Core/ReactNativeVersion': path.resolve(__dirname, 'node_modules/react-native/Libraries/Core/ReactNativeVersion.js'),
            'react-native-animatable': path.resolve(__dirname, 'AnimatableStub.js'),
            'react-native-modal': path.resolve(__dirname, 'Modal.web.js'),
            'react-native': 'react-native-web',
            'react-native-webview': 'react-native-web-webview',
            '@hcaptcha/react-native-hcaptcha': __dirname,
        },
        extensions: ['.web.js', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.html$/,
                type: 'asset/source',
            },
        ],
    },
};

