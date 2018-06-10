"use strict";

/**
 * @file
 *
 * Copyright 2014-2017 FutoIn Project (https://futoin.org)
 * Copyright 2014-2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require( 'http' );
const https = require( 'https' );
const url = require( 'url' );
const querystring = require( 'querystring' );
const _clone = require( 'lodash/clone' );
const WebSocket = require( 'faye-websocket' );

const AgentKeepAlive = require( 'agentkeepalive' );
const AgentKeepAliveSecure = AgentKeepAlive.HttpsAgent;

const common = require( '../common' );
const FutoInError = common.FutoInError;
const optname = common.Options;

const MessageCoder = require( '../../MessageCoder' );

/**
 * Node.js HTTP communication backend
 * @private
 */
exports.HTTPComms = class {
    getGlobalAgent( as, ctx, is_https ) {
        const agent_field = is_https ?
            '_globalHTTPSecureAgent' :
            '_globalHTTPAgent';
        const ccmimpl = ctx.ccmimpl;

        if ( ccmimpl[ agent_field ] ) {
            return ccmimpl[ agent_field ];
        }

        const agent_opts = {
            keepAlive : true,
            keepAliveMsecs : 5e3,
            keepAliveTimeout : 30e3,
            maxFreeSockets : 8,
        };

        // Call concfig callback
        const optcb = ctx.options.commConfigCallback;

        if ( optcb ) {
            optcb( ( is_https ? 'https' : 'http' ), agent_opts );
        }

        const agent = is_https ?
            new AgentKeepAliveSecure( agent_opts ) :
            new AgentKeepAlive( agent_opts );

        ccmimpl[ agent_field ] = agent;
        return agent;
    }

    init( as, ctx ) {
        // Init options
        if ( 'httpopts' in this ) {
            return this.httpopts;
        }

        const parsed_url = url.parse( ctx.endpoint );

        parsed_url.protocol = parsed_url.protocol.replace( ':', '' );
        const is_https = ( parsed_url.protocol === 'https' );

        if ( !parsed_url.port ) {
            if ( is_https ) {
                parsed_url.port = 443;
            } else {
                parsed_url.port = 80;
            }
        }

        const httpopts =
        {
            host : parsed_url.hostname,
            port : parsed_url.port,
            path : parsed_url.path,
        };

        if ( is_https ) {
            this.http_impl = https;
        } else {
            this.http_impl = http;
        }

        httpopts.agent = this.getGlobalAgent( as, ctx, is_https );

        this.httpopts = httpopts;
        return httpopts;
    }

    close() {}

    perform( as, ctx, req ) {
        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add( ( as ) => this._perform( as, ctx, req ) );
    }

    _perform( as, ctx, req ) {
        ctx.signMessage( req ); // no changes are expected
        const sniffer = ctx.options.messageSniffer;
        const msg_coder = ctx.msg_coder;

        let httpopts = this.init( as, ctx );

        httpopts = _clone( httpopts );
        httpopts.method = 'POST';
        httpopts.headers = {};

        let rawreq = ctx.upload_data;

        if ( rawreq ||
             ( rawreq === '' ) ) {
            httpopts.headers[ 'content-type' ] = 'application/octet-stream';

            if ( typeof rawreq === "string" ) {
                httpopts.headers[ 'content-length' ] = Buffer.byteLength( rawreq, 'utf8' );
            } else if ( rawreq instanceof Buffer ) {
                httpopts.headers[ 'content-length' ] = rawreq.length;
            } else if ( 'lengthInBytes' in rawreq ) {
                httpopts.headers[ 'content-length' ] = rawreq.lengthInBytes;
            } else {
                as.error( FutoInError.InvokerError, "Please set 'lengthInBytes' property for upload_data" );
            }

            let path = httpopts.path;

            if ( path.charAt( path.length - 1 ) !== '/' ) {
                path += "/";
            }

            path += req.f.replace( /:/g, '/' );

            if ( 'sec' in req ) {
                // clear-text auth should go as HTTP Basic (FTN5)
                if ( req.sec === ctx.options.credentials ) {
                    httpopts.headers.authorization =
                        'Basic ' + new Buffer( req.sec ).toString( 'base64' );
                } else {
                    path += "/" + encodeURIComponent( req.sec );
                }
            }

            const p = _clone( req.p );

            // As per FTN5 v1.2
            for ( let k in p ) {
                let v = p[ k ];

                if ( typeof v !== 'string' ) {
                    p[ k ] = JSON.stringify( v );
                }
            }

            path += "?" + querystring.stringify( p );

            httpopts.path = path;

            sniffer( ctx.info, req, false );
        } else {
            rawreq = msg_coder.encode( req );

            if ( typeof rawreq === 'string' ) {
                rawreq = Buffer.from( rawreq );
            }

            httpopts.headers[ 'content-type' ] = msg_coder.contentType();
            const byte_length = rawreq.length;

            if ( byte_length > ctx.max_req_size ) {
                as.error( FutoInError.InvokerError, "FutoIn message exceeds safety limit" );
            }

            httpopts.headers[ 'content-length' ] = byte_length;

            sniffer( ctx.info, rawreq, false );
        }

        const httpreq = this.http_impl.request( httpopts );

        if ( ctx.expect_response ) {
            const error_handler = function( e ) {
                if ( on_response !== null ) {
                    httpreq.removeListener( 'response', on_response );
                }

                httpreq.removeListener( 'error', error_handler );

                try {
                    as.error( FutoInError.CommError, "Low error: " + e.code + " = " + e.message );
                } catch ( ex ) {
                    // ignore
                }
            };

            httpreq.on( 'error', error_handler );

            as.setCancel( () => httpreq.abort() );

            const on_response = function( rsp ) {
                if ( ctx.download_stream ) {
                    const on_dl_end = function() {
                        httpreq.removeListener( 'response', on_response );
                        httpreq.removeListener( 'error', error_handler );

                        sniffer( ctx.info, '%DATA%', true );
                        as.success( true, false );
                    };

                    rsp.on( 'end', on_dl_end );

                    rsp.pipe( ctx.download_stream );
                } else {
                    const rspdata = [];
                    let len = 0;
                    const limit_len = ctx.rawresult ?
                        false :
                        ctx.max_rsp_size;

                    const on_data_chunk = function( chunk ) {
                        len += chunk.length;

                        if ( limit_len &&
                             ( len > limit_len ) ) {
                            as.error( FutoInError.CommError, "Incoming FutoIn message exceeds limit" );

                            try {
                                req.socket.destroy();
                            } catch ( e ) {
                                // ignore
                            }
                        }

                        rspdata.push( chunk );
                    };

                    rsp.on( 'data', on_data_chunk );

                    const on_end = function() {
                        const content_type = ( rsp.headers[ 'content-type' ] || '' );
                        let rawrsp = Buffer.concat( rspdata );
                        let is_futoin_msg = ( content_type === msg_coder.contentType() );

                        // fallback logic to handle JSON errors
                        if ( !is_futoin_msg && content_type.startsWith( 'application/futoin+' ) ) {
                            const other_coder = MessageCoder.detect( rawrsp );

                            try {
                                rawrsp = other_coder.decode( rawrsp );
                                is_futoin_msg = true;
                            } catch ( _ ) {
                                // pass
                            }
                        }

                        if ( is_futoin_msg ) {
                            sniffer( ctx.info, rawrsp, true );
                        } else {
                            sniffer( ctx.info, '%DATA%', true );
                        }

                        httpreq.removeListener( 'response', on_response );
                        httpreq.removeListener( 'error', error_handler );

                        as.success( rawrsp, is_futoin_msg );
                    };

                    rsp.on( 'end', on_end );
                }
            };

            httpreq.on( 'response', on_response );
        }

        if ( ( typeof rawreq === 'object' ) &&
             ( 'pipe' in rawreq ) ) {
            rawreq.pipe( httpreq, { end : true } );
        } else if ( rawreq instanceof Buffer ) {
            httpreq.end( rawreq );
        } else {
            httpreq.end( rawreq, 'utf8' );
        }
    }
};

