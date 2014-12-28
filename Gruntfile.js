module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
        bower: grunt.file.readJSON( 'bower.json' ),
                     
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
                        },
                        'lodash' : {
                            'global' : '_',
                            'amd' : 'lodash'
                        }
                    }
                }
            },
            unittest: {
                files: {
                    'dist/unittest.js' : 'test/unittest.js'
                },
                options: {
                    map : true,
                    exports: 'unittest',
                    external : {
                        'chai' : true,
                        'futoin-asyncsteps' : {
                            'global' : '$as',
                            'amd' : 'futoin-asyncsteps'
                        },
                        'lodash' : {
                            'global' : '_',
                            'amd' : 'lodash'
                        }
                    }
                }
            }
        },
        uglify: {
            dist: {
                files: {
                    'dist/futoin-invoker.min.js' : [ 'dist/futoin-invoker.js' ]
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: 8000,
                    base: '.',
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
        npm: {
            test: {
                args: ["test"]
            }
        },
        release: {
            options: {
                additionalFiles: [
                    'bower.json'
                ],
                commitFiles: [
                    'package.json',
                    'bower.json'
                ],
                tagName: "v<%= version %>",
                commitMessage: 'Updated for release v<%= version %>',
                tagMessage: 'Release v<%= version %>',
                npm: false
            }
        },
        sync: {
            all: {
                options: {
                    sync: ['name', 'version','description','license','keywords','homepage','repository'],
                    from: 'package.json',
                    to: 'bower.json'
                }
            }
        }
    });
    
    grunt.loadNpmTasks( 'grunt-pure-cjs' );
    grunt.loadNpmTasks( 'grunt-contrib-uglify' );
    grunt.loadNpmTasks( 'grunt-contrib-connect' );
    grunt.loadNpmTasks( 'grunt-mocha-phantomjs' );
    grunt.loadNpmTasks( 'grunt-npm-helper' );
    grunt.loadNpmTasks( 'grunt-release' );
    grunt.loadNpmTasks( 'grunt-npm2bower-sync' );

    grunt.registerTask( 'build-browser', ['pure_cjs','uglify'] );
    grunt.registerTask( 'test-browser', ['connect','mocha_phantomjs'] );
    
    grunt.registerTask( 'node', [ 'npm:test' ] );
    grunt.registerTask( 'browser', ['build-browser','test-browser'] );

    grunt.registerTask( 'default', ['sync','node','browser'] );
};