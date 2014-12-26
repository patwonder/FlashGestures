#pragma once

void InstallHook();
void UninstallHook();
LRESULT CALLBACK GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam);
