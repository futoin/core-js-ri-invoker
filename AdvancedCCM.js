"use strict";

/**
 * @module futoin-invoker
 */

var _clone = require( 'lodash/lang/clone' );
var common = require( './lib/common' );
var futoin_error = common.FutoInError;
var _extend = require( 'lodash/object/extend' );
var AdvancedCCMImpl = require( './lib/AdvancedCCMImpl' );
var SimpleCCM = require( './SimpleCCM' );
var ee = require( 'event-emitter' );

/**
 * AdvancedCCM public properties
 * @ignore
 */
var AdvancedCCMPublic = common.Options;

/**
 * Advanced CCM - Reference Implementation
 * @link http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html
 * @alias AdvancedCCM
 * @class
 */
function AdvancedCCM( options )
{
    ee( this );
    this._iface_info = {};
    this._iface_impl = {};
    this._impl = new AdvancedCCMImpl( options );
}

_extend( AdvancedCCM, AdvancedCCMPublic );

/**
 * AdvancedCCM proto
 * @ignore
 */
var AdvancedCCMProto = _clone( SimpleCCM.prototype );
AdvancedCCM.prototype = AdvancedCCMProto;

/**
 * Try to load internal registration info from cache
 * DO NOT USE, this is only a compliance with the spec.
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 * @param {string} cache_l1_endpoint - URI or any other resource identifier of iface implementing peer, accepted by CCM implementation
 * @alias AdvancedCCM#initFromCache
 * @ignore
 */
AdvancedCCMProto.initFromCache = function( as, cache_l1_endpoint )
{
    void cache_l1_endpoint;
    as.error( futoin_error.NotImplemented, "Caching is not supported yet" );
};

/**
 * Save internal registration info to cache
 * DO NOT USE, this is only a compliance with the spec.
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 * @alias AdvancedCCM#cacheInit
 * @ignore
 */
AdvancedCCMProto.cacheInit = function( as )
{
    void as;
    // Fail silently
};
/* --- */

module.exports = AdvancedCCM;
