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
 * @fileOverview Manages Flash Gestures preferences.
 */

var EXPORTED_SYMBOLS = ["Prefs"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import(moduleURIPrefix + "Utils.jsm");

const prefRoot = "extensions.flashgestures.";
const prefsURL = "chrome://flashgestures/content/preferences/FlashGestures.js";

function initDefaultPrefs() {
  let defaultPrefs = Services.prefs.getDefaultBranch("");
  let prefs = Services.prefs;
  let prefLoaderScope = {
    pref: function(key, val) {
      if (val === undefined) return;
      
      switch (typeof val) {
      case "boolean":
        defaultPrefs.setBoolPref(key, val);
        break;
      case "number":
        defaultPrefs.setIntPref(key, val);
        break;
      case "string":
        defaultPrefs.setCharPref(key, val);
        break;
      }
    },
    user: function(key, val) {
      if (val === undefined) return;
      
      switch (typeof val) {
      case "boolean":
        prefs.setBoolPref(key, val);
        break;
      case "number":
        prefs.setIntPref(key, val);
        break;
      case "string":
        prefs.setCharPref(key, val);
        break;
      }
    },
    read: function(key) {
      if (!prefs.prefHasUserValue(key))
        return undefined;
    
      let type = prefs.getPrefType(key);
      switch (type) {
      case Ci.nsIPrefBranch.PREF_INT:
        return prefs.getIntPref(key);
      case Ci.nsIPrefBranch.PREF_BOOL:
        return prefs.getBoolPref(key);
      case Ci.nsIPrefBranch.PREF_STRING:
        return prefs.getComplexValue(name, Ci.nsISupportsString).data;
      default:
        return undefined;
      }
    },
    kill: function(key) {
      prefs.clearUserPref(key);
    }
  };
  Services.scriptloader.loadSubScript(prefsURL, prefLoaderScope);
}

/**
 * Preferences branch containing Flash Gestures preferences.
 * @type nsIPrefBranch
 */
let branch = Services.prefs.getBranch(prefRoot);

/**
 * List of listeners to be notified whenever preferences are updated
 * @type Array of Function
 */
let globalListeners = [];

/**
 * Map of list of listeners to be notified whenever preferences are updated
 * @type Map from String (pref name) to Array of Function
 */
let prefChangeListenersMap = Object.create(null);

/**
 * List of custom listeners to be notified whenever a custom evaluator returned a new value
 * @type Array of CustomListener objects
 */
let customListeners = [];

function CustomListener(value, evaluator, handler) {
  this.value = value;
  this.evaluator = evaluator;
  this.handler = handler;
}

/**
 * This object allows easy access to Flash Gestures' preferences, all defined
 * preferences will be available as its members.
 * @class
 */
let Prefs = {
  init: function(data, unlist) {
    initDefaultPrefs();
    
    this._initPrefList();
    registerObservers();
    
    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    unregisterObservers();
  },
  
  _initPrefList: function() {
    let defaultBranch = this.defaultBranch;
    for each (let name in defaultBranch.getChildList("", {})) {
      let type = defaultBranch.getPrefType(name);
      switch (type) {
      case Ci.nsIPrefBranch.PREF_INT:
        defineIntegerProperty(name);
        break;
      case Ci.nsIPrefBranch.PREF_BOOL:
        defineBooleanProperty(name);
        break;
      case Ci.nsIPrefBranch.PREF_STRING:
        defineStringProperty(name);
        break;
      }
      if ("_update_" + name in PrefsPrivate)
        PrefsPrivate["_update_" + name]();
    }
  },

  /**
   * Adds a preferences listener that will be fired whenever preferences are
   * reloaded
   */
  addListener: function(/**Function*/ listener) {
    let index = globalListeners.indexOf(listener);
    if (index < 0)
      globalListeners.push(listener);
  },
  
  /**
   * Removes a preferences listener
   */
  removeListener: function(/**Function*/ listener) {
    let index = globalListeners.indexOf(listener);
    if (index >= 0)
      globalListeners.splice(index, 1);
  },

  /**
   * Retrieves the preferences branch containing default preference values.
   */
  get defaultBranch() /**nsIPreferenceBranch*/ {
    return Services.prefs.getDefaultBranch(prefRoot);
  },
  
  /**
   * Reset a pref to its default value.
   */
  reset: function(name) {
    let defaultBranch = this.defaultBranch;
    let type = defaultBranch.getPrefType(name);
    switch (type) {
    case Ci.nsIPrefBranch.PREF_INT:
      this[name] = defaultBranch.getIntPref(name);
      break;
    case Ci.nsIPrefBranch.PREF_BOOL:
      this[name] = defaultBranch.getBoolPref(name);
      break;
    case Ci.nsIPrefBranch.PREF_STRING:
      this[name] = defaultBranch.getComplexValue(name, Ci.nsISupportsString).data;
      break;
    }
  },
  
  /**
   * Register a handler that handles pref changing events
   */
  registerPrefChangeHandler: function(name, handler) {
    if (this.defaultBranch.getPrefType(name) === Ci.nsIPrefBranch.PREF_INVALID)
      throw new Exception("Cannot register pref change handler for non-existing prefs.");
    
    let listeners = prefChangeListenersMap[name] || (prefChangeListenersMap[name] = []);
    listeners.push(handler);
  },
  
  /**
   * Unregister a previously-registered pref change handler
   */
  unregisterPrefChangeHandler: function(name, handler) {
    let listeners = prefChangeListenersMap[name];
    if (listeners)
      Utils.removeOneItem(listeners, handler);
  },
  
  /**
   * Register a handler that handles custom pref changing events
   * @param evaluator - a custom evaluator function. When the return value of this function
   * changes, the handler is invoked.
   */
  registerCustomPrefChangeHandler: function(evaluator, handler) {
    let originalValue = evaluator();
    customListeners.push(new CustomListener(originalValue, evaluator, handler));
  },
  
  /**
   * Unregister a previously-registered custom pref change handler
   */
  unregisterCustomPrefChangeHandler: function(evaluator, handler) {
    for (let i = 0, l = customListeners.length; i < l; i++) {
      if (customListeners[i].evaluator === evaluator && customListeners[i].handler === handler) {
        customListeners.splice(i, 1);
        break;
      }
    }
  },
};

/**
 * Private nsIObserver implementation
 * @class
 */
let PrefsPrivate = {
  /**
   * If set to true notifications about preference changes will no longer cause
   * a reload. This is to prevent unnecessary reloads while saving.
   * @type Boolean
   */
  ignorePrefChanges: false,

  /**
   * nsIObserver implementation
   */
  observe: function(subject, topic, data) {
    if (topic == "nsPref:changed" && !this.ignorePrefChanges && "_update_" + data in PrefsPrivate)
      PrefsPrivate["_update_" + data]();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver]),
};

