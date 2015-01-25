"use strict";

var common = require( './common' );
var futoin_error = common.FutoInError;
var _ = require( 'lodash' );
var ee = require( 'event-emitter' );
var async_steps = require( 'futoin-asyncsteps' );
var FUTOIN_CONTENT_TYPE = common.Options.FUTOIN_CONTENT_TYPE;

exports = module.exports = function( ccmimpl, info )
{
    return new module.exports.NativeIface( ccmimpl, info );
};

/**
 * FutoIn interface info
 * @class
 */
function InterfaceInfo( raw_info )
{
    this._raw_info = raw_info;
}

InterfaceInfo.prototype =
{
    /**
     * Get FutoIn interface type
     * @returns {string}
     */
    name : function()
    {
        return this._raw_info.iface;
    },

    /**
     * Get FutoIn interface version
     * @returns {string}
     */
    version : function()
    {
        return this._raw_info.version;
    },

    /**
     * Get list of inherited interfaces starting from the most derived, may be null
     * @returns {object}
     */
    inherits : function()
    {
        return this._raw_info.inherits;
    },

    /**
     * Get list of available functions, may be null
     * @returns {object}
     */
    funcs : function()
    {
        return this._raw_info.funcs;
    },

    /**
     * Get list of interface constraints, may be null
     * @returns {object}
     */
    constraints : function()
    {
        return this._raw_info.constraints;
    }
};

exports.InterfaceInfo = InterfaceInfo;

/**
 * Native Interface for FutoIn ifaces
 * @class
 */
function NativeIface( ccmimpl, info )
{
    this._ccmimpl = ccmimpl;
    this._raw_info = info;
    this._iface_info = null;
    this._comms = {};

    _.extend( this, NativeIfaceProto );
    ee( this );

    for ( var fn in this._raw_info.funcs )
    {
        var finfo = this._raw_info.funcs[ fn ];

        // Not allowed
        if ( finfo.rawupload )
        {
            continue;
        }

        if ( fn in this )
        {
            continue;
        }

        this[ fn ] = this._member_call_generate( fn, finfo );
    }
}

var NativeIfaceProto =
{
    /**
     * Generic FutoIn function call interface
     * Result is passed through AsyncSteps.success() as a map.
     * @param {AsyncSteps} as - AsyncSteps object
     * @param {string} name - FutoIn iface function name
     * @param {object} params - map of func parameters
     * @param {string|stream.Readable=} upload_data - raw upload data or input stram
     * @param {stream.Writable=} download_stream - output stream for raw download data
     * @param {int=} timeout - if provided, overrides the default. <=0 - disables timeout
     * @alias NativeIface#call
     */
    call : function( as, name, params, upload_data, download_stream, timeout )
    {
        params = params || {};
        var raw_info = this._raw_info;

        var ctx = {
            ccmimpl : this._ccmimpl,
            name : name,
            info : raw_info,
            upload_data : upload_data,
            download_stream : download_stream,
            rsp_content_type : null,
            native_iface : this,
            options : raw_info.options,
            endpoint : raw_info.endpoint,
            expect_response : true
        };

        var ccmimpl = this._ccmimpl;

        // Create message
        // ---
        as.add(
            function( as )
            {
                ccmimpl.createMessage( as, ctx, params );
            }
        );

        // Perform request
        // ---
        as.add(
            function( orig_as, req )
            {
                var as;

                if ( ctx.expect_response )
                {
                    as = orig_as;

                    if ( typeof timeout !== 'number' )
                    {
                        timeout = ctx.info.options.callTimeoutMS;
                    }

                    if ( timeout > 0 )
                    {
                        as.setTimeout( timeout );
                    }
                }
                else
                {
                    as = async_steps();
                }

                var scheme = raw_info.endpoint_scheme;

                if ( scheme === '#internal#' )
                {
                    ctx.endpoint.onInternalRequest( as, raw_info, req, upload_data, download_stream );
                }
                else if ( ( scheme === 'http' ) ||
                          ( scheme === 'https' ) )
                {
                    ccmimpl.perfomHTTP( as, ctx, req );
                }
                else if ( ( scheme === 'ws' ) ||
                          ( scheme === 'wss' ) )
                {
                    var finfo;
                    var rawresult = ctx.download_stream || ( ctx.info.funcs &&
                           ( finfo = ctx.info.funcs[ name ] ) &&
                           finfo.rawresult );

                    if ( ctx.upload_data ||
                         rawresult )
                    {
                        ctx.endpoint = ctx.endpoint.replace( 'ws', 'http' );
                        ctx.rawresult = rawresult;
                        ccmimpl.perfomHTTP( as, ctx, req );
                    }
                    else
                    {
                        ccmimpl.perfomWebSocket( as, ctx, req );
                    }
                }
                else if ( ctx.upload_data )
                {
                    as.error(
                        futoin_error.InvokerError,
                        'Upload data is allowed only for HTTP/WS endpoints' );
                }
                else if ( ctx.download_stream )
                {
                    as.error(
                        futoin_error.InvokerError,
                        'Download stream is allowed only for HTTP/WS endpoints' );
                }
                else if ( scheme === 'browser' )
                {
                    ccmimpl.perfomBrowser( as, ctx, req );
                }
                else if ( scheme === 'unix' )
                {
                    ccmimpl.perfomUNIX( as, ctx, req );
                }
                else if ( scheme === 'callback' )
                {
                    ctx.endpoint( as, ctx, req );
                }
                else
                {
                    as.error( futoin_error.InvokerError, 'Unknown endpoint scheme' );
                }

                if ( as !== orig_as )
                {
                    as.execute();
                    orig_as.success();
                }
                else
                {
                    as.add(
                        function( as, rsp, content_type )
                        {
                            if ( ctx.download_stream )
                            {
                                as.success( true );
                            }
                            else if ( ( content_type === FUTOIN_CONTENT_TYPE ) ||
                                      ( content_type === true ) )
                            {
                                if ( typeof rsp === 'string' )
                                {
                                    try
                                    {
                                        rsp = JSON.parse( rsp );
                                    }
                                    catch ( e )
                                    {
                                        as.error( futoin_error.CommError, "JSON:" + e.message );
                                    }
                                }

                                ccmimpl.onMessageResponse( as, ctx, rsp );
                            }
                            else
                            {
                                ccmimpl.onDataResponse( as, ctx, rsp );
                            }
                        }
                    );
                }
            }
        );
    },

    /**
     * @ignore
     */
    _member_call_intercept : function( as, name, finfo, args )
    {
        var arginfo = finfo.params;
        var keys = Object.keys( arginfo );

        if ( args.length > keys.length )
        {
            as.error( futoin_error.InvokerError, "Unknown parameters" );
        }
        else if ( args.length < finfo.min_args )
        {
            as.error( futoin_error.InvokerError, "Missing parameters" );
        }
        else if ( args.length < keys.length )
        {
            keys = keys.splice( 0, args.length );
        }

        var params = _.object( keys, args );
        this.call( as, name, params );
    },

    /**
     * @ignore
     */
    _member_call_generate : function( name, finfo )
    {
        return function( as )
        {
            this._member_call_intercept(
                as,
                name,
                finfo,
                Array.prototype.slice.call( arguments, 1 )
            );
        };
    },

    /**
     * Get interface info
     * @returns {object}
     * @alias NativeIface#call
     */
    ifaceInfo : function()
    {
        if ( !this._iface_info )
        {
            this._iface_info = new InterfaceInfo( this._raw_info );
        }

        return this._iface_info;
    },

    /**
     * Results with DerivedKeyAccessor through as.success()
     * @alias NativeIface#bindDerivedKey
     */
    bindDerivedKey : function( as )
    {
        void as;
        throw new Error( futoin_error.InvokerError, "Not Implemented" );
    },

    /**
     * Shutdow interface
     * @private
     */
    _close : function()
    {
        var comms = this._comms;

        for ( var k in comms )
        {
            comms[ k ].close();
        }

        this.emit( 'close' );
    }
};

exports.NativeIface = NativeIface;
