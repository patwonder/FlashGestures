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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import(moduleURIPrefix + "Utils.jsm");
Cu.import(moduleURIPrefix + "Hook.jsm");
Cu.import(moduleURIPrefix + "Prefs.jsm");
Cu.import(moduleURIPrefix + "PersistUI.jsm");
Cu.import(moduleURIPrefix + "Localization.jsm");

/**
 * Wrappers for tracked application windows.
 * @type Array of WindowWrapper
 */
let wrappers = [];

/**
 * Timers from Utils.runAsyncTimeout
 * @type Array of nsITimer
 */
let timers = [];

/**
 * Globally referable name in the application window's context
 */
const globalName = "gFlashGestures";

const stylesheetURL = "chrome://flashgestures/skin/main.css";
const forceWindowedStylesheetURL = "chrome://flashgestures/content/forceWindowed.css";

/**
 * Exported app integration functions.
 * @class
 */
let AppIntegration = {
  init: function(data, unlist) {
    loadStylesheet(stylesheetURL);
    
    if (Hook.initialized) {
      // Listen for pref changes
      Prefs.addListener(function(name) {
        if (name == "enabled")
          AppIntegration.reloadPrefs();
      });
      registerPrefChangeHandlers();
      // Register forceWindowed.css only if hook is initialized
      if (Prefs.enabled && Prefs.forceWindowed) {
        Utils.LOG("Registering forceWindowed.css...");
        loadStylesheet(forceWindowedStylesheetURL);
      }
    }
    
    forEachOpenWindow(this.addWindow, this);
    Services.wm.addListener(WindowListener);

    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    Services.wm.removeListener(WindowListener);
    forEachOpenWindow(this.removeWindow, this);

    if (Hook.initialized && Prefs.enabled && Prefs.forceWindowed) {
      Utils.LOG("Unregistering forceWindowed.css...");
      unloadStylesheet(forceWindowedStylesheetURL);
    }
    unloadStylesheet(stylesheetURL);
  },
  
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
  
  /**
   * Updates displayed status for all application windows (on prefs or rules
   * change).
   */
  reloadPrefs: function() {
    wrappers.forEach(function (wrapper) {
      wrapper.updateState();
    });
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
   * Keep track of registered mouseup/mousemove listeners
   */
  _onMouseUpListeners: [],
  _onMouseMoveListeners: [],
  
  /**
   * Shorthand for getElementById
   */
  E: function(id) {
    let doc = this.window.document;
    this.E = function(id) doc.getElementById(id);
    return this.E(id);
  },
  
  /**
   * Shorthand for createElementNS
   */
  CE: function(tag) {
    return this.window.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", tag);
  },
  
  /**
   * Inject stuff into the wrapped window
   */
  load: function() {
    try {
      this._addToolbarButton();
    } catch (ex) {
      Utils.ERROR("Failed to add toolbar button: " + ex);
    }
    this.updateInterface();
    
    if (Hook.initialized) {
      this.window.addEventListener("focus", onFocus, true);
      this.window.addEventListener("mousedown", this._onMouseDown = onMouseDown.bind(this), true);
      this.window.addEventListener("mouseup", this._onMouseUp = onMouseUp.bind(this), true);
      this.window.addEventListener("mousemove", this._onMouseMove = onMouseMove.bind(this), true);
      this.window.addEventListener("PluginInstantiated", this._onPluginEvent = onPluginEvent.bind(this), true);
      this._listenersAdded = true;
      
      if (Prefs.enabled) {
        Utils.LOG("Doing initial hooking...");
        Hook.install();
        this.checkAndFixFocus();
      }
    }
  },
  
  /**
   * Remove stuff from the wrapped window
   */
  unload: function() {
    try {
      this._removeToolbarButton();
    } catch (ex) {
      Utils.ERROR("Failed to remove toolbar button: " + ex);
    }
    if (this._listenersAdded) {
      this.window.removeEventListener("PluginInstantiated", this._onPluginEvent, true);
      this.window.removeEventListener("mousemove", this._onMouseMove, true);
      this.window.removeEventListener("mouseup", this._onMouseUp, true);
      this.window.removeEventListener("mousedown", this._onMouseDown, true);
      this.window.removeEventListener("focus", onFocus, true);
      this._listenersAdded = false;
    }
  },
  
  _addToolbarButton: function() {
    let button = this._toggleButton = this.CE("toolbarbutton");
    button.setAttribute("id", "flashgestures-toggle-button");
    button.setAttribute("label", L10n.getString("togglebutton.label"));
    button.className = "toolbarbutton-1 chromeclass-toolbar-additional";
    button.setAttribute("oncommand", globalName + ".toggle()");
    button.setAttribute("tooltip", "flashgestures-toggle-button-tooltip")
      
    let tooltip = this._toggleButtonTooltip = this.CE("tooltip");
    tooltip.setAttribute("id", "flashgestures-toggle-button-tooltip");
    tooltip.setAttribute("noautohide", "true");
    let label = this._toggleButtonTooltip1 = this.CE("label");
    label.setAttribute("id", "flashgestures-toggle-button-tooltip1");
    tooltip.appendChild(label);
    this.E("nav-bar").appendChild(tooltip);

    Utils.runAsync(function() {
      if (!Prefs.toggleButtonAdded) {
        this._addButtonToNavBar();
        Prefs.toggleButtonAdded = true;
      } else {
        PersistUI.restorePosition(this.window.document, this._toggleButton, "navigator-toolbox");
      }
    }, this);
  },
  
  _addButtonToNavBar: function() {
    PersistUI.setDefaultPosition("flashgestures-toggle-button", "nav-bar", null);
    PersistUI.restorePosition(this.window.document, this._toggleButton, "navigator-toolbox");
    PersistUI.clearDefaultPosition("flashgestures-toggle-button");
  },
  
  _removeToolbarButton: function() {
    let button = this._toggleButton;
    if (button)
      button.parentElement.removeChild(button);
    let tooltip = this._toggleButtonTooltip;
    if (tooltip)
      tooltip.parentElement.removeChild(tooltip);
  },
  
  toggle: function() {
    if (Hook.initialized)
      Prefs.enabled = !Prefs.enabled;
  },
  
  updateState: function() {
    this.updateInterface();
  },
  
  updateInterface: function() {
    Utils.scheduleThrottledUpdate(this._updateInterfaceCore, this);
  },
  
  _updateInterfaceCore: function() {
    let button = this._toggleButton;
    if (button) {
      let state = Hook.initialized && Prefs.enabled;
      button.classList.toggle("hook-enabled", state);
      button.disabled = !Hook.initialized;
      
      let tooltip = this._toggleButtonTooltip1;
      if (!Hook.initialized) {
        tooltip.setAttribute("value", L10n.getString("tooltip.failToLoad"));
      } else if (state) {
        tooltip.setAttribute("value", L10n.getString("tooltip.enabled"));
      } else {
        tooltip.setAttribute("value", L10n.getString("tooltip.disabled"));
      }
    }
  },
  
  checkAndFixFocus: function() {
    let cd = this.window.document.commandDispatcher;
    if (cd) {
      let focused = cd.focusedElement;
      if (focused instanceof Ci.nsIObjectLoadingContent) {
        // Bypass the running plugin check here as this function
        // will only be called limited times.
        Utils.LOG("Focus seems incorrect, fixing it...");
        Hook.blurAndFocus(focused);
      }
    }
  },
};

// Apply a function to all open browser windows
function forEachOpenWindow(todo, thisPtr) {
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements())
    todo.call(thisPtr, windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow));
}

