'use strict';

module.exports = {
    entry: {
        'futoin-invoker': './lib/browser.js',
        'futoin-invoker-lite': './lib/browser_lite.js',
        unittest : './test/unittest.js',
        spectooltest : './test/spectooltest.js',
    },
    output: {
        filename: "[name].js",
        path: __dirname + '/dist',
    },
    node : false,
};
