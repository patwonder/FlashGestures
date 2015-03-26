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

#define ADDON_ABI __stdcall

DWORD ADDON_ABI FGH_Initialize();
DWORD ADDON_ABI FGH_InstallHook();
void ADDON_ABI FGH_UninstallHook();
void ADDON_ABI FGH_Uninitialize();
void ADDON_ABI FGH_RecordFocusedWindow();
void ADDON_ABI FGH_RestoreFocusedWindow();
DWORD ADDON_ABI FGH_IsTopLevelWindowFocused();
