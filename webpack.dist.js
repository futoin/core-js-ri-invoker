'use strict';

const package_json = require( './package' );

module.exports = {
    mode: 'production',
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
        'futoin-asyncevent' : {
            root: "$asyncevent",
            amd: "futoin-asyncevent",
            commonjs: "futoin-asyncevent",
            commonjs2: "futoin-asyncevent",
        },
        cbor : {
            root: "cbor",
            amd: "cbor",
            commonjs: "cbor",
            commonjs2: "cbor",
        },
        borc : {
            root: "cbor",
            amd: "borc",
            commonjs: "borc",
            commonjs2: "borc",
        },
        'msgpack-lite' : {
            root: "msgpack",
            amd: "msgpack-lite",
            commonjs: "msgpack-lite",
            commonjs2: "msgpack-lite",
        },
    },
    node : false,
};
