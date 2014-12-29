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
 * @fileOverview Hook integration module, manages the low level Windows message hooks
 */
 
var EXPORTED_SYMBOLS = ["Hook"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import(moduleURIPrefix + "Utils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");

var DWORD = ctypes.uint32_t;
var VOID = ctypes.void_t;
var LRESULT = ctypes.intptr_t;
var INT = ctypes.int32_t;
var WPARAM = ctypes.uintptr_t;
var LPARAM = ctypes.uintptr_t;

let hHookDll = null;
let Initialize = null;
let InstallHook = null;
let UninstallHook = null;
let GetMsgHook = null;
let Uninitialize = null;
let RecordFocusedWindow = null;
let RestoreFocusedWindow = null;

let initialized = false;

function init() {
  Hook.init();
}

let Hook = {
  get initialized() {
    return initialized;
  },
  
  init: function() {
    try {
      hHookDll = ctypes.open(Utils.dllPath);
    } catch (ex) {
      Utils.ERROR("Failed to open hook dll: " + ex);
      return false;
    }
    
    try {
      Initialize = hHookDll.declare("FGH_Initialize", ctypes.winapi_abi, DWORD);
      InstallHook = hHookDll.declare("FGH_InstallHook", ctypes.winapi_abi, DWORD);
      UninstallHook = hHookDll.declare("FGH_UninstallHook", ctypes.winapi_abi, VOID);
      Uninitialize = hHookDll.declare("FGH_Uninitialize", ctypes.winapi_abi, VOID);
      RecordFocusedWindow = hHookDll.declare("FGH_RecordFocusedWindow", ctypes.winapi_abi, VOID);
      RestoreFocusedWindow = hHookDll.declare("FGH_RestoreFocusedWindow", ctypes.winapi_abi, VOID);
    } catch (ex) {
      Utils.ERROR("Failed to locate function entry points in the hook dll: " + ex);
      hHookDll.close();
      return false;
    }
    
    if (!Initialize()) {
      Utils.ERROR("Failed to initialize hook dll!");
      hHookDll.close();
      return false;
    }
    
    return initialized = true;
  },
  
  install: function() {
    if (!initialized)
      return false;
    if (!InstallHook()) {
      Utils.ERROR("Failed to install hook!");
      return false;
    }
    return true;
  },
  
  uninstall: function() {
    if (!initialized)
      return;

    UninstallHook();
  },
  
  uninit: function() {
    if (!initialized)
      return;
    
    Uninitialize();
    hHookDll.close();
    initialized = false;
  },
  
  blurAndFocus: function(embedObject) {
    if (!initialized)
      return;
    
    RecordFocusedWindow();
    embedObject.blur();
    RestoreFocusedWindow();
  },
};

init();
