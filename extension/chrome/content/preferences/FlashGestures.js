pref("extensions.flashgestures.enabled", true);
pref("extensions.flashgestures.toggleButtonAdded", false);
pref("extensions.flashgestures.forceWindowed", false);
// migrate from previous forceWindowedFlashPlayer value
user("extensions.flashgestures.forceWindowed", read("extensions.flashgestures.forceWindowedFlashPlayer"));
kill("extensions.flashgestures.forceWindowedFlashPlayer");
