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

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cr = Components.results;
let Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let ContentUtils = {
  /** nsITimer's */
  _timers: [],
  
  // Removes the first occurance of item in arr
  removeOneItem: function(arr, item) {
    let idx = arr.indexOf(item);
    if (idx != -1)
      arr.splice(idx, 1);
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
  
  cancelAllAsyncTimeouts: function() {
    this._timers.forEach(function(timer) {
      timer.cancel();
    });
    this._timers = [];
  },
};

/**
 * Set the value of preference "extensions.logging.enabled" to false to hide
 * Utils.LOG message
 */
["LOG", "WARN", "ERROR"].forEach(function(aName) {
  XPCOMUtils.defineLazyGetter(ContentUtils, aName, function() {
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
    jsm.LogManager.getLogger("[FlashGestures content]", logger);
    return logger[aName];
  });
});

function MsgRet(retArray, defaultValue) {
  if (retArray.length < 1)
    return defaultValue;
  return retArray[0];
}

let prefs = Services.prefs.getBranch("extensions.flashgestures.");

function onPluginInstantiated(event) {
  let plugin = event.target;
  
  // We're expecting the target to be a plugin.
  if (!(plugin instanceof Ci.nsIObjectLoadingContent))
    return;
  
  sendSyncMessage("flashgestures:PluginInstantiated");
}

addEventListener("PluginInstantiated", onPluginInstantiated, true);

let onMouseDownSimulating = false;

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
  if (onMouseDownSimulating || !prefs.getBoolPref("enabled")) return;
  
  let target = event.target;
  if (target instanceof Ci.nsIObjectLoadingContent) {
    let upperLayerEvent = copyMouseEvent(content, event);
    
    if (event.buttons & 0x2) {
      ContentUtils.LOG("mousedown on plugin object");
      // For right clicks, we create a shadow event that is dispatched 
      // to the original target if the following conditions are met:
      // 1) a corresponding mouseup event is fired within 300ms
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
        
        removeEventListener("mouseup", onMouseUpLocal, true);
        removeEventListener("mousemove", onMouseMoveLocal, true);
        ContentUtils.cancelAsyncTimeout(cancelTimer);
        
        ContentUtils.LOG("context menu: mouseup detected");
        if (upEvent.target === target &&
            Math.abs(downClientX - upEvent.clientX) <= DistanceThreshold &&
            Math.abs(downClientY - upEvent.clientY) <= DistanceThreshold) {
          upEvent.preventDefault();
          upEvent.stopPropagation();
          let upperLayerUpEvent = copyMouseEvent(content, upEvent);
          getSafeParent(target).dispatchEvent(upperLayerUpEvent);
          onMouseDownSimulating = true;
          try {
            let domWindowUtils =
              target.ownerDocument.defaultView.QueryInterface(Ci.nsIInterfaceRequestor)
                                              .getInterface(Ci.nsIDOMWindowUtils);
            let x = upEvent.clientX;
            let y = upEvent.clientY;
            domWindowUtils.sendMouseEventToWindow("mousedown", x, y, 2, 1, 0, false);
            domWindowUtils.sendMouseEventToWindow("mouseup", x, y, 2, 1, 0, false);
          } finally {
            onMouseDownSimulating = false;
          }
        }
      };
      addEventListener("mouseup", onMouseUpLocal, true);

      let cancel = function() {
        removeEventListener("mouseup", onMouseUpLocal, true);
        removeEventListener("mousemove", onMouseMoveLocal, true);
        ContentUtils.cancelAsyncTimeout(cancelTimer);
      }.bind(this);
      
      cancelTimer = ContentUtils.runAsyncTimeout(function() {
        cancel();
        ContentUtils.LOG("possible gesture: timed out");
      }, this, IntervalThreshold);
      
      onMouseMoveLocal = function(moveEvent) {
        if (Math.abs(downClientX - moveEvent.clientX) <= DistanceThreshold &&
            Math.abs(downClientY - moveEvent.clientY) <= DistanceThreshold)
        return;
        
        cancel();
        ContentUtils.LOG("possible gesture: moved too far away");
      };
      addEventListener("mousemove", onMouseMoveLocal, true);
      
      event.preventDefault();
      event.stopPropagation();
    }

    getSafeParent(target).dispatchEvent(upperLayerEvent);
  }
}

