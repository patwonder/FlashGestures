Project discontinued
=============================
Due to plugin sandboxing introduced in Firefox 41, Flash Gestures is no longer compatible with Firefox 41 or higher. Workarounds are complex, and since [Mozilla is actively trying to get rid of NPAPI plugins](https://blog.mozilla.org/futurereleases/2015/10/08/npapi-plugins-in-firefox/), I don't want to continue support plugins either. Hence discontinuing this project.

=================================================================================

Goal
=============================
Resolve mouse gestures and hotkeys usability problem on plugins like Adobe Flash.

Currently only supports Firefox.

Status
=============================
The add-on currently has basic functionality:
* Allow using mouse gestures on any type of plugins.
* Support using Firefox hotkeys when plugins have focus.
* Have a customizable toggle button.
* Supports Win64, Win32 and WOW64 platforms.

Build
=============================
Open FlashGestures.sln with Visual Studio 2013 and build the solution.

After successful building, you will get the add-on file of the name FlashGestures32(64).xpi.

To build a unified xpi containing both x86 and x64 binaries, you could either:
* run tools/buildxpi-unified.bat after both builds are done.

or

* run tools/compile-and-build-unified.bat directly (requires MSBuild). This will first build the required binaries, and then package them.

License
=============================
Flash Gestures is free software: you can redistribute it and/or modify it under the terms of the
[GNU General Public License](https://www.gnu.org/licenses/gpl.html) as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any later version.

Flash Gestures is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License along with Flash Gestures.  If
not, see http://www.gnu.org/licenses/.

Contributor(s):
* Yifan Wu (patwonder@163.com)

Part of Flash Gesture's code is derived from the [Fire IE](https://github.com/yxl/Fire-IE) project.
You can view its license at https://github.com/yxl/Fire-IE/blob/master/README.txt.
