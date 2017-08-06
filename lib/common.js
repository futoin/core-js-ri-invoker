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
     * Maximum FutoIn message payload size (not related to raw data)
     * @alias SimpleCCM.SAFE_PAYLOAD_LIMIT
     * @const
     * @default 65536
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
/** @ignore */
exports._isNode = ( typeof window === 'undefined' ) && require( 'detect-node' );
