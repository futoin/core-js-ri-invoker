'use strict';

const UglifyJsPlugin = require( 'uglifyjs-webpack-plugin' );
const package_json = require( './package' );

module.exports = {
    entry: {
        'futoin-invoker': `./${package_json.browser}`,
        'futoin-invoker-lite': './es5/lib/browser_lite.js',
    },
    output: {
        library: {
            root: "FutoInInvoker",
            amd: "futoin-invoker",
            commonjs: "futoin-invoker",
        },
        libraryTarget: "umd",
        filename: "[name].js",
        path: __dirname + '/dist',
    },
    externals : {
        'futoin-asyncsteps' : {
            root: "$as",
            amd: "futoin-asyncsteps",
            commonjs: "futoin-asyncsteps",
            commonjs2: "futoin-asyncsteps",
        },
    },
    node : false,
    plugins: [
        new UglifyJsPlugin( {
            sourceMap: true,
        } ),
    ],
};
