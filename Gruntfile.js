/* jshint ignore:start */

var fs = require('fs');

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
        bower: grunt.file.readJSON( 'bower.json' ),
                     
        jshint: {
            options: {
                jshintrc : true,
            },
            all: ['*.js', 'lib/**/*.js'],
        },
        jscs: {
            options : {
                config: ".jscsrc",
                fix: true,
            },
            all: ['*.js', 'lib/**/*.js'],
        },
        mocha_istanbul: {
            coverage: {
                src: ['test/spectooltest.js', 'test/unittest.js'],
            }
        },
        istanbul_check_coverage: {},
                     
        pure_cjs: {
            dist: {
                files: {
                    'dist/<%= pkg.name %>.js' : 'lib/browser.js'
                },
                options: {
                    map : true,
                    exports: 'FutoInInvoker',
                    external : {
                        'futoin-asyncsteps' : {
                            'global' : '$as',
                            'amd' : 'futoin-asyncsteps'
                        }
                    }
                }
            },
            distlite: {
                files: {
                    'dist/<%= pkg.name %>-lite.js' : 'lib/browser_lite.js'
                },
                options: {
                    map : true,
                    exports: 'FutoInInvoker',
                    external : {
                        'futoin-asyncsteps' : {
                            'global' : '$as',
                            'amd' : 'futoin-asyncsteps'
                        }
                    }
                }
            },
            unittest: {
                files: {
                    'dist/unittest.js' : 'test/unittest.js',
                    'dist/spectooltest.js' : 'test/spectooltest.js'
                },
                options: {
                    map : true,
                    exports: 'unittest',
                    external : {
                        'chai' : true,
                        'futoin-asyncsteps' : {
                            'global' : '$as',
                            'amd' : 'futoin-asyncsteps'
                        }
                    }
                }
            }
        },
        uglify: {
            dist: {
                files: {
                    'dist/futoin-invoker.min.js' : [ 'dist/futoin-invoker.js' ],
                    'dist/futoin-invoker-lite.min.js' : [ 'dist/futoin-invoker-lite.js' ]
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: 8000,
                    base: '.',
                    useAvailablePort: true
                }
            }
        },
        external_daemon: {
            unittest: {
                cmd:  'node',
                args: ['test/node_server.js'],
                options: {
                    startCheck: function(stdout, stderr) {
                        return /LISTENING/.test(stdout);
                    }
                }
            }
        },
        mocha_phantomjs: {
            all: {
                options: {
                    urls: [
                        'http://localhost:8000/test/unittest.html'
                    ]
                }
            }
        },
        jsdoc2md: {
            README: {
                src: [ '*.js', 'lib/**/*.js' ],
                dest: "README.md",
                options: {
                    template: fs.readFileSync('misc/README.hbs','utf8'),
}
            }
        },
        replace: {
            README: {
                src: "README.md",
                overwrite: true,
                replacements: [{
                    from: "$$pkg.version$$",
                    to: "<%= pkg.version %>"
                }]
            }
        }
    });
    
    grunt.loadNpmTasks( 'grunt-contrib-jshint' );
    grunt.loadNpmTasks( 'grunt-jscs' );
    grunt.loadNpmTasks( 'grunt-pure-cjs' );
    grunt.loadNpmTasks( 'grunt-contrib-uglify' );
    grunt.loadNpmTasks( 'grunt-contrib-connect' );
    grunt.loadNpmTasks( 'grunt-external-daemon' );
    grunt.loadNpmTasks( 'grunt-mocha-phantomjs' );
    grunt.loadNpmTasks( 'grunt-mocha-istanbul' );
    
    grunt.registerTask( 'check', [ 'jshint', 'jscs' ] );

    grunt.registerTask( 'build-browser', ['pure_cjs', 'uglify'] );
    grunt.registerTask( 'test-browser', ['connect','external_daemon:unittest','mocha_phantomjs'] );
    
    grunt.registerTask( 'node', [ 'connect', 'mocha_istanbul', 'mocha_istanbul:coverage' ] );
    grunt.registerTask( 'browser', ['build-browser','test-browser'] );
    grunt.registerTask( 'test', [ 'check', 'node', 'browser' ] );
    
    grunt.loadNpmTasks( 'grunt-jsdoc-to-markdown' );
    grunt.loadNpmTasks( 'grunt-text-replace' );
    grunt.registerTask( 'doc', [ 'jsdoc2md:README', 'replace:README' ] );

    grunt.registerTask( 'default', ['check'] );
};