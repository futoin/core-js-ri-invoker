'use strict';

var _clone = require( 'lodash/clone' );
var NativeIface = require( './NativeIface' );
var common = require( './lib/common' );
var async_steps = require( 'futoin-asyncsteps' );

var btoa = ( typeof window !== 'undefined' ) ? window.btoa :
    function( str )
    {
        return new Buffer( str ).toString( 'base64' );
    };

/**
 * AuditLog Native interface
 *
 * Register with LogFace.register().
 *
 * NOTE: it is not directly available Invoker module
 * interface, include separately
 * @class
 * @alias LogFace
 * @augments NativeIface
 */
function LogFace()
{
    NativeIface.apply( this, arguments );
}

/**
 * AuditLog Native interface registration helper
 * @param {AsyncSteps} as - step interface
 * @param {AdvancedCCM} ccm - CCM instance
 * @param {string} endpoint - endpoint URL
 * @param {*} [credentials=null] - see CCM register()
 * @param {object} [options={}] - registration options
 * @param {string} [options.version=1.0] - iface version
 * @alias LogFace.register
 */
LogFace.register = function( as, ccm, endpoint, credentials, options )
{
    options = options || {};
    var ifacever = options.version || '1.0';
    var iface = LogFace.spec( ifacever );

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
var LogFaceProto = _clone( NativeIface.prototype );

LogFace.prototype = LogFaceProto;
LogFace.spec = NativeIface.spec;

/**
 * Debug log level
 * @const
 * @alias LogFace.LVL_DEBUG
 */
LogFaceProto.LVL_DEBUG = 'debug';

/**
 * Info log level
 * @const
 * @alias LogFace.LVL_INFO
 */
LogFaceProto.LVL_INFO = 'info';

/**
 * Warn log level
 * @const
 * @alias LogFace.LVL_WARN
 */
LogFaceProto.LVL_WARN = 'warn';

/**
 * Error log level
 * @const
 * @alias LogFace.LVL_ERROR
 */
LogFaceProto.LVL_ERROR = 'error';

/**
 * Security log level
 * @const
 * @alias LogFace.LVL_SECURITY
 */
LogFaceProto.LVL_SECURITY = 'security';

/**
 * Generate 'ts' field log messages
 * @private
 * @returns {string} current timestamp
 */
LogFaceProto._ts = function()
{
    var d = new Date();

    return d.getUTCFullYear().toString() +
        ( '0' + ( d.getUTCMonth() + 1 ).toString() ).slice( -2 ) +
        ( '0' + d.getUTCDate().toString() ).slice( -2 ) +
        ( '0' + d.getUTCHours().toString() ).slice( -2 ) +
        ( '0' + d.getUTCMinutes().toString() ).slice( -2 ) +
        ( '0' + d.getUTCSeconds().toString() ).slice( -2 ) +
        '.' + d.getUTCMilliseconds().toString();
};

/**
 * Log message
 * @param {string} lvl - debug|info|warn|error|security
 * @param {string} txt - message to log
 * @alias LogFace#msg
 */
LogFaceProto.msg = function( lvl, txt )
{
    var _this = this;

    async_steps()
        .add(
            function( as )
            {
                _this.call( as, 'msg', {
                    lvl : lvl,
                    txt : txt,
                    ts : _this._ts(),
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
};

/**
 * Log message
 * @param {string} lvl - debug|info|warn|error|security
 * @param {string} txt - message to log
 * @param {string} data - raw data
 * @alias LogFace#hexdump
 */
LogFaceProto.hexdump = function( lvl, txt, data )
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
                    data : btoa( data ),
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
};

/**
 * Log message in debug level
 * @param {string} txt - message to log
 * @alias LogFace#debug
 */
LogFaceProto.debug = function( txt )
{
    this.msg( 'debug', txt );
};

/**
 * Log message in info level
 * @param {string} txt - message to log
 * @alias LogFace#info
 */
LogFaceProto.info = function( txt )
{
    this.msg( 'info', txt );
};

/**
 * Log message in warn level
 * @param {string} txt - message to log
 * @alias LogFace#warn
 */
LogFaceProto.warn = function( txt )
{
    this.msg( 'warn', txt );
};

/**
 * Log message in error level
 * @param {string} txt - message to log
 * @alias LogFace#error
 */
LogFaceProto.error = function( txt )
{
    this.msg( 'error', txt );
};

/**
 * Log message in security level
 * @param {string} txt - message to log
 * @alias LogFace#security
 */
LogFaceProto.security = function( txt )
{
    this.msg( 'security', txt );
};

module.exports = LogFace;

var specs = {};

LogFace._specs = specs;

/**
 * Embedded spec for FutoIn LogFace
 * @ignore
 */
specs['1.0'] =
        {
            iface : "futoin.log",
            version : "1.0",
            ftn3rev : "1.1",
            types : {
                LogLevel : {
                    type : "string",
                    regex : "^(debug|info|warn|error|security)$",
                    desc : "Severity level",
                },
                LogTimeStamp : {
                    type : "string",
                    regex : "^[0-9]{14}(\\.[0-9]+)?$",
                    desc : "Original timestamp in YYYYMMDDhhmmss.frac format",
                },
            },
            funcs : {
                msg : {
                    params : {
                        lvl : { type : "LogLevel" },
                        txt : {
                            type : "string",
                            desc : "Text message, may include new lines",
                        },
                        ts : { type : "LogTimeStamp" },
                    },
                    desc : "Trivial log message",
                },
                hexdump : {
                    params : {
                        lvl : { type : "LogLevel" },
                        txt : {
                            type : "string",
                            desc : "Text message, may include new lines",
                        },
                        ts : { type : "LogTimeStamp" },
                        data : {
                            type : "string",
                            desc : "Base64 encoded binary data",
                        },
                    },
                    desc : "Trivial log message",
                },
            },
            requires : [ "AllowAnonymous", "SecureChannel" ],
            desc : "Audit Log interface",
        };
