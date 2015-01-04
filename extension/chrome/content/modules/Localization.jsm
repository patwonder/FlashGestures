/*
This file is part of Flash Gestures.

Flash Gestures is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Flash Gestures is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Flash Gestures.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @fileOverview Handles localization
 */
 
var EXPORTED_SYMBOLS = ["Localization", "L10n"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let L10n;
let Localization = L10n = {
  init: function(data, unlist) {
    XPCOMUtils.defineLazyGetter(this, "_strings", function() {
      let bundleURL = "chrome://flashgestures/locale/global.properties"
                    + "?" + Math.random();
      return Services.strings.createBundle(bundleURL);
    });
  
    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    // no need to call Services.strings.flushBundles since we send
    // "chrome-flush-caches" global observer topic on shutdown
  },
  
  getString: function(name) {
    return this._strings.GetStringFromName(name);
  },
};
