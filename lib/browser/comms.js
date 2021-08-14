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

const $asyncevent = require( 'futoin-asyncevent' );

const common = require( '../common' );
const { InvokerError, CommError } = common.FutoInError;
const MyWebSocket = WebSocket;

const MessageCoder = require( '../../MessageCoder' );

/**
 * Browser HTTP communication backend
 * @private
 */
class HTTPComms {
    close() {}

    perform( as, ctx, req ) {
        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add( ( as ) => this._perform( as, ctx, req ) );
    }

    _perform( as, ctx, req ) {
        ctx.signMessage( as, ctx, req ); // no changes are expected
        const sniffer = ctx.options.messageSniffer;
        const httpreq = new XMLHttpRequest();
        const msg_coder = ctx.msg_coder;
        let url = ctx.endpoint;

        // ---
        let rawreq = ctx.upload_data;
        let req_content_type;
        let auth_header;

        if ( rawreq || ( rawreq === '' ) ) {
            req_content_type = 'application/octet-stream';

            if ( url.charAt( url.length - 1 ) !== '/' ) {
                url += "/";
            }

            // Note: we force end slashes here compared to node_comms by intention
            // to test both cases in real life
            url += req.f.replace( /:/g, '/' ) + '/';

            const { sec } = req;

            if ( sec ) {
                // clear-text auth should go as HTTP Basic (FTN5)
                if ( sec === ctx.options.credentials ) {
                    auth_header = 'Basic ' + window.btoa( sec );
                } else {
                    url += encodeURIComponent( sec ) + '/';
                }
            }

            const params = [];

            for ( var k in req.p ) {
                let v = req.p[ k ];

                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                params.push( encodeURIComponent( k ) + "=" + encodeURIComponent( v ) );
            }

            url += "?" + params.join( '&' );
            sniffer( ctx.info, req, false );
        } else {
            req_content_type = msg_coder.contentType();
            rawreq = msg_coder.encode( req );

            // NOTE: not so precise due to multi-byte UTF-8
            if ( rawreq.length > ctx.max_req_size ) {
                as.error( InvokerError,
                    `Request message too long: ${rawreq.length} > ${ctx.max_req_size}` );
            }

            sniffer( ctx.info, rawreq, false );
        }

        // ---
        if ( ctx.expect_response ) {
            if ( ctx.download_stream ) {
                httpreq.responseType = ctx.download_stream;
            }

            httpreq.onreadystatechange = function() {
                if ( this.readyState !== this.DONE ) {
                    return;
                }

                let response = ctx.download_stream ?
                    this.response :
                    this.responseText;

                if ( ( this.status === 200 ) && response ) {
                    const rsp_content_type = this.getResponseHeader( 'content-type' ) || '';
                    let is_futoin_msg = ( rsp_content_type === msg_coder.contentType() );

                    // fallback logic to handle JSON errors
                    if ( !is_futoin_msg && rsp_content_type.match( /^application\/futoin\+/ ) ) {
                        const other_coder = MessageCoder.detect( response );

                        try {
                            response = other_coder.decode( response );
                            is_futoin_msg = true;
                        } catch ( _ ) {
                            // pass
                        }
                    }

                    if ( is_futoin_msg ) {
                        sniffer( ctx.info, response, true );
                    } else {
                        sniffer( ctx.info, '%DATA%', true );
                    }

                    as.success( response, is_futoin_msg );
                } else {
                    try {
                        as.error( CommError, "Low error" );
                    } catch ( ex ) {
                        // ignore
                    }
                }
            };

            as.setCancel( () => httpreq.abort() );
        }

        // ---
        httpreq.open( 'POST', url, true );
        httpreq.setRequestHeader( 'Content-Type', req_content_type );

        if ( auth_header ) {
            httpreq.setRequestHeader( 'Authorization', auth_header );
        }

        httpreq.send( rawreq );
    }
}

exports.HTTPComms = HTTPComms;


/**
 * Browser WebSocket communication backend
 * @private
 */
class WSComms {
    constructor() {
        this.rid = 1;
        this.reqas = {};
        this.evt = {};
        this.ws = null;
        $asyncevent( this.evt, [ 'open' ] );
        this._waiting_open = false;
        this.sniffer = null;
        Object.seal( this );
    }

    init( as, ctx ) {
        const opts = ctx.options;

        const ws = new MyWebSocket( ctx.endpoint );

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

        const cleanup = ( event ) => {
            opts.disconnectSniffer( info );
            ws.close();
            this.ws = null;
            this.rid = 1;
            this.reqas = {};

            for ( let k in reqas ) {
                try {
                    reqas[ k ].error(
                        CommError,
                        event.wasClean ? "Cleanup" : "Error"
                    );
                } catch ( ex ) {
                    // ignore
                }
            }

            this._waiting_open = false;
            ctx.native_iface.emit( 'disconnect' );
        };

        ws.binaryType = 'arraybuffer';
        ws.onclose = cleanup;
        ws.onerror = cleanup;

        ws.onopen = ( _event ) => {
            this._waiting_open = false;
            this.evt.emit( 'open' );
            ctx.native_iface.emit( 'connect' );
        };

        ws.onmessage = ( event ) => {
            let rsp = event.data;
            sniffer( info, rsp, true );

            const coder = MessageCoder.detect( rsp );

            try {
                rsp = coder.decode( rsp );
            } catch ( e ) {
                console.log( 'WS Decode error', e.message, e );
                // Ignore
                return;
            }

            // Only multiplexing mode is expected for WebSockets
            const rid = rsp.rid;

            if ( rid ) {
                const asi = reqas[ rid ];

                if ( asi ) {
                    asi.success( rsp, true );
                    delete reqas[ rid ];
                } else if ( ( rid.charAt( 0 ) === 'S' ) && executor ) {
                    executor.onEndpointRequest(
                        info,
                        rsp,
                        ( rsp ) => send_executor_rsp( coder, rsp )
                    );
                }
            }
        };
    }

