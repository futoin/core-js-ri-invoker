"use strict";

var async_steps = require( 'futoin-asyncsteps' );

/** @ignore */
exports.AsyncSteps = async_steps;
/** @ignore */
exports.FutoInError = async_steps.FutoInError;

/** @ignore */
exports.Options =
{
    /**
     * Overall call timeout (int)
     * @alias SimpleCCM.OPT_CALL_TIMEOUT_MS
     * @const
     */
    OPT_CALL_TIMEOUT_MS : 'callTimeoutMS',

    /**
     * Production mode - disables some checks without compomising security
     * @alias SimpleCCM.OPT_PROD_MODE
     * @const
     */
    OPT_PROD_MODE : "prodMode",

    /**
     * Communication configuration callback( type, specific-args )
     * @alias SimpleCCM.OPT_COMM_CONFIG_CB
     * @const
     */
    OPT_COMM_CONFIG_CB : 'commConfigCallback',

    /**
     * Message sniffer callback( iface_info, msg, is_incomming )
     * @alias SimpleCCM.OPT_MSG_SNIFFER
     * @const
     * @private
     */
    OPT_MSG_SNIFFER : 'messageSniffer',

    /**
     * Bi-directional channel disconnect sniffer callback( iface_info )
     * @alias SimpleCCM.OPT_DISCONNECT_SNIFFER
     * @const
     * @private
     */
    OPT_DISCONNECT_SNIFFER : 'disconnectSniffer',

    /**
     * Search dirs for spec definition or spec instance directly
     * @alias AdvancedCCM.OPT_SPEC_DIRS
     * @const
     */
    OPT_SPEC_DIRS : 'specDirs',

    /**
     * Client-side executor for bi-directional communication channels
     * @alias SimpleCCM.OPT_SPEC_DIRS
     * @const
     */
    OPT_EXECUTOR : "executor",

    /**
     * browser-only. Origin of target for *window.postMessage()*
     * @alias SimpleCCM.OPT_TARGET_ORIGIN
     * @const
     */
    OPT_TARGET_ORIGIN : "targetOrigin",

    /**
     * How many times to retry the call on CommError
     * @alias SimpleCCM.OPT_RETRY_COUNT
     * @const
     */
    OPT_RETRY_COUNT : "retryCount",

    /**
     * Base64 encoded key for HMAC generation
     * @alias SimpleCCM.OPT_HMAC_KEY
     * @const
     */
    OPT_HMAC_KEY : "hmacKey",

    /**
     * Hash algorithm for HMAC generation:
     * MD5(default), SHA224, SHA256, SHA384, SHA256
     * @alias SimpleCCM.OPT_HMAC_ALGO
     * @const
     */
    OPT_HMAC_ALGO : "hmacAlgo",

    /**
     * Maximum FutoIn message payload size (not related to raw data)
     * @alias SimpleCCM.SAFE_PAYLOAD_LIMIT
     * @const
     */
    SAFE_PAYLOAD_LIMIT : 65536,

    /**
     * Runtime iface resolution v1.x
     * @alias SimpleCCM.SVC_RESOLVER
     * @const
     */
    SVC_RESOLVER : '#resolver',

    /**
     * AuthService v1.x
     * @alias SimpleCCM.SVC_AUTH
     * @const
     */
    SVC_AUTH : '#auth',

    /**
     * Defense system v1.x
     * @alias SimpleCCM.SVC_DEFENSE
     * @const
     */
    SVC_DEFENSE : '#defense',

    /**
     * Access Control system v1.x
     * @alias SimpleCCM.SVC_ACL
     * @const
     */
    SVC_ACL : '#acl',

    /**
     * Audit Logging v1.x
     * @alias SimpleCCM.SVC_LOG
     * @const
     */
    SVC_LOG : '#log',

    /**
     * cache v1.x iface name prefix
     * @alias SimpleCCM.SVC_CACHE_
     * @const
     */
    SVC_CACHE_ : "#cache.",

    /**
     * @private
     * @const
     */
    FUTOIN_CONTENT_TYPE : 'application/futoin+json',
};

/** @ignore */
exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)*):(([0-9]+)\.([0-9]+))$/;
