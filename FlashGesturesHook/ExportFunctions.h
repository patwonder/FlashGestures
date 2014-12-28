#pragma once

bool __stdcall Initialize();
bool __stdcall InstallHook();
void __stdcall UninstallHook();
LRESULT CALLBACK GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam);
void __stdcall Uninitialize();

void RecordFocusedWindow();
void RestoreFocusedWindow();
