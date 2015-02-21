'use strict';

var _extend = require( 'lodash/object/extend' );
var native_iface = require( './native_iface' );
var common = require( './common' );
var async_steps = require( 'futoin-asyncsteps' );

var btoa = ( typeof window !== 'undefined' ) ? window.btoa : // jshint ignore:line
function( str )
{
    return new Buffer( str ).toString( 'base64' );
};

/**
 * AuditLog Native interface
 *
 * Register with LogFace.register()
 * NOTE: it is not directly available Invoker module interface
 * @class
 * @alias LogFace
 */
function LogFace()
{
    _extend( this, LogFaceProto );
    native_iface.NativeIface.apply( this, arguments );
}

/**
 * AuditLog Native interface registration helper
 * @alias LogFace.register
 */
LogFace.register = function( as, ccm, endpoint, credentials, options )
{
    var iface = LogFace.ifacespec;

    options = options || {};
    options.nativeImpl = this;
    options.specDirs = [ iface ];

    ccm.register(
            as,
            common.Options.SVC_LOG,
            iface.iface + ':' + iface.version,
            endpoint,
            credentials,
            options
    );
};

/**
 * LogFace prototype
 * @ignore
 */
var LogFaceProto = {
    /**
     * Debug log level
     * @const
     * @alias LogFace.LVL_DEBUG
     */
    LVL_DEBUG : 'debug',

    /**
     * Info log level
     * @const
     * @alias LogFace.LVL_INFO
     */
    LVL_INFO : 'info',

    /**
     * Warn log level
     * @const
     * @alias LogFace.LVL_WARN
     */
    LVL_WARN : 'warn',

    /**
     * Error log level
     * @const
     * @alias LogFace.LVL_ERROR
     */
    LVL_ERROR : 'error',

    /**
     * Security log level
     * @const
     * @alias LogFace.LVL_SECURITY
     */
    LVL_SECURITY : 'security',

    /**
     * Generate 'ts' field log messages
     * @private
     */
    _ts : function()
    {
        var d = new Date();
        return d.getUTCFullYear().toString() +
            ( '0' + ( d.getUTCMonth() + 1 ).toString() ).slice( -2 ) +
            ( '0' + d.getUTCDate().toString() ).slice( -2 ) +
            ( '0' + d.getUTCHours().toString() ).slice( -2 ) +
            ( '0' + d.getUTCMinutes().toString() ).slice( -2 ) +
            ( '0' + d.getUTCSeconds().toString() ).slice( -2 ) +
            '.' + d.getUTCMilliseconds().toString();
    },

    /**
     * Log message
     * @param {string} lvl - debug|info|warn|error|security
     * @param {string} txt - message to log
     * @alias LogFace#msg
     */
    msg : function( lvl, txt )
    {
        var _this = this;

        async_steps()
        .add(
            function( as )
            {
                _this.call( as, 'msg', {
                    lvl : lvl,
                    txt : txt,
                    ts : _this._ts()
                } );
            },
            function( as, err )
            {
                console.log( 'LOGFAIL:' + lvl + ':' + txt );
                console.log( 'ERROR:' + err + ':' + as.state.error_info );
                console.log( as.state.last_exception.stack );
            }
        )
        .execute();
    },

    /**
     * Log message
     * @param {string} lvl - debug|info|warn|error|security
     * @param {string} txt - message to log
     * @param {string} data - raw data
     * @alias LogFace#msg
     */
    hexdump : function( lvl, txt, data )
    {
        var _this = this;

        async_steps()
        .add(
            function( as )
            {
                _this.call( as, 'hexdump', {
                    lvl : lvl,
                    txt : txt,
                    ts : _this._ts(),
                    data : btoa( data )
                } );
            },
            function( as, err )
            {
                console.log( 'LOGFAIL:' + lvl + ':' + txt );
                console.log( 'ERROR:' + err + ':' + as.state.error_info );
                console.log( as.state.last_exception.stack );
            }
        )
        .execute();
    },

    /**
     * Log message in debug level
     * @param {string} txt - message to log
     * @alias LogFace#debug
     */
    debug : function( txt )
    {
        this.msg( 'debug', txt );
    },

    /**
     * Log message in info level
     * @param {string} txt - message to log
     * @alias LogFace#info
     */
    info : function( txt )
    {
        this.msg( 'info', txt );
    },

    /**
     * Log message in warn level
     * @param {string} txt - message to log
     * @alias LogFace#warn
     */
    warn : function( txt )
    {
        this.msg( 'warn', txt );
    },

    /**
     * Log message in error level
     * @param {string} txt - message to log
     * @alias LogFace#error
     */
    error : function( txt )
    {
        this.msg( 'error', txt );
    },

    /**
     * Log message in security level
     * @param {string} txt - message to log
     * @alias LogFace#security
     */
    security : function( txt )
    {
        this.msg( 'security', txt );
    },
};

module.exports = LogFace;

/**
 * Embedded spec for FutoIn LogFace
 * @alias LogFace.ifacespec
 */
LogFace.ifacespec =
        {
            "iface" : "futoin.log",
            "version" : "1.0",
            "ftn3rev" : "1.1",
            "types" : {
                "LogLevel" : {
                    "type" : "string",
                    "regex" : "^(debug|info|warn|error|security)$",
                    "desc" : "Severity level"
                },
                "LogTimeStamp" : {
                    "type" : "string",
                    "regex" : "^[0-9]{14}(\\.[0-9]+)?$",
                    "desc" : "Original timestamp in YYYYMMDDhhmmss.frac format"
                }
            },
            "funcs" : {
                "msg" : {
                    "params" : {
                        "lvl" : {
                            "type" : "LogLevel"
                        },
                        "txt" : {
                            "type" : "string",
                            "desc" : "Text message, may include new lines"
                        },
                        "ts" : {
                            "type" : "LogTimeStamp"
                        }
                    },
                    "desc" : "Trivial log message"
                },
                "hexdump" : {
                    "params" : {
                        "lvl" : {
                            "type" : "LogLevel"
                        },
                        "txt" : {
                            "type" : "string",
                            "desc" : "Text message, may include new lines"
                        },
                        "ts" : {
                            "type" : "LogTimeStamp"
                        },
                        "data" : {
                            "type" : "string",
                            "desc" : "Base64 encoded binary data"
                        }
                    },
                    "desc" : "Trivial log message"
                }
            },
            "requires" : [
                "AllowAnonymous",
                "SecureChannel"
            ],
            "desc" : "Audit Log interface"
        };
