
( function( window ) {
    'use strict';

    /**
     * **window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM
     * @global
     * @name window.SimpleCCM
     */
    window.SimpleCCM = require( '../SimpleCCM' );

    if ( module )
    {
        module.exports = window.SimpleCCM;
    }
} )( window ); // jshint ignore:line
