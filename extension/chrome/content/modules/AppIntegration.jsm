/**
 * @fileOverview Application integration module, will keep track of application
 * windows and handle the necessary events.
 */

 
var EXPORTED_SYMBOLS = ["AppIntegration"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import(moduleURIPrefix + "Utils.jsm");
Cu.import(moduleURIPrefix + "Hook.jsm");

/**
 * Wrappers for tracked application windows.
 * @type Array of WindowWrapper
 */
let wrappers = [];


/**
 * Globally referable name in the application window's context
 */
let globalName = "gFlashGestures";

function init() {
  
}

/**
 * Exported app integration functions.
 * @class
 */
let AppIntegration = {
  /**
   * Adds an application window to the tracked list.
   */
  addWindow: function( /**Window*/ window) /**WindowWrapper*/ {
    let wrapper = new WindowWrapper(window);
    wrappers.push(wrapper);
    window[globalName] = wrapper;
    wrapper.load();
    return wrapper;
  },
  
  /**
   * Removes an application window from the tracked list.
   */
  removeWindow: function( /**Window*/ window) {
    let wrapper = window[globalName];
    if (!wrapper) return;
    wrapper.unload();
    for (let i = 0, l = wrappers.length; i < l; i++) {
      if (wrappers[i].window == window) {
        wrappers.splice(i, 1);
        break;
      }
    }
    delete window[globalName];
  },
  
  /**
   * Retrieves the wrapper object corresponding to a particular application window.
   */
  getWrapperForWindow: function( /**Window*/ window) /**WindowWrapper*/ {
    return window[globalName];
  },
  
  /**
   * Retrieves any available window wrapper
   */
  getAnyWrapper: function() {
    return wrappers.length ? wrapper[0] : null;
  },
};

function WindowWrapper(window) {
  this.window = window;
  this.Utils = Utils;
};

WindowWrapper.prototype = {
  /**
   * Application window this object belongs to.
   * @type Window
   */
  window: null,

  Utils: null,
  
  /**
   * Inject stuff into the wrapped window
   */
  load: function() {
    if (!Hook.initialized) return;
    this.window.addEventListener("focus", onFocus, true);
    this.window.addEventListener("mousedown", this._onMouseDown = onMouseDown.bind(this), true);
    this.window.addEventListener("PluginInstantiated", onPluginEvent, true);
    
    Utils.LOG("Doing initial hooking.");
    Hook.install();
  },
  
  /**
   * Remove stuff from the wrapped window
   */
  unload: function() {
    this.window.removeEventListener("PluginInstantiated", onPluginEvent, true);
    this.window.removeEventListener("mousedown", this._onMouseDown, true);
    this.window.removeEventListener("focus", onFocus, true);
  },
};

let timers = [];

function clearPendingTimers() {
  timers.forEach(function(timer) {
    Utils.cancelAsyncTimeout(timer);
  });
  timers = [];
}

function onPluginEvent(event) {
  // Only handle plugin instantiation events
  if (event.type != "PluginInstantiated")
    return;
  
  let plugin = event.target;
  
  // We're expecting the target to be a plugin.
  if (!(plugin instanceof Ci.nsIObjectLoadingContent))
    return;
  
  // Do async hook installing. The relavant plugin processes should be ready
  // in no more than 10 seconds
  let MaxLoadingTimeMillis = 10000;
  let HookTimeoutStep = 2000;
  clearPendingTimers();
  for (let timeout = 0; timeout <= MaxLoadingTimeMillis; timeout += HookTimeoutStep) {
    timers.push(Utils.runAsyncTimeout(function(timeout, timer) {
      Utils.removeOneItem(timers, timer);
      Utils.LOG("Doing async hooking, timeout = " + timeout);
      Hook.install();
    }, null, timeout, timeout));
  }
}

function onFocus(event) {
  var target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent) {
    Utils.LOG("Fixing window focus...");
    Hook.blurAndFocus(target);
  }
}

function onMouseDown(event) {
  var target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent) {
    let evt = this.window.document.createEvent("MouseEvents");
    evt.initMouseEvent("mousedown", true, true, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, false, false, false, false, event.button, null);
    event.preventDefault();
    event.stopPropagation();
    target.parentNode.dispatchEvent(evt);
  }  
}

init();
