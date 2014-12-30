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
   * Keep track of registered mouseup listeners
   */
  _onMouseUpListeners: [],
  
  /**
   * Inject stuff into the wrapped window
   */
  load: function() {
    if (!Hook.initialized) return;
    this.window.addEventListener("focus", onFocus, true);
    this.window.addEventListener("mousedown", this._onMouseDown = onMouseDown.bind(this), true);
    this.window.addEventListener("mouseup", this._onMouseUp = onMouseUp.bind(this), true);
    this.window.addEventListener("PluginInstantiated", onPluginEvent, true);
    this._listenersAdded = true;
    
    Utils.LOG("Doing initial hooking.");
    Hook.install();
  },
  
  /**
   * Remove stuff from the wrapped window
   */
  unload: function() {
    if (!this._listenersAdded) return;
    this.window.removeEventListener("PluginInstantiated", onPluginEvent, true);
    this.window.removeEventListener("mouseup", this._onMouseUp, true);
    this.window.removeEventListener("mousedown", this._onMouseDown, true);
    this.window.removeEventListener("focus", onFocus, true);
    this._listenersAdded = false;
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
  if (target instanceof Ci.nsIObjectLoadingContent && target.hasRunningPlugin) {
    Utils.LOG("Fixing window focus...");
    Hook.blurAndFocus(target);
  }
}

// some <embed>'s parent may be <object>
function getSafeParent(target) {
  let parent = target.parentElement;
  while (parent instanceof Ci.nsIObjectLoadingContent)
    parent = parent.parentElement;
  
  return parent;
}

function copyMouseEvent(window, event) {
  return new window.MouseEvent(event.type, {
    screenX: event.screenX, screenY: event.screenY,
    clientX: event.clientX, clientY: event.clientY,
    ctrlKey: event.ctrlKey, shiftKey: event.shiftKey,
    altKey: event.altKey, metaKey: event.metaKey,
    button: event.button, buttons: event.buttons,
    detail: event.detail, view: event.view,
    bubbles: event.bubbles, cancelable: event.cancelable
  });
}

function onMouseDown(event) {
  if (this._onMouseDownSimulating) return;
  var target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent && target.hasRunningPlugin) {
    let evt = copyMouseEvent(this.window, event);
    
    if (event.buttons & 0x2) {
      // For right clicks, we create a shadow event that is dispatched 
      // to the original target if the following conditions are met:
      // 1) a corresponding mouseup event is fired within 500ms
      // 2) the mouseup event is fired on the target
      // 3) the mouseup event is fired at a position close to the original event
      const IntervalThreshold = 500;
      const DistanceThreshold = 10;

      Utils.LOG("mousedown rightbutton");
      let pendingEvent = copyMouseEvent(this.window, event);

      let cancelTimer = null;

      let onMouseUp = function(upEvent) {
        if (upEvent.button !== 2) return;        
        
        Utils.LOG("mouseup rightbutton");
        Utils.removeOneItem(this._onMouseUpListeners, onMouseUp);
        Utils.cancelAsyncTimeout(cancelTimer);
        
        if (upEvent.target === target && Math.abs(pendingEvent.clientX - upEvent.clientX) +
            Math.abs(pendingEvent.clientY - upEvent.clientY) <= DistanceThreshold)
        {
          pendingEvent.screenX = upEvent.screenX;
          pendingEvent.screenY = upEvent.screenY;
          pendingEvent.clientX = upEvent.clientX;
          pendingEvent.clientY = upEvent.clientY;
          this._onMouseDownSimulating = true;
          try {
            target.dispatchEvent(pendingEvent);
          } finally {
            this._onMouseDownSimulating = false;
          }
        }
      }.bind(this);
      this._onMouseUpListeners.push(onMouseUp);

      cancelTimer = Utils.runAsyncTimeout(function() {
        Utils.LOG("cancel mouseup listener");
        Utils.removeOneItem(this._onMouseUpListeners, onMouseUp);
      }, this, IntervalThreshold);
      
      event.preventDefault();
      event.stopPropagation();
    }
    
    getSafeParent(target).dispatchEvent(evt);
  }
}

function onMouseUp(event) {
  this._onMouseUpListeners.slice().forEach(function(listener) {
    try {
      listener(event);
    } catch (ex) {
      Utils.ERROR(ex);
    }
  });
}

init();
