#pragma once

bool __stdcall FGH_Initialize();
bool __stdcall FGH_InstallHook();
void __stdcall FGH_UninstallHook();
void __stdcall FGH_Uninitialize();

LRESULT CALLBACK FGH_GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam);

void FGH_RecordFocusedWindow();
void FGH_RestoreFocusedWindow();
