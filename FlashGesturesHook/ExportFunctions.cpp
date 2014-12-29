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

#include "stdafx.h"
#include "ExportFunctions.h"
#include "ExportFunctionsInternal.h"

bool __stdcall FGH_Initialize() { return Initialize(); }
bool __stdcall FGH_InstallHook() { return InstallHook(); }
void __stdcall FGH_UninstallHook() { return UninstallHook(); }
void __stdcall FGH_Uninitialize() { return Uninitialize(); }

LRESULT CALLBACK FGH_GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam) {
	return GetMsgHook(nCode, wParam, lParam);
}

void FGH_RecordFocusedWindow() { return RecordFocusedWindow(); }
void FGH_RestoreFocusedWindow() { return RestoreFocusedWindow(); }
