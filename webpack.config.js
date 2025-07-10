const path = require('path');

module.exports = {
    entry: './index.web.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        alias: {
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
        ],
    },
};

