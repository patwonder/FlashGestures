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

#include "ExportFunctionsInternal.h"
#include <unordered_map>

using namespace std;

bool g_bIsInProcessHook = false;

DWORD g_idMainThread = 0;
DWORD g_idCurrentProcess = 0;
uintptr_t g_hHookManageThread = 0;
unsigned int g_idHookManagerThread = 0;

unordered_map<DWORD, HHOOK> g_mapHookByThreadId;
vector<HANDLE> g_vThreadsToWait;
vector<DWORD> g_vThreadIdsToWait;

#ifdef _DEBUG
struct DetailedHookInformation {
	DWORD idProcess;
	DWORD idThread;
	CString fileName;
};
unordered_map<DWORD, DetailedHookInformation> g_mapHookInfoByThreadId;
#endif

HMODULE g_hThisModule = NULL;

const UINT USERMESSAGE_INSTALL_HOOK = WM_USER + 20;
const UINT USERMESSAGE_UNINSTALL_HOOK = WM_USER + 21;
const UINT USERMESSAGE_EXIT_THREAD = WM_USER + 22;

bool InstallHookForThread(DWORD idThread, DWORD idProcess) {
#ifdef _DEBUG
	HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, idProcess);
	CString fileName;
	DWORD dwSize = MAX_PATH;
	QueryFullProcessImageName(hProcess, 0, fileName.GetBuffer(dwSize), &dwSize);
	fileName.ReleaseBuffer();
	CloseHandle(hProcess);
#endif

	HHOOK hhook = idProcess == g_idCurrentProcess
		? SetWindowsHookEx(WH_GETMESSAGE, GetMsgHook, NULL, idThread)
		: SetWindowsHookEx(WH_GETMESSAGE, GetMsgHook, g_hThisModule, idThread);
	if (hhook != NULL) {
		g_mapHookByThreadId[idThread] = hhook;
#ifdef _DEBUG
		ATLTRACE(_T("Hooked: %s, PID=%d, TID=%d\n"), fileName, idProcess, idThread);
		DetailedHookInformation hookInfo = { idProcess, idThread, fileName };
		g_mapHookInfoByThreadId[idThread] = hookInfo;
	} else {
		ATLTRACE(_T("ERROR: failed to hook %s, PID=%d, TID=%d, lastError=%d\n"),
				 fileName, idProcess, idThread, GetLastError());
#endif
	}
	return hhook != NULL;
}

BOOL CALLBACK GetChildWindowsCallback(HWND hwnd, LPARAM lParam) {
	vector<HWND>& vWindows = *(reinterpret_cast<vector<HWND>*>(lParam));
	vWindows.push_back(hwnd);
	return TRUE;
}

BOOL CALLBACK GetTopLevelWindowsCallback(HWND hwnd, LPARAM lParam) {
	EnumChildWindows(hwnd, GetChildWindowsCallback, lParam);
	return TRUE;
}

vector<HWND> GetChildWindows() {
	vector<HWND> vWindows;
	EnumThreadWindows(g_idMainThread, GetTopLevelWindowsCallback, reinterpret_cast<LPARAM>(&vWindows));
	return vWindows;
}

bool InstallAllHooks() {
	vector<HWND> vHWNDChildWindows = GetChildWindows();
	unordered_map<DWORD, DWORD> mapIdThreadsToHook = { make_pair(g_idMainThread, g_idCurrentProcess) };
	for (HWND hwnd : vHWNDChildWindows) {
		DWORD idProcess = 0;
		DWORD idThread = GetWindowThreadProcessId(hwnd, &idProcess);
		if (idThread)
			mapIdThreadsToHook.insert(make_pair(idThread, idProcess));
	}

	for (auto pair : mapIdThreadsToHook) {
		DWORD idThread = pair.first;
		DWORD idProcess = pair.second;
		if (g_mapHookByThreadId.find(idThread) == g_mapHookByThreadId.end())
			InstallHookForThread(idThread, idProcess);
	}

	g_vThreadsToWait.clear();
	g_vThreadIdsToWait.clear();
	for (auto pair : g_mapHookByThreadId) {
		DWORD idThread = pair.first;
		HANDLE hThread = OpenThread(SYNCHRONIZE, FALSE, idThread);
		if (hThread != NULL) {
			g_vThreadsToWait.push_back(hThread);
			g_vThreadIdsToWait.push_back(idThread);
		}
	}

	return true;
}

bool UninstallAllHooks() {
	for (HANDLE hThread : g_vThreadsToWait)
		CloseHandle(hThread);
	for (auto pair : g_mapHookByThreadId) {
		UnhookWindowsHookEx(pair.second);
#ifdef _DEBUG
		const DetailedHookInformation& info = g_mapHookInfoByThreadId[pair.first];
		ATLTRACE(_T("Unhooked: %s, PID=%d, TID=%d\n"),
				 info.fileName, info.idProcess, info.idThread);
#endif
	}

	g_vThreadsToWait.clear();
	g_vThreadIdsToWait.clear();
	g_mapHookByThreadId.clear();
#ifdef _DEBUG
	g_mapHookInfoByThreadId.clear();
#endif

	return true;
}

void WakeUpMessageLoops() {
	// Send all child windows a message to wake their message loop up
	unordered_map<DWORD, HWND> mapThreadToHWND;
	for (HWND hwnd : GetChildWindows()) {
		DWORD idThread = GetWindowThreadProcessId(hwnd, NULL);
		if (idThread && mapThreadToHWND.find(idThread) == mapThreadToHWND.end()) {
			mapThreadToHWND.insert(make_pair(idThread, hwnd));
		}
	}
	for (auto pair : mapThreadToHWND) {
		// Do not disturb the main thread, it should be waiting for us (the hook manage thread)
		if (pair.first == g_idMainThread)
			continue;

		HWND hwnd = pair.second;
		SendMessageTimeout(hwnd, WM_NULL, 0, 0,
						   SMTO_BLOCK | SMTO_ABORTIFHUNG | SMTO_NOTIMEOUTIFNOTHUNG, 200, NULL);
	}
}