/**
 * Adds observers to keep various properties of Prefs object updated.
 */
function registerObservers() {
  // Observe preferences changes
  try {
    branch.addObserver("", PrefsPrivate, true);
  } catch (e) {
    Cu.reportError(e);
  }
}

function unregisterObservers() {
  try {
    branch.removeObserver("", PrefsPrivate);
  } catch (e) {
    Cu.reportError(e);
  }
}

/**
 * Triggers preference listeners whenever a preference is changed.
 */
function triggerListeners(/**String*/ name) {
  globalListeners.slice().forEach(function(listener) {
    try {
      listener(name);
    } catch (ex) {
      Utils.ERROR("Failed to call listeners for Prefs." + name + ": " + ex);
    }
  });
  let prefChangeListeners = prefChangeListenersMap[name];
  if (prefChangeListeners) {
    prefChangeListeners.slice().forEach(function(listener) {
      try {
        listener(Prefs[name]);
      } catch (ex) {
        Utils.ERROR("Failed to call pref change listeners for Prefs." + name + ": " + ex);
      }
    });
  }
  customListeners.slice().forEach(function(customListener) {
    let newValue = customListener.evaluator();
    if (newValue !== customListener.value) {
      customListener.value = newValue;
      try {
        customListener.handler(newValue);
      } catch (ex) {
        Utils.ERROR("Failed to call custom pref change listeners for Prefs." + name + ": " + ex);
      }
    }
  });
}

/**
 * Sets up getter/setter on Prefs object for preference.
 */
function defineProperty(/**String*/ name, defaultValue, /**Function*/ readFunc, /**Function*/ writeFunc) {
  let value = defaultValue;
  PrefsPrivate["_update_" + name] = function() {
    try {
      value = readFunc();
      triggerListeners(name);
    } catch(ex) {
      Utils.ERROR("Prefs." + name + " _update_ exception: " + ex);
    }
  }
  Object.defineProperty(Prefs, name, {
    get: function() value,
    set: function(newValue) {
      if (value == newValue)
        return value;

      try {
        PrefsPrivate.ignorePrefChanges = true;
        writeFunc(newValue);
        value = newValue;
        triggerListeners(name);
      } catch(ex) {
        Utils.ERROR("Prefs." + name + " setter exception: " + ex);
      } finally {
        PrefsPrivate.ignorePrefChanges = false;
      }
      return value;
    },
    enumerable: true,
    configurable: true
  });
}

/**
 * Sets up getter/setter on Prefs object for an integer preference.
 */
function defineIntegerProperty(/**String*/ name) {
  defineProperty(name, 0, function() branch.getIntPref(name),
                          function(newValue) branch.setIntPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a boolean preference.
 */
function defineBooleanProperty(/**String*/ name) {
  defineProperty(name, false, function() branch.getBoolPref(name),
                              function(newValue) branch.setBoolPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a string preference.
 */
function defineStringProperty(/**String*/ name) {
  defineProperty(name, "", function() branch.getComplexValue(name, Ci.nsISupportsString).data,
    function(newValue) {
      let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      str.data = newValue;
      branch.setComplexValue(name, Ci.nsISupportsString, str);
    });
}
