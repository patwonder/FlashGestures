pref("extensions.flashgestures.enabled", true);
pref("extensions.flashgestures.toggleButtonAdded", false);
pref("extensions.flashgestures.forceWindowed", false);
pref("extensions.flashgestures.forceWindowedWhitelist", "");
// migrate from previous forceWindowedFlashPlayer value
user("extensions.flashgestures.forceWindowed", read("extensions.flashgestures.forceWindowedFlashPlayer"));
kill("extensions.flashgestures.forceWindowedFlashPlayer");
