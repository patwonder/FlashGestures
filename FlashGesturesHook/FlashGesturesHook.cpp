// FlashGesturesHook.cpp : ���� DLL Ӧ�ó���ĵ���������
//

#include "stdafx.h"

LRESULT CALLBACK GetMsgHook(int code, WPARAM wParam, LPARAM lParam) {
	MSG* pMsg = reinterpret_cast<MSG*>(lParam);
	ATLTRACE(_T("GetMsgHook: Message %d\n"), pMsg->message);
	return CallNextHookEx(NULL, code, wParam, lParam);
}