addEventListener("mousedown", onMouseDown, true);

let ForceWindowedProxy = {
  enabledOnURL: function(url) {
    return MsgRet(sendSyncMessage("flashgestures:IsForceWindowedEnabledOnURL", url), true);
  }
};

function onForceWindowedFlashPlayer(event) {
  let plugin = event.target;
  if (!(plugin instanceof Ci.nsIObjectLoadingContent))
    return;
  
  let mimeType = plugin.getAttribute("type");
  if (mimeType !== "application/x-shockwave-flash" && mimeType !== "application/futuresplash")
    return;
  
  if (plugin.classList.contains("flashgestures-processed"))
    return;
  plugin.classList.add("flashgestures-processed");
  
  if (!ForceWindowedProxy.enabledOnURL(plugin.ownerDocument.location.href))
    return;
  
  let wmode = plugin.getAttribute("wmode") || (function() {
    let params = plugin.querySelectorAll("param[name]");
    for (let i = 0, l = params.length; i < l; i++) {
      let param = params[i];
      if (param.getAttribute("name").toLowerCase() === "wmode")
        return param.getAttribute("value");
    }
    return "";
  })();
  ContentUtils.LOG("Flash player detected, wmode = " + (wmode || "(default)"));
  
  wmode = wmode.toLowerCase();
  if (wmode === "opaque" || wmode === "transparent") {
    let preferredWmode = "direct";
    if (plugin.hasAttribute("wmode")) {
      plugin.setAttribute("wmode", preferredWmode);
    } else {
      let params = plugin.querySelectorAll("param[name]");
      for (let i = 0, l = params.length; i < l; i++) {
        let param = params[i];
        if (param.getAttribute("name").toLowerCase() === "wmode") {
          param.setAttribute("value", preferredWmode);
          break;
        }
      }
    }
    ContentUtils.LOG("Forced into wmode = " + preferredWmode);
  }
}

function onForceWindowedSilverlight(event) {
  let plugin = event.target;
  if (!(plugin instanceof Ci.nsIObjectLoadingContent))
    return;
  
  let mimeType = plugin.getAttribute("type");
  if (mimeType !== "application/x-silverlight" && mimeType !== "application/x-silverlight-2")
    return;
  
  if (plugin.classList.contains("flashgestures-processed"))
    return;
  plugin.classList.add("flashgestures-processed");

  if (!ForceWindowedProxy.enabledOnURL(plugin.ownerDocument.location.href))
    return;
  
  let windowless = plugin.getAttribute("windowless") || (function() {
    let param = plugin.querySelector("param[name=\"windowless\"]");
    return param ? param.getAttribute("value") : "";
  })();
  ContentUtils.LOG("Silverlight detected, windowless = " + (windowless || "false"));

  windowless = windowless.toLowerCase();
  if (windowless === "true") {
    let preferredWindowless = "false";
    if (plugin.hasAttribute("windowless")) {
      plugin.setAttribute("windowless", preferredWindowless);
    } else {
      let param = plugin.querySelector("param[name=\"windowless\"]");
      if (param)
        param.setAttribute("value", preferredWindowless);
    }
    ContentUtils.LOG("Forced into windowless = " + preferredWindowless);
  }
};

addEventListener("flashgestures:ForceWindowedFlashPlayer", onForceWindowedFlashPlayer, true, true);
addEventListener("flashgestures:ForceWindowedSilverlight", onForceWindowedSilverlight, true, true);

let messageListener = {
  receiveMessage: function(msg) {
    switch (msg.name) {
    case "flashgestures:Uninit":
      ContentUtils.LOG("doing cleanup...");
      removeMessageListener("flashgestures:Uninit", this);
      removeEventListener("mousedown", onMouseDown, true);
      removeEventListener("flashgestures:ForceWindowedSilverlight", onForceWindowedSilverlight, true);
      removeEventListener("flashgestures:ForceWindowedFlashPlayer", onForceWindowedFlashPlayer, true);
      removeEventListener("PluginInstantiated", onPluginInstantiated, true);
      break;
    default:
      ContentUtils.LOG("Unhandled message: " + msg.name);
      break;
    }
  }
};

addMessageListener("flashgestures:Uninit", messageListener);
