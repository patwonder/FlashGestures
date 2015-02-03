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
 * @fileOverview Module containing a bunch of utility functions.
 */

var EXPORTED_SYMBOLS = ["Utils"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let Utils = {
  /** nsITimer's */
  _timers: [],
  
  /** throttled updates */
  _throttledUpdates: new WeakMap(),
  
  _addonVersion: "0.1",
  _installPath: "",
  
  init: function(data, unlist) {
    this._addonVersion = data.version;
    this._installPath = data.installPath.path;
    
    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    // removes any remaining async calls
    this._cancelAllAsyncTimeouts();
  },
  
  /**
   * Whether running in 64bit environment.
   */
  get is64bit() {
    return Services.appinfo.XPCOMABI.indexOf('64') != -1;
  },
  
  get addonVersion() {
    return this._addonVersion;
  },
  
  get installPath() {
    return this._installPath;
  },
  
  get dllPath() {
    return this.installPath + "\\binaries\\FlashGesturesHook" +
      (this.is64bit ? "64" : "32") + ".dll"
  },

  get browserUrl() {
    return "chrome://browser/content/browser.xul";
  },
  
  /**
   * Attempts to find a browser window for opening a URL
   */
  findAnyBrowserWindow: function() {
    let enumerator = Services.wm.getZOrderDOMWindowEnumerator(null, true);
    while (enumerator.hasMoreElements()) {
      let window = enumerator.getNext();
      if (window.gBrowser && window.gBrowser.addTab) {
        return window;
      }
    }
    return null;
  },

  /**
   * Attempts to find a browser object for opening a URL
   */
  findAnyBrowser: function() {
    let window = Utils.findAnyBrowserWindow();
    if (window)
      return window.gBrowser;
    return null;
  },
  
  /**
   * Opens a URL in the browser window. If browser window isn't passed as parameter,
   * this function attempts to find a browser window.
   */
  loadInBrowser: function( /**String*/ url, /**Browser*/ browser) {
    let gBrowser = browser || Utils.findAnyBrowser();

    if (gBrowser) {
      gBrowser.selectedTab = gBrowser.addTab(url);
    } else {
      // open a new window and try again
      win = Services.ww.openWindow(null, Utils.browserUrl, null, null, null);
      win.addEventListener("load", function() {
        Utils.runAsyncTimeout(Utils.loadInBrowser, Utils, 100, url, win.gBrowser);
      });
    }
  },

  // Removes the first occurance of item in arr
  removeOneItem: function(arr, item) {
    let idx = arr.indexOf(item);
    if (idx != -1)
      arr.splice(idx, 1);
  },

  // Removes all occurances of item in arr
  removeAllItems: function(arr, item) {
    let idx = arr.indexOf(item);
    while (idx != -1) {
      arr.splice(idx, 1);
      idx = arr.indexOf(item);
    }
  },
  
  /**
   * Posts an action to the event queue of the current thread to run it
   * asynchronously. Any additional parameters to this function are passed
   * as parameters to the callback.
   */
  runAsync: function( /**Function*/ callback, /**Object*/ thisPtr) {
    let params = Array.prototype.slice.call(arguments, 2);
    let runnable = {
      run: function() {
        callback.apply(thisPtr, params);
      }
    };
    Services.tm.currentThread.dispatch(runnable, Ci.nsIEventTarget.DISPATCH_NORMAL);
  },
  
  /**
   * Posts an action to the event queue of the current thread to run it
   * asynchronously, after a specified timeout. (Just like setTimeout)
   * Any additional parameters, in addition to the returned nsITimer as
   * the last argument, are passed as parameters to the callback.
   */
  runAsyncTimeout: function( /**Function*/ callback, /**Object*/ thisPtr, /**Number*/ timeout) /**nsITimer*/ {
    let params = Array.prototype.slice.call(arguments, 3);
    let event = {
      notify: function(timer) {
        this.removeOneItem(this._timers, timer);
        callback.apply(thisPtr, params);
      }.bind(this)
    };
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(event, timeout, Ci.nsITimer.TYPE_ONE_SHOT);
    params.push(timer);
    this._timers.push(timer);
    return timer;
  },
  
  /**
   * Cancels previous runAsyncTimeout operation
   */
  cancelAsyncTimeout: function( /**nsITimer*/ timer) {
    if (timer) {
      timer.cancel();
      this.removeOneItem(this._timers, timer);
    }
  },
  
  _cancelAllAsyncTimeouts: function() {
    this._timers.forEach(function(timer) {
      timer.cancel();
    });
    this._timers = [];
  },

  _doThrottledUpdate: function(update, updateFunc, thisPtr) {
    update.delaying = false;
    if (update.scheduled) {
      update.scheduled = false;
      update.updating = true;
      try {
        updateFunc.call(thisPtr);
      } finally {
        update.updating = false;
        update.delaying = true;
        update.scheduled = false;
        Utils.runAsyncTimeout(this._doThrottledUpdate, this, 100,
                              update, updateFunc, thisPtr);
      }
    }
  },
  
  /**
   * Schedule throttled (no 2 updates shall happen within 100 ms) updates
   */
  scheduleThrottledUpdate: function(updateFunc, thisPtr) {
    // Fetch the corresponding update object
    let thisPtrUpdates = this._throttledUpdates.get(thisPtr);
    if (!thisPtrUpdates)
      this._throttledUpdates.set(thisPtr, thisPtrUpdates = new WeakMap());
    let update = thisPtrUpdates.get(updateFunc);
    if (!update)
      thisPtrUpdates.set(updateFunc, update = {});
    
    // Do schedule
    if (update.updating || update.scheduled)
      return;
    
    update.scheduled = true;
    if (!update.delaying)
    {
      update.delaying = true;
      Utils.runAsync(this._doThrottledUpdate, this,
                     update, updateFunc, thisPtr);
    }
  },
};

/**
 * Set the value of preference "extensions.logging.enabled" to false to hide
 * Utils.LOG message
 */
["LOG", "WARN", "ERROR"].forEach(function(aName) {
  XPCOMUtils.defineLazyGetter(Utils, aName, function() {
    let jsm = {};
    try {
      Cu.import("resource://gre/modules/AddonLogging.jsm", jsm);
      if (!jsm.LogManager)
        throw "LogManager not found in resource://gre/modules/AddonLogging.jsm";
    } catch (e) {
      // Nightly 20140225
      Cu.import("resource://gre/modules/addons/AddonLogging.jsm", jsm);
      if (!jsm.LogManager)
        throw "LogManager not found in resource://gre/modules/(addons/)AddonLogging.jsm";
    }
    let logger = {};
    jsm.LogManager.getLogger("[FlashGestures]", logger);
    return logger[aName];
  });
});
