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
 * Globally referable name in the application window's context
 */
const globalName = "gFlashGestures";

const stylesheetURL = "chrome://flashgestures/skin/main.css";

/**
 * Exported app integration functions.
 * @class
 */
let AppIntegration = {
  init: function(data, unlist) {
    loadStylesheet();
    
    if (Hook.initialized) {
      // Listen for pref changes
      Prefs.addListener(function(name) {
        if (name == "enabled")
          AppIntegration.reloadPrefs();
      });
    }
    
    forEachOpenWindow(this.addWindow, this);
    Services.wm.addListener(WindowListener);

    unlist.push([this.uninit, this]);
  },
  
  uninit: function() {
    Services.wm.removeListener(WindowListener);
    forEachOpenWindow(this.removeWindow, this);

    unloadStylesheet();
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
    
    updateHookState();
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
      this.window.removeEventListener("mousedown", this._onMouseDown, true);
      this.window.removeEventListener("focus", onFocus, true);
      this._listenersAdded = false;
    }
  },
  
  _addToolbarButton: function() {
    let button = this._toggleButton = this.CE("toolbarbutton");
    button.setAttribute("id", "flashgestures-toggle-button");
    button.setAttribute("label","Flash Gestures");
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

function loadStylesheet() {
  let styleSheetService= Components.classes["@mozilla.org/content/style-sheet-service;1"]
                                   .getService(Components.interfaces.nsIStyleSheetService);
  let styleSheetURI = Services.io.newURI(stylesheetURL, null, null);
  styleSheetService.loadAndRegisterSheet(styleSheetURI, styleSheetService.AUTHOR_SHEET);
}

function unloadStylesheet() {
  let styleSheetService = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                                    .getService(Components.interfaces.nsIStyleSheetService);
  let styleSheetURI = Services.io.newURI(stylesheetURL, null, null);
  if (styleSheetService.sheetRegistered(styleSheetURI, styleSheetService.AUTHOR_SHEET)) {
      styleSheetService.unregisterSheet(styleSheetURI, styleSheetService.AUTHOR_SHEET);
  }  
}

let timers = [];

function clearPendingTimers() {
  timers.forEach(function(timer) {
    Utils.cancelAsyncTimeout(timer);
  });
  timers = [];
}

let previousHookState = Prefs.enabled;

function updateHookState() {
  if (Prefs.enabled == previousHookState)
    return;
  previousHookState = Prefs.enabled;
  if (Prefs.enabled) {
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
  if (!Prefs.enabled) return;
  
  let target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent && target.hasRunningPlugin) {
    let evt = copyMouseEvent(this.window, event);
    
    if (event.buttons & 0x2) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    getSafeParent(target).dispatchEvent(evt);
  }  
}
