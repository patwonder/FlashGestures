const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const moduleURIPrefix = "chrome://flashgestures/content/modules/";

Cu.import("resource://gre/modules/Services.jsm");

function startup(data, reason) {
  Cu.import(moduleURIPrefix + "Utils.jsm");
  Utils.initData(data);
  
  Cu.import(moduleURIPrefix + "AppIntegration.jsm");
  Cu.import(moduleURIPrefix + "Hook.jsm");

  forEachOpenWindow(loadIntoWindow);
  Services.wm.addListener(WindowListener);
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN)
    return;

  Services.wm.removeListener(WindowListener);
  forEachOpenWindow(unloadFromWindow);
  
  if (Hook.initialized) {
    Utils.LOG("Uninitializing...");
    Hook.uninit();
  }

  Cu.unload(moduleURIPrefix + "Hook.jsm");
  Cu.unload(moduleURIPrefix + "AppIntegration.jsm");
  Cu.unload(moduleURIPrefix + "Utils.jsm");  // Same URL as above

  // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
  //               in order to fully update images and locales, their caches need clearing here
  Services.obs.notifyObservers(null, "chrome-flush-caches", null);
}

function install(data, reason) { }
function uninstall(data,reason) { }

function loadIntoWindow(window) {
  AppIntegration.addWindow(window);
}

function unloadFromWindow(window) {
  AppIntegration.removeWindow(window);
}

// Apply a function to all open browser windows
function forEachOpenWindow(todo) {
  var windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements())
      todo(windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow));
}

var WindowListener = {
  QueryInterface: function(aIID) {
   if (aIID.equals(Ci.nsIWindowMediatorListener) ||
       aIID.equals(Ci.nsISupportsWeakReference) ||
       aIID.equals(Ci.nsISupports))
     return this;
   throw Cr.NS_NOINTERFACE;
  },

  onOpenWindow: function(xulWindow) {
    var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    function onWindowLoad() {
      window.removeEventListener("load", onWindowLoad);
      if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
        loadIntoWindow(window);
    }
    window.addEventListener("load", onWindowLoad);
  },
  onCloseWindow: function(xulWindow) {
    var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
      unloadFromWindow(window);
  },
  onWindowTitleChange: function(xulWindow, newTitle) { }
};
