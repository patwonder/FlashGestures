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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import("resource://gre/modules/Services.jsm");

let moduleList = [
  moduleURIPrefix + "Utils.jsm",
  moduleURIPrefix + "Localization.jsm",
  moduleURIPrefix + "Prefs.jsm",
  moduleURIPrefix + "Hook.jsm",
  moduleURIPrefix + "PersistUI.jsm",
  moduleURIPrefix + "AppIntegration.jsm",
];

let loadedModules = Object.create(null);
let uninitFuncs = [];

let initData = null;

/**
 * Loads and initializes a module.
 */
function loadModule(url) {
  if (url in loadedModules) return;

  let module = {};
  try {
    Cu.import(url, module);
  } catch (ex) {
    Cu.reportError("[FlashGestures] Failed to load module " + url + ": " + ex + "\n" + ex.stack);
    return;
  }

  loadedModules[url] = true;

  for (let prop in module) {
    let obj = module[prop];
    if ("init" in obj) {
      try {
        obj.init(initData, uninitFuncs);
      } catch (ex) {
        Cu.reportError("[FlashGestures] Calling method init() for module " + url + " failed: " +
                       ex + "\n" + ex.stack);
      }
      return;
    }
  }
}

function revForEach(arr, func) {
  for (let i = arr.length - 1; i >= 0; i--)
    func(arr[i]);
}

function startup(data, reason) {
  initData = data;
  moduleList.forEach(loadModule);
}

function shutdown(data, reason) {
  revForEach(uninitFuncs, function(func) {
    try {
      func[0].call(func[1]);
    } catch (ex) { }
  });
  uninitFuncs = [];
  revForEach(moduleList, function(url) {
    if (url in loadedModules) {
      Cu.unload(url);
      delete loadedModules[url];
    }
  });

  // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
  //               in order to fully update images and locales, their caches need clearing here
  Services.obs.notifyObservers(null, "chrome-flush-caches", null);
}

function install(data, reason) { }

function uninstall(data,reason) {
  if (reason == ADDON_UNINSTALL) {
    // Reset critical prefs on uninstall
    Services.prefs.clearUserPref("extensions.flashgestures.enabled");
    Services.prefs.clearUserPref("extensions.flashgestures.toggleButtonAdded");
  }
}
