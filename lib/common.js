"use strict";

var async_steps = require( 'futoin-asyncsteps' );

exports.AsyncSteps = async_steps;
exports.FutoInError = async_steps.FutoInError;

exports.Options =
{
    /**
     * Overall call timeout (int)
     * @alias SimpleCCM.OPT_CALL_TIMEOUT_MS
     */
    OPT_CALL_TIMEOUT_MS : 'CALL_TIMEOUT_MS',

    /**
     * Verify peer by X509 certificate
     * @alias SimpleCCM.OPT_X509_VERIFY
     */
    OPT_X509_VERIFY : 'X509_VERIFY',

    /**
     * Production mode - disables some checks without compomising security
     * @alias SimpleCCM.OPT_PROD_MODE
     */
    OPT_PROD_MODE : "PROD_MODE",

    /**
     * Communication configuration callback( type, specific-args )
     * @alias SimpleCCM.OPT_COMM_CONFIG_CB
     */
    OPT_COMM_CONFIG_CB : 'COMM_CONFIG_CB',

    /**
     * Search dirs for spec definition or spec instance directly (AdvancedCCM)
     * @alias SimpleCCM.OPT_SPEC_DIRS
     */
    OPT_SPEC_DIRS : 'SPEC_DIRS',
};

exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)+):(([0-9]+)\.([0-9]+))$/;
