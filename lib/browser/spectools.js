"use strict";

/**
 * @file
 *
 * Copyright 2014-2018 FutoIn Project (https://futoin.org)
 * Copyright 2014-2018 Andrey Galkin <andrey@futoin.org>
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

module.exports = ( spectools ) => {
    const ST = spectools;

    //=================================
    // Browser extensions
    //=================================

    const _loadURL = ( as, base_url, file_name ) => {
        // Check remote URL in browser
        as.add( ( as ) => {
            const uri = `${base_url}/${file_name}`;

            const httpreq = new XMLHttpRequest();

            httpreq.onreadystatechange = function() {
                if ( this.readyState !== this.DONE ) {
                    return;
                }

                const response = this.responseText;

                if ( ( this.status === 200 ) && response ) {
                    try {
                        const res = JSON.parse( response );
                        as.success( res );
                        return;
                    } catch ( e ) {
                        spectools.emit(
                            'error',
                            `Invalid JSON for '${uri}": ${e}`
                        );

                        try {
                            as.break();
                        } catch ( _ ) {
                            // pass
                        }
                    }
                }

                try {
                    as.continue();
                } catch ( ex ) {
                    // ignore
                }
            };

            httpreq.open( "GET", uri, true );
            httpreq.send();

            as.setCancel( ( as ) => {
                httpreq.abort();
            } );
        } );
    };

    const _validateBySchema = () => {};

    //=================================
    Object.assign( ST, {
        _loadURL,
        _validateBySchema,
        enableSchemaValidator : _validateBySchema,
    } );
};
