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
  
  _addonVersion: "0.1",
  _installPath: "",
  
  /**
   * Whether running in 64bit environment.
   */
  get is64bit() {
    return Services.appinfo.XPCOMABI.indexOf('64') != -1;
  },
  
  initData: function(data) {
    this._addonVersion = data.version;
    this._installPath = data.installPath.path;
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