unsigned int __stdcall HookManageThread(void* vpStartEvent) {
	HANDLE hStartEvent = reinterpret_cast<HANDLE>(vpStartEvent);
	if (!SetEvent(hStartEvent)) {
		ATLTRACE(_T("ERROR: cannot set start event, last error = %d\n"), GetLastError());
		ATLASSERT(false);
		return 1;
	}
	// Pump a message-wait loop
	while (true) {
		DWORD nCount = (DWORD)g_vThreadsToWait.size();
		if (nCount >= MAXIMUM_WAIT_OBJECTS)
			nCount = MAXIMUM_WAIT_OBJECTS - 1;
		DWORD ret = MsgWaitForMultipleObjects(nCount, nCount ? &g_vThreadsToWait[0] : NULL, FALSE, INFINITE, QS_ALLINPUT);
		if (ret == WAIT_OBJECT_0 + nCount) {
			MSG msg;
			while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
				switch (msg.message) {
				case USERMESSAGE_INSTALL_HOOK:
					InstallAllHooks();
					break;
				case USERMESSAGE_UNINSTALL_HOOK:
					UninstallAllHooks();
					break;
				case USERMESSAGE_EXIT_THREAD:
					// Have we cleaned up yet?
					if (g_mapHookByThreadId.size())
						UninstallAllHooks();
					// HACK: Wake child windows' message loop up so they'll have a chance to unload the dll
					WakeUpMessageLoops();
					// Never return again...
					return 0;
				default:
					break;
				}
			}
		} else if (ret >= WAIT_OBJECT_0 && ret < WAIT_OBJECT_0 + nCount) {
			size_t nIndex = ret - WAIT_OBJECT_0;
			HANDLE hThread = g_vThreadsToWait[nIndex];
			DWORD idThread = g_vThreadIdsToWait[nIndex];
			HHOOK hhook = g_mapHookByThreadId[idThread];
			g_vThreadsToWait.erase(g_vThreadsToWait.begin() + nIndex);
			g_vThreadIdsToWait.erase(g_vThreadIdsToWait.begin() + nIndex);
			g_mapHookByThreadId.erase(idThread);

			CloseHandle(hThread);
			UnhookWindowsHookEx(hhook);
#ifdef _DEBUG
			const DetailedHookInformation& info = g_mapHookInfoByThreadId[idThread];
			ATLTRACE(_T("Unhooked: %s, PID=%d, TID=%d\n"),
					 info.fileName, info.idProcess, info.idThread);
			g_mapHookInfoByThreadId.erase(idThread);
#endif
		} else { // failed, timeout or whatever wierd reasons
			ATLTRACE(_T("ERROR: failed MsgWaitForMultipleObjects, last error = %d\n"), ret == WAIT_FAILED ? GetLastError() : 0);
		}
	}
}

bool Initialize() {
	if (g_idMainThread)
		return true;

	g_bIsInProcessHook = true;

	g_idMainThread = GetCurrentThreadId();
	g_idCurrentProcess = GetCurrentProcessId();

	if (!GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
		reinterpret_cast<LPCWSTR>(Initialize), &g_hThisModule))
	{
		ATLTRACE(_T("ERROR: failed to get module handle, last error = %d\n"), GetLastError());
		return false;
	}
	HANDLE hStartEvent = CreateEvent(0, FALSE, FALSE, 0);
	if (hStartEvent == NULL) {
		ATLTRACE(_T("ERROR: cannot create start event, last error = %d\n"), GetLastError());
		FreeLibrary(g_hThisModule);
		return false;
	}
	g_hHookManageThread = _beginthreadex(NULL, 0, HookManageThread,
										 reinterpret_cast<void*>(hStartEvent), 0, &g_idHookManagerThread);
	if (g_hHookManageThread == 0) {
		ATLTRACE(_T("ERROR: cannot create HookManageThread, last error = %d\n"), _doserrno);
		CloseHandle(hStartEvent);
		FreeLibrary(g_hThisModule);
		return false;
	}
	WaitForSingleObject(hStartEvent, INFINITE);
	CloseHandle(hStartEvent);

	return true;
}

bool InstallHook() {
	if (PostThreadMessage((DWORD)g_idHookManagerThread, USERMESSAGE_INSTALL_HOOK, 0, 0))
		return true;
	ATLTRACE(_T("ERROR: PostThreadMessage(USERMESSAGE_INSTALL_HOOK) failed, last error = %d\n"), GetLastError());
	return false;
}

void UninstallHook() {
	if (!PostThreadMessage((DWORD)g_idHookManagerThread, USERMESSAGE_UNINSTALL_HOOK, 0, 0))
		ATLTRACE(_T("ERROR: PostThreadMessage(USERMESSAGE_UNINSTALL_HOOK) failed, last error = %d\n"), GetLastError());
}

void Uninitialize() {
	if (!PostThreadMessage((DWORD)g_idHookManagerThread, USERMESSAGE_EXIT_THREAD, 0, 0))
		ATLTRACE(_T("ERROR: PostThreadMessage(USERMESSAGE_EXIT_THREAD) failed, last error = %d\n"), GetLastError());
	HANDLE hHookManageThread = reinterpret_cast<HANDLE>(g_hHookManageThread);
	WaitForSingleObject(hHookManageThread, INFINITE);
	CloseHandle(hHookManageThread);

	// Re-initialize? Probably
	g_idMainThread = 0;
}
