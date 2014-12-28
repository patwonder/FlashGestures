#pragma once

#include "stdafx.h"
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
