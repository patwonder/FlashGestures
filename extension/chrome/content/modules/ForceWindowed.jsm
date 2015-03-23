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
 * @fileOverview Determines on which sites plugins should be forced into windowed mode.
 */
 
var EXPORTED_SYMBOLS = ["ForceWindowed"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import(moduleURIPrefix + "Prefs.jsm");
Cu.import(moduleURIPrefix + "Utils.jsm");

let hostWhitelist = null;

let ForceWindowed = {
  init: function(data, unlist) {
    Prefs.registerPrefChangeHandler("forceWindowedWhitelist", function(val) {
      this.initWhitelist(val);
    }.bind(this));
    
    this.initWhitelist(Prefs.forceWindowedWhitelist);
    
    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    
  },
    
  initWhitelist: function(whitelist) {
    hostWhitelist = Object.create(null);
    
    let hosts = whitelist.split(/\s+/);
    hosts.forEach(function(host) {
      if (!Utils.isValidHostname(host))
        return;
      
      hostWhitelist[host] = true;
    });
  },
  
  enabledOnURL: function(url) {
    let host = Utils.getHostname(url);
    return this.enabledOnHost(host);
  },
  
  enabledOnHost: function(host) {
    let effHost = Utils.getEffectiveHost(host);
    while (host && host.length >= effHost.length) {
      if (hostWhitelist[host])
        return false;
      
      let idxDot = host.indexOf(".");
      host = (idxDot >= 0) ? host.substring(idxDot + 1) : null;
    }
    
    return true;
  },
};