    close() {
        if ( this.ws ) {
            this.ws.close();
            this.ws = null;
        }
    }

    perform( as, ctx, req ) {
        if ( !this.ws ) {
            this.init( as, ctx );
        }

        if ( this._waiting_open ) {
            as.add( ( as ) => {
                if ( !this._waiting_open ) {
                    return; // already got opened
                }

                const on_open = () => as.success();

                this.evt.once( 'open', on_open );

                as.setCancel( () => this.evt.off( 'open', on_open ) );
            } );
        }

        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add( ( as ) => this._perform( as, ctx, req ) );
    }

    _perform( as, ctx, req ) {
        if ( !this.ws ) {
            as.error( CommError, 'Disconnect while in progress' );
        }

        const reqas = this.reqas;

        const rid = 'C' + this.rid++;

        req.rid = rid;
        ctx.signMessage( as, ctx, req );

        if ( ctx.expect_response ) {
            reqas[ rid ] = as;

            as.setCancel( () => {
                delete reqas[ rid ];
            } );
        }

        const rawreq = ctx.msg_coder.encode( req );

        this.sniffer( ctx.info, rawreq, false );

        this.ws.send( rawreq );
    }
}

// Fallback to HTTP comms, if WebSocket suport is missing
if ( MyWebSocket ) {
    exports.WSComms = WSComms;
} else {
    exports.WSComms = HTTPComms;
}

/**
 * Browser HTML5 Web Messaging communication backend
 * @private
 */
class BrowserComms {
    constructor() {
        this.rid = 1;
        this.reqas = {};
        this.opts = null;
        this.target = null;
        this.sniffer = null;
        Object.seal( this );
    }

    init( as, ctx ) {
        // --
        const opts = ctx.options;

        this.opts = opts;

        // --
        let target = ctx.endpoint.split( '://', 2 )[ 1 ];
        let iframe;

        if ( target === 'parent' ) {
            // redundant as the second if covers one
            target = window.parent;
        } else if ( ( target in window ) &&
                  ( 'postMessage' in window[ target ] ) ) {
            target = window[ target ];
        } else {
            iframe = document.getElementById( target );

            if ( iframe ) {
                target = iframe.contentWindow;
            } else {
                as.error( CommError, 'Unknown target: ' + target );
            }
        }

        if ( target === window ) {
            as.error( CommError, 'Target matches current window' );
        }

        this.target = target;

        // --
        const reqas = this.reqas;
        const executor = opts.executor || null;
        const info = ctx.info;
        const target_origin = opts.targetOrigin;
        const sniffer = opts.messageSniffer;

        this.sniffer = sniffer;

        const send_executor_rsp = ( rsp ) => {
            sniffer( target_origin, rsp, false );
            target.postMessage( rsp, target_origin || '*' );
        };

        const on_message = ( event ) => {
            sniffer( info, event.data, true );

            // Security & Performance important
            if ( event.source &&
                 ( event.source !== target ) ) {
                return;
            }

            if ( !target_origin ) {
                // pass
            } else if ( event.origin !== target_origin ) {
                console.log( 'Error: peer origin mismatch ' );
                console.log( 'Error >origin: ' + event.origin );
                console.log( 'Error >required: ' + target_origin );
                return;
            }

            // ---
            const rsp = event.data;

            if ( typeof rsp !== 'object' ) {
                console.log( 'Not object response: ' + rsp );
                return;
            }

            // Only multiplexing mode is expected for HTML5 Web Messaging ecomms
            const rid = rsp.rid;

            if ( rid ) {
                if ( !( 'f' in rsp ) ) {
                    const as = reqas[rid];

                    if ( as ) {
                        as.success( rsp, true );
                        delete reqas[ rid ];
                    }
                } else if ( ( 'f' in rsp ) &&
                          ( rid.charAt( 0 ) === 'S' ) &&
                          executor
                ) {
                    executor.onEndpointRequest(
                        info,
                        rsp,
                        send_executor_rsp
                    );
                } else {
                    return;
                }

                if ( event.stopPropagation ) {
                    event.stopPropagation();
                }
            }
        };

        window.addEventListener( "message", on_message, false );
        ctx.native_iface.emit( 'connect' );
    }

    close() {
        if ( this.target ) {
            this.target = null;
        }
    }

    perform( as, ctx, req ) {
        if ( ctx.upload_data ||
             ctx.download_stream ) {
            as.error( CommError, 'Raw Data is not supported by Web Messaging yet' );
        }

        if ( !this.target ) {
            this.init( as, ctx );
        }

        as.add( ( as ) => {
            const reqas = this.reqas;

            const rid = 'C' + this.rid++;

            req.rid = rid;
            ctx.signMessage( as, ctx, req );

            if ( ctx.expect_response ) {
                reqas[ rid ] = as;

                as.setCancel( () => {
                    delete reqas[ rid ];
                } );
            }

            this.sniffer( ctx.info, req, false );
            this.target.postMessage( req, this.opts.targetOrigin || '*' );
        } );
    }
}

exports.BrowserComms = BrowserComms;