let WindowListener = {
  onOpenWindow: function(xulWindow) {
    let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    function onWindowLoad() {
      window.removeEventListener("load", onWindowLoad);
      if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
        AppIntegration.addWindow(window);
    }
    window.addEventListener("load", onWindowLoad);
  },
  onCloseWindow: function(xulWindow) {
    let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
      AppIntegration.removeWindow(window);
  },
  onWindowTitleChange: function(xulWindow, newTitle) { }
};

function loadStylesheet(url) {
  let styleSheetService= Components.classes["@mozilla.org/content/style-sheet-service;1"]
                                   .getService(Components.interfaces.nsIStyleSheetService);
  let uri = Services.io.newURI(url, null, null);
  styleSheetService.loadAndRegisterSheet(uri, styleSheetService.AUTHOR_SHEET);
}

function unloadStylesheet(url) {
  let styleSheetService = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                                    .getService(Components.interfaces.nsIStyleSheetService);
  let uri = Services.io.newURI(url, null, null);
  if (styleSheetService.sheetRegistered(uri, styleSheetService.AUTHOR_SHEET)) {
      styleSheetService.unregisterSheet(uri, styleSheetService.AUTHOR_SHEET);
  }  
}

function clearPendingTimers() {
  timers.forEach(function(timer) {
    Utils.cancelAsyncTimeout(timer);
  });
  timers = [];
}

function updateHookState(newState) {
  if (newState) {
    Utils.LOG("Installing hooks... (prefs enable)");
    Hook.install();
    wrappers.forEach(function (wrapper) {
      wrapper.checkAndFixFocus();
    });
  } else {
    Utils.LOG("Uninstalling hooks... (prefs disable)");
    Hook.uninstall();
  }
}

