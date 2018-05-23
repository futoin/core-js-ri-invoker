'use strict';

module.exports = {
    mode: 'development',
    entry: {
        unittest : './es5/test/unittest.js',
        spectooltest : './es5/test/spectooltest.js',
        server_func : './es5/test/server_func.js',
    },
    output: {
        filename: "[name].js",
        path: __dirname + '/dist',
        libraryTarget: "umd",
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
        'futoin-invoker' : {
            root: "FutoInInvoker",
            amd: "futoin-invoker",
            commonjs: "futoin-invoker",
            commonjs2: "futoin-invoker",
        },
        cbor : {
            root: "cbor",
            amd: "cbor",
            commonjs: "cbor",
            commonjs2: "cbor",
        },
        borc : {
            root: "borc",
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
        chai : {
            root: "chai",
            amd: "chai",
            commonjs: "chai",
            commonjs2: "chai",
        },
        mocha : {
            root: "mocha",
            amd: "mocha",
            commonjs: "mocha",
            commonjs2: "mocha",
        },
    },
    node : false,
};
