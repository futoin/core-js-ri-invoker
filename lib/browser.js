
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


( function( window ) {
    'use strict';

    var futoin = window.FutoIn || window.futoin || {};

    if ( typeof futoin.Invoker === 'undefined' )
    {
        var FutoInInvoker = require( './invoker' );
        var SimpleCCM = FutoInInvoker.SimpleCCM;
        var AdvancedCCM = FutoInInvoker.AdvancedCCM;


        /**
         * **window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM
         * @global
         * @name window.SimpleCCM
         */
        window.SimpleCCM = SimpleCCM;

        /**
         * **futoin.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM
         * @global
         * @name futoin.SimpleCCM
         */
        futoin.SimpleCCM = SimpleCCM;

        /**
         * **window.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM
         * @global
         * @name window.AdvancedCCM
         */
        window.AdvancedCCM = AdvancedCCM;

        /**
         * **futoin.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM
         * @global
         * @name futoin.AdvancedCCM
         */
        futoin.AdvancedCCM = AdvancedCCM;

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
        window.futoin = futoin;
    }

    if ( typeof module !== 'undefined' ) {
        module.exports = futoin.Invoker;
    }
} )( window );