/**
 * Node.js WebSocket communication backend
 * @private
 */
exports.WSComms = class WSComms {
    constructor() {
        this.rid = 1;
        this.reqas = new Map();
        this.sniffer = null;
        this._waiting_open = false;
        this.ws = null;
        Object.seal( this );
    }

    init( as, ctx ) {
        const parsed_url = url.parse( ctx.endpoint );

        parsed_url.protocol = parsed_url.protocol.replace( ':', '' );

        const opts = ctx.options;

        const ws = new WebSocket.Client(
            ctx.endpoint,
            null,
            { maxLength : optname.SAFE_PAYLOAD_LIMIT }
        );

        this.ws = ws;
        this._waiting_open = true;

        const reqas = this.reqas;
        const executor = opts.executor || null;
        const info = ctx.info;
        const sniffer = opts.messageSniffer;

        this.sniffer = sniffer;

        const send_executor_rsp = ( coder, rsp ) => {
            const rawrsp = executor.packPayload( coder, rsp );

            sniffer( info, rawrsp, false );
            ws.send( rawrsp );
        };

        const cleanup = ( _arg1, arg2 ) => {
            opts.disconnectSniffer( info );
            ws.close();
            this.ws = null;
            this.rid = 1;

            for ( let as of reqas.values() ) {
                try {
                    as.error( FutoInError.CommError, ( arg2 !== undefined ) ? "Cleanup" : "Error" );
                } catch ( ex ) {
                    // ignore
                }
            }

            reqas.clear();

            this._waiting_open = false;
            ctx.native_iface.emit( 'disconnect' );
        };

        ws.on( 'error', cleanup );
        ws.on( 'close', cleanup );

        ws.on( 'open', () => {
            this._waiting_open = false;
            ctx.native_iface.emit( 'connect' );
        } );

        ws.on( 'message', ( event ) => {
            let rsp = event.data;

            sniffer( info, rsp, true );
            const coder = MessageCoder.detect( rsp );

            try {
                rsp = coder.decode( rsp );
            } catch ( e ) {
                // Ignore
                return;
            }

            // Only multiplexing mode is expected for WebSockets
            const rid = rsp.rid;

            if ( rid ) {
                const as = reqas.get( rid );

                if ( as ) {
                    as.success( rsp, true );
                    reqas.delete( rid );
                } else if ( ( rid.charAt( 0 ) === 'S' ) && executor ) {
                    executor.onEndpointRequest(
                        info,
                        rsp,
                        ( rsp ) => send_executor_rsp( coder, rsp )
                    );
                }
            }
        } );
    }

    close() {
        if ( this.ws ) {
            this.ws.close();
        }
    }

    perform( as, ctx, req ) {
        if ( !this.ws ) {
            this.init( as, ctx );
        }

        if ( this._waiting_open ) {
            as
                .add( ( as ) => {
                    if ( !this._waiting_open ) {
                        return; // already got opened
                    }

                    var on_open = function() {
                        as.success();
                    };

                    this.ws.once( 'open', on_open );

                    as.setCancel( () => {
                        this.ws && this.ws.removeListener( 'open', on_open );
                    } );
                } );
        }

        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add( ( as ) => this._perform( as, ctx, req ) );
    }

    _perform( as, ctx, req ) {
        const ws = this.ws;

        if ( !ws ) {
            as.error( FutoInError.CommError, 'Disconnect while in progress' );
        }

        // dirty hack
        ws._driver._maxLength = Math.max(
            ws._driver._maxLength,
            ctx.max_rsp_size,
            ctx.max_req_size
        );

        const reqas = this.reqas;

        const rid = 'C' + this.rid++;

        req.rid = rid;
        ctx.signMessage( req );

        //
        if ( ctx.expect_response ) {
            reqas.set( rid, as );

            as.setCancel( () => reqas.delete( rid ) );
        }

        //
        const rawmsg = ctx.msg_coder.encode( req );

        this.sniffer( ctx.info, rawmsg, false );
        ws.send( rawmsg );
    }
};
