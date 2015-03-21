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
#include <unordered_set>

using namespace std;

extern DWORD g_dwTlsIndex;
static unordered_set<ThreadLocalStorage*> g_setAllocatedTLS;

class SimpleMutex {
private:
	CRITICAL_SECTION m_cs;
public:
	SimpleMutex() { InitializeCriticalSectionAndSpinCount(&m_cs, 4096); }
	~SimpleMutex() { DeleteCriticalSection(&m_cs); }

	void Lock() { EnterCriticalSection(&m_cs); }
	void Unlock() { LeaveCriticalSection(&m_cs); }
};
class SimpleLock {
private:
	SimpleMutex& m_mtx;
public:
	SimpleLock(SimpleMutex& mtx) : m_mtx(mtx) { m_mtx.Lock(); }
	~SimpleLock() { m_mtx.Unlock(); }
};

SimpleMutex g_mtxAllocatedTLS;

ThreadLocalStorage::ThreadLocalStorage() : bGetMsgHookReentranceGuard(false) {
	SimpleLock lock(g_mtxAllocatedTLS);
	g_setAllocatedTLS.insert(this);
}

ThreadLocalStorage::~ThreadLocalStorage() {
	SimpleLock lock(g_mtxAllocatedTLS);
	g_setAllocatedTLS.erase(this);
}

ThreadLocalStorage& ThreadLocalStorage::GetInstance() {
	ThreadLocalStorage* pData = reinterpret_cast<ThreadLocalStorage*>(TlsGetValue(g_dwTlsIndex));
	if (pData == NULL) {
		pData = new ThreadLocalStorage();
		TlsSetValue(g_dwTlsIndex, reinterpret_cast<void*>(pData));
	}
	return *pData;
}

void ThreadLocalStorage::FreeAllInstances() {
	vector<ThreadLocalStorage*> vInstancesToClear;
	{
		SimpleLock lock(g_mtxAllocatedTLS);
		ATLTRACE(_T("Freeing %d remaining TLS instance(s)...\n"), g_setAllocatedTLS.size());
		for (ThreadLocalStorage* pTLS : g_setAllocatedTLS) {
			vInstancesToClear.push_back(pTLS);
		}
	}
	for (ThreadLocalStorage* pTLS : vInstancesToClear)
		delete pTLS;

	ATLASSERT(g_setAllocatedTLS.size() == 0);
}