function updateForceWindowedState(newState) {
  if (newState) {
    Utils.LOG("Registering forceWindowed.css...");
    loadStylesheet(forceWindowedStylesheetURL);
  } else {
    Utils.LOG("Unregistering forceWindowed.css...");
    unloadStylesheet(forceWindowedStylesheetURL);
  }
}

function registerPrefChangeHandlers() {
  Prefs.registerPrefChangeHandler("enabled", updateHookState);
  Prefs.registerCustomPrefChangeHandler(function() Prefs.enabled && Prefs.forceWindowed,
    updateForceWindowedState);
}

function hasRunningPlugin(plugin) {
  if (plugin.hasRunningPlugin || typeof(plugin.hasRunningPlugin) === "boolean")
    return !!plugin.hasRunningPlugin;
  return true;
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
      if (Prefs.enabled) {
        Utils.LOG("Doing async hooking, timeout = " + timeout);
        Hook.install();
      }
    }, null, timeout, timeout));
  }
  
  // Should also fix focus (due to click-to-play)
  if (Prefs.enabled)
    this.checkAndFixFocus();
}

function onFocus(event) {
  if (!Prefs.enabled) return;
  
  let target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent && hasRunningPlugin(target)) {
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
  if (this._onMouseDownSimulating || !Prefs.enabled) return;
  
  let target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent) {
    let upperLayerEvent = copyMouseEvent(this.window, event);
    
    if (event.buttons & 0x2) {
      // For right clicks, we create a shadow event that is dispatched 
      // to the original target if the following conditions are met:
      // 1) a corresponding mouseup event is fired within 500ms
      // 2) the mouseup event is fired on the target
      // 3) the mouseup event is fired at a position close to the original event
      const IntervalThreshold = 300;
      const DistanceThreshold = 10;

      let cancelTimer = null;
      let onMouseMoveLocal = null;
      let downClientX = event.clientX;
      let downClientY = event.clientY;

      let onMouseUpLocal = function(upEvent) {
        if (upEvent.button !== 2) return;
        
        Utils.removeOneItem(this._onMouseUpListeners, onMouseUpLocal);
        Utils.removeOneItem(this._onMouseMoveListeners, onMouseMoveLocal);
        Utils.cancelAsyncTimeout(cancelTimer);
        
        if (upEvent.target === target &&
            Math.abs(downClientX - upEvent.clientX) <= DistanceThreshold &&
            Math.abs(downClientY - upEvent.clientY) <= DistanceThreshold)
        {
          upEvent.preventDefault();
          upEvent.stopPropagation();
          let upperLayerUpEvent = copyMouseEvent(this.window, upEvent);
          getSafeParent(target).dispatchEvent(upperLayerUpEvent);
          this._onMouseDownSimulating = true;
          try {
            let domWindowUtils =
              target.ownerDocument.defaultView.QueryInterface(Ci.nsIInterfaceRequestor)
                                              .getInterface(Ci.nsIDOMWindowUtils);
            let x = upEvent.clientX;
            let y = upEvent.clientY;
            domWindowUtils.sendMouseEventToWindow("mousedown", x, y, 2, 1, 0, false);
            domWindowUtils.sendMouseEventToWindow("mouseup", x, y, 2, 1, 0, false);
          } finally {
            this._onMouseDownSimulating = false;
          }
        }
      }.bind(this);
      this._onMouseUpListeners.push(onMouseUpLocal);

      let cancel = function() {
        Utils.removeOneItem(this._onMouseUpListeners, onMouseUpLocal);
        Utils.removeOneItem(this._onMouseMoveListeners, onMouseMoveLocal);
        Utils.cancelAsyncTimeout(cancelTimer);
      }.bind(this);
      
      cancelTimer = Utils.runAsyncTimeout(function() {
        cancel();
      }, this, IntervalThreshold);
      
      onMouseMoveLocal = function(moveEvent) {
        if (Math.abs(downClientX - moveEvent.clientX) <= DistanceThreshold &&
            Math.abs(downClientY - moveEvent.clientY) <= DistanceThreshold)
        return;
        
        cancel();
      };
      this._onMouseMoveListeners.push(onMouseMoveLocal);
      
      event.preventDefault();
      event.stopPropagation();
    }

    getSafeParent(target).dispatchEvent(upperLayerEvent);
  }
}

function onMouseUp(event) {
  this._onMouseUpListeners.slice().forEach(function(listener) {
    try {
      listener(event);
    } catch (ex) {
      Utils.ERROR(ex.stack);
    }
  });
}

function onMouseMove(event) {
  this._onMouseMoveListeners.slice().forEach(function(listener) {
    try {
      listener(event);
    } catch (ex) {
      Utils.ERROR(ex);
    }
  });
}
