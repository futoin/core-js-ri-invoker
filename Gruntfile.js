'use strict';

var fs = require( 'fs' );

module.exports = function( grunt )
{
    grunt.initConfig( {
        pkg: grunt.file.readJSON( 'package.json' ),

        eslint: {
            options: { fix: true },
            target: [ '*.js', 'lib/**/*.js' ],
        },
        mocha_istanbul: { coverage: { src: [ 'test/spectooltest.js', 'test/unittest.js' ] } },
        istanbul_check_coverage: {},
        webpack: { test: require( './webpack.test' ) },
        connect: {
            server: {
                options: {
                    port: 8000,
                    base: '.',
                    useAvailablePort: true,
                },
            },
        },
        external_daemon: {
            unittest: {
                cmd:  'node',
                args: [ 'test/node_server.js' ],
                options: {
                    startCheck: function( stdout, stderr )
                    {
                        void stderr;
                        return ( /LISTENING/ ).test( stdout );
                    },
                },
            },
        },
        mocha_phantomjs: { all: { options: { urls: [ 'http://localhost:8000/test/unittest.html' ] } } },
        jsdoc2md: {
            README: {
                src: [ '*.js', 'lib/**/*.js' ],
                dest: "README.md",
                options: { template: fs.readFileSync( 'misc/README.hbs', 'utf8' ) },
            },
        },
        replace: {
            README: {
                src: "README.md",
                overwrite: true,
                replacements: [
                    {
                        from: "$$pkg.version$$",
                        to: "<%= pkg.version %>",
                    },
                ],
            },
        },
    } );

    grunt.loadNpmTasks( 'grunt-eslint' );
    grunt.loadNpmTasks( 'grunt-webpack' );
    grunt.loadNpmTasks( 'grunt-contrib-connect' );
    grunt.loadNpmTasks( 'grunt-external-daemon' );
    grunt.loadNpmTasks( 'grunt-mocha-phantomjs' );
    grunt.loadNpmTasks( 'grunt-mocha-istanbul' );

    grunt.registerTask( 'check', [ 'eslint' ] );

    grunt.registerTask( 'build-browser', [ 'webpack' ] );
    grunt.registerTask( 'test-browser', [ 'connect', 'external_daemon:unittest', 'mocha_phantomjs' ] );

    grunt.registerTask( 'node', [ 'connect', 'mocha_istanbul', 'mocha_istanbul:coverage' ] );
    grunt.registerTask( 'browser', [ 'build-browser', 'test-browser' ] );
    grunt.registerTask( 'test', [ 'check', 'node', 'browser', 'doc' ] );

    grunt.loadNpmTasks( 'grunt-jsdoc-to-markdown' );
    grunt.loadNpmTasks( 'grunt-text-replace' );
    grunt.registerTask( 'doc', [ 'jsdoc2md:README', 'replace:README' ] );

    grunt.registerTask( 'default', [ 'check' ] );
};
