
(function( window ){
    'use strict';

    var futoin = window.FutoIn || {};

    if ( typeof futoin.Invoker === 'undefined' )
    {
        var FutoInInvoker = require( './invoker.js' );

        /**
         * **window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM
         * @global
         * @name window.SimpleCCM
         */
        var SimpleCCM = FutoInInvoker.SimpleCCM;
        window.SimpleCCM = SimpleCCM;

        /**
         * **window.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM
         * @global
         * @name window.AdvancedCCM
         */
        var AdvancedCCM = FutoInInvoker.AdvancedCCM;
        window.AdvancedCCM = AdvancedCCM;

        /**
         * **futoin.Invoker** - Browser-only reference to futoin-invoker module
         * @global
         * @name window.FutoIn.Invoker
         */
        futoin.Invoker = FutoInInvoker;

        /**
         * **window.FutoInInvoker** - Browser-only reference to futoin-invoker module
         * @global
         * @name window.FutoInInvoker
         */
        window.FutoInInvoker = FutoInInvoker;

        window.FutoIn = futoin;

        if ( module )
        {
            module.exports = FutoInInvoker;
        }
    }
})( window ); // jshint ignore:line