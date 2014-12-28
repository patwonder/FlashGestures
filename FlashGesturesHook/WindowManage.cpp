#include "stdafx.h"

#include "ExportFunctions.h"

HWND g_hwndFocused = NULL;

void RecordFocusedWindow() {
	GUITHREADINFO info;
	info.cbSize = sizeof(info);
	if (GetGUIThreadInfo(0, &info))
		g_hwndFocused = info.hwndFocus;
	else
		ATLTRACE(_T("ERROR: GetGUIThreadInfo failed with last error = %d\n"), GetLastError());
}

void RestoreFocusedWindow() {
	if (g_hwndFocused) {
		SetFocus(g_hwndFocused);
		g_hwndFocused = NULL;
	}
}
