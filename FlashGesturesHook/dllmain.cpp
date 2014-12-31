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
#include "ThreadLocal.h"

DWORD g_dwTlsIndex = 0;

BOOL APIENTRY DllMain(HMODULE hModule,
					  DWORD  ul_reason_for_call,
					  LPVOID lpReserved
					  ) {
	ThreadLocalStorage* pData;
	switch (ul_reason_for_call) {
	case DLL_PROCESS_ATTACH:
		if ((g_dwTlsIndex = TlsAlloc()) == TLS_OUT_OF_INDEXES)
			return FALSE;
		// fall through
	case DLL_THREAD_ATTACH:
		TlsSetValue(g_dwTlsIndex, NULL);
		break;
	case DLL_THREAD_DETACH:
		pData = reinterpret_cast<ThreadLocalStorage*>(TlsGetValue(g_dwTlsIndex));
		if (pData) {
			delete pData;
			TlsSetValue(g_dwTlsIndex, NULL);
		}
		break;
	case DLL_PROCESS_DETACH:
		pData = reinterpret_cast<ThreadLocalStorage*>(TlsGetValue(g_dwTlsIndex));
		if (pData)
			delete pData;
		TlsFree(g_dwTlsIndex);
		break;
	}
	return TRUE;
}
