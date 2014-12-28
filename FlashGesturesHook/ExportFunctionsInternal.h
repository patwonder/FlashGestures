#pragma once

bool __stdcall Initialize();
bool __stdcall InstallHook();
void __stdcall UninstallHook();
void __stdcall Uninitialize();

LRESULT CALLBACK GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam);

void RecordFocusedWindow();
void RestoreFocusedWindow();
