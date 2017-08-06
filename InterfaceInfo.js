"use strict";

/**
 * FutoIn interface info
 * @alias InterfaceInfo
 * @param {object} raw_info - futoin spec as is
 * @class
 */
function InterfaceInfo( raw_info )
{
    this._raw_info = raw_info;
}

var InterfaceInfoProto = {};

InterfaceInfo.prototype = InterfaceInfoProto;

/**
 * Get FutoIn interface name
 * @returns {string} name
 * @alias InterfaceInfo#name
 */
InterfaceInfoProto.name = function()
{
    return this._raw_info.iface;
};

/**
 * Get FutoIn interface version
 * @returns {string} version
 * @alias InterfaceInfo#version
 */
InterfaceInfoProto.version = function()
{
    return this._raw_info.version;
};

/**
 * Get list of inherited interfaces starting from the most derived, may be null
 * @returns {string} inherited interface name-ver
 * @alias InterfaceInfo#inherits
 */
InterfaceInfoProto.inherits = function()
{
    return this._raw_info.inherits;
};

/**
 * Get list of available functions, may be null
 * @returns {object} list of functions
 * @alias InterfaceInfo#funcs
 */
InterfaceInfoProto.funcs = function()
{
    return this._raw_info.funcs;
};

/**
 * Get list of interface constraints, may be null
 * @returns {array} list of constraints
 * @alias InterfaceInfo#constraints
 */
InterfaceInfoProto.constraints = function()
{
    return this._raw_info.constraints;
};

module.exports = InterfaceInfo;
