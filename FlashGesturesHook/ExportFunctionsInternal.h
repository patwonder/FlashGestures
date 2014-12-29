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

#pragma once

bool __stdcall Initialize();
bool __stdcall InstallHook();
void __stdcall UninstallHook();
void __stdcall Uninitialize();

LRESULT CALLBACK GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam);

void RecordFocusedWindow();
void RestoreFocusedWindow();
