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
#include "GestureHandler.h"
#include "ThreadLocal.h"

using namespace std;

extern bool g_bIsInProcessHook;
extern DWORD g_idCurrentProcess;

template <class T, class R>
int ArrayFind(const T* arrayBegin, int arrayLength, const R& toFind) {
	for (int i = 0; i < arrayLength; i++) {
		if ((*(arrayBegin + i)) == toFind)
			return i;
	}
	return -1;
}

bool IsInProcessWindow(HWND hwnd) {
	if (!g_bIsInProcessHook) return false;

	DWORD idProcess = 0;
	GetWindowThreadProcessId(hwnd, &idProcess);
	return idProcess == g_idCurrentProcess;
}

//
// Returns the real parent window
// Same as GetParent(), but doesn't return the owner
//
HWND GetRealParent(HWND hWnd) {
	HWND hParent;

	hParent = GetAncestor(hWnd, GA_PARENT);
	if (!hParent || hParent == GetDesktopWindow())
		return NULL;

	return hParent;
}

HWND GetParentWindowForAnyClassName(HWND hwnd, const CString targetClassNames[], int nTargetClassNames, int maxLevelsUp, CString& className) {
	int levels = 0;
	int index = -1;
	HWND hwndParent = hwnd;
	while (hwndParent && levels <= maxLevelsUp && index < 0) {
		hwnd = hwndParent;
		hwndParent = GetRealParent(hwnd);

		int nCopied = GetClassName(hwnd, className.GetBuffer(MAX_PATH), MAX_PATH);
		className.ReleaseBuffer(nCopied);

		if (nCopied == 0)
			return NULL;

		index = ArrayFind(targetClassNames, nTargetClassNames, className);

		levels++;
	}

	return (index < 0) ? NULL : hwnd;
}

HWND VerifyAndGetTopMozillaWindowClassWindow(HWND hwndChild) {
	static const CString inProcessWrapperClassName = _T("MozillaWindowClass");
	static const CString targetWindowClassName = _T("MozillaWindowClass");
	static const CString targetPluginWindowClassNames[] = {
		inProcessWrapperClassName, _T("GeckoPluginWindow"), _T("GeckoFPSandboxChildWindow")
	};
	static const int nTargetPluginWindowClassNames = ARRAYSIZE(targetPluginWindowClassNames);
	static const int nTargetPluginWindowClassNamesInProcess = 1;
	static const CString lowIntegrityWindowClassNames[] = {
		_T("GeckoFPSandboxChildWindow")
	};
	static const int nLowIntegrityWindowClassNames = ARRAYSIZE(lowIntegrityWindowClassNames);

	CString intermediateClassName;
	HWND hwndIntermediate = 
		GetParentWindowForAnyClassName(hwndChild, targetPluginWindowClassNames,
		IsInProcessWindow(hwndChild) ? nTargetPluginWindowClassNamesInProcess : nTargetPluginWindowClassNames,
		10, intermediateClassName);
	if (!hwndIntermediate)
		return NULL;

	HWND hwndTop = GetAncestor(hwndIntermediate, GA_ROOT);
	if (hwndTop == hwndIntermediate)
		return NULL;

	// Bypass root window class checking, as we can't do it reliably in a low integrity process
	if (0 <= ArrayFind(lowIntegrityWindowClassNames, nLowIntegrityWindowClassNames, intermediateClassName))
		return hwndTop;

	// Check root window class name
	CString topClassName;
	int nCopied = GetClassName(hwndTop, topClassName.GetBuffer(MAX_PATH), MAX_PATH);
	topClassName.ReleaseBuffer(nCopied);
	if (nCopied == 0 || topClassName != targetWindowClassName)
		return NULL;

	return hwndTop;
}

bool FilterFirefoxKey(int keyCode, bool bAltPressed, bool bCtrlPressed, bool bShiftPressed) {
	if (bCtrlPressed && bAltPressed) {
		// BUG FIX: Characters like @, #, € (and others that require AltGr on European keyboard layouts) cannot be entered in the plugin
		// Suggested by Meyer Kuno (Helbling Technik): AltGr is represented in Windows massages as the combination of Alt+Ctrl, and that is used for text input, not for menu naviagation.
		// 
		switch (keyCode) {
		case 'R': // Ctrl+Alt+R, Restart firefox
			return true;
		default:
			return false;
		}
	} else if (bCtrlPressed) {
		switch (keyCode) {
		case VK_CONTROL: // Only Ctrl is pressed
		case VK_MENU: // Might be in AltGr up sequence
			return false;
		case VK_SHIFT: // Ctrl-Shift switching IME, should not lose focus
		case VK_SPACE:
		case VK_PROCESSKEY:
			ATLTRACE(_T("VK_SHIFT, VK_SPACE or VK_PROCESSKEY\n"));
			return false;

		// The following shortcut keys will be handle by the plugin only and won't be sent to Firefox
		case 'C': // Ctrl+C, Copy
		case 'V': // Ctrl+V, Paste
		case 'X': // Ctrl+X, Cut
		case 'A': // Ctrl+A, Select All
		case 'Z': // Ctrl+Z, undo
		case 'Y': // Ctrl+Y, redo 
		case VK_HOME: // Ctrl+HOME, Scroll to Top
		case VK_END:  // Ctrl+END, Scroll to end
		case VK_LEFT: // Ctrl+L/R, Jump to prev/next word
		case VK_RIGHT:
		case VK_UP: // Ctrl+U/D, identical to Up/Down
		case VK_DOWN:
		case VK_RETURN: // Ctrl-Return, fast post on Baidu Tieba & potentially other places
			return false;
		default:
			ATLTRACE(_T("Forwarded firefox key with keyCode = %d\n"), keyCode);
			return true;
		}
	} else if (bAltPressed) {
		return true;
	} else {
		switch (keyCode) {
		case VK_F2: // Developer toolbar
			return bShiftPressed;
		case VK_F3: // find next, with shift: find prev
			return true;
		case VK_F4: // Shift-F4 opens Scratchpad which is very handy
			return bShiftPressed;
		case VK_F5: // Refresh
			return true;
		case VK_F6: // Locate the address bar
			return !bShiftPressed;
		case VK_F7: // Style Editor
			return bShiftPressed;
		case VK_F10: // Locate the menu bar
			return !bShiftPressed;
		case VK_F11: // full screen
			return !bShiftPressed;
		case VK_F12: // Firebug
			return !bShiftPressed;
		default:
			return false;
		}
	}

	return false;
}

bool ForwardFirefoxKeyMessage(HWND hwndFirefox, MSG* pMsg) {
	bool bAltPressed = HIBYTE(GetKeyState(VK_MENU)) != 0;
	bool bCtrlPressed = HIBYTE(GetKeyState(VK_CONTROL)) != 0;
	bool bShiftPressed = HIBYTE(GetKeyState(VK_SHIFT)) != 0;

	static MSG s_pendingAltDown = { 0 };

	ATLTRACE(_T("ForwardFirefoxKeyMessage MSG: %x wParam: %x, lPara: %x\n"), pMsg->message, pMsg->wParam, pMsg->lParam);
	if (bAltPressed && !bCtrlPressed && pMsg->wParam == VK_MENU) {
		// Alt without Ctrl is pressed. We'll delay sending the Alt down message, in case Ctrl is pressed
		// before Alt up.  AltGr is represented in Windows massages as the combination of Alt+Ctrl, and 
		// that is used for text input, not for menu naviagation.
		s_pendingAltDown = *pMsg;
		ATLTRACE(_T("ForwardFirefoxKeyMessage : Alt pending...\n"));
		return false;
	} else if (bCtrlPressed) {
		if (s_pendingAltDown.message != WM_NULL) {
			// Clear the pending Alt down message as Ctrl is pressed.
			s_pendingAltDown.message = WM_NULL;
			ATLTRACE(_T("ForwardFirefoxKeyMessage : Cleared pending Alt.\n"));
		}
	}

	// Send Alt key up message to Firefox, so that user could select the main window menu by press alt key.
	if (pMsg->message == WM_SYSKEYUP && pMsg->wParam == VK_MENU) {
		if (s_pendingAltDown.message != WM_NULL) {
			// Send the pending Alt down message first.
			::SetFocus(hwndFirefox);
			::PostMessage(hwndFirefox, s_pendingAltDown.message, s_pendingAltDown.wParam, s_pendingAltDown.lParam);
			s_pendingAltDown.message = WM_NULL;
			bAltPressed = true;
			ATLTRACE(_T("ForwardFirefoxKeyMessage : Sent pending Alt.\n"));
		}
	}
	// Might be in AltGr up sequence, skip
	else if (pMsg->message == WM_SYSKEYUP && pMsg->wParam == VK_CONTROL) {
		ATLTRACE(_T("ForwardFirefoxKeyMessage : Return from AltGr up sequence.\n"));
		return false;
	}

	if (bCtrlPressed || bAltPressed || (pMsg->wParam >= VK_F1 && pMsg->wParam <= VK_F24)) {
		int nKeyCode = static_cast<int>(pMsg->wParam);
		if (FilterFirefoxKey(nKeyCode, bAltPressed, bCtrlPressed, bShiftPressed)) {
			::SetFocus(hwndFirefox);
			::PostMessage(hwndFirefox, pMsg->message, pMsg->wParam, pMsg->lParam);
			return true;
		}
	}
	return false;
}

bool ForwardFirefoxMouseMessage(HWND hwndFirefox, MSG* pMsg) {
	const std::vector<GestureHandler*>& handlers = GestureHandler::getHandlers();

	// Forward the mouse message if any guesture handler is triggered.
	for (std::vector<GestureHandler*>::const_iterator iter = handlers.begin();
		 iter != handlers.end(); ++iter) {
		if ((*iter)->getState() == GS_Triggered) {
			GestureHandler* triggeredHandler = *iter;
			MessageHandleResult res = triggeredHandler->handleMessage(pMsg);
			if (res == MHR_GestureEnd) {
				for (std::vector<GestureHandler*>::const_iterator iter = handlers.begin();
					 iter != handlers.end(); ++iter) {
					(*iter)->reset();
				}
			}
			// Forward the mousemove message to let firefox track the guesture.
			GestureHandler::forwardTarget(pMsg, hwndFirefox);
			return true;
		}
	}

	// Check if we could trigger a mouse guesture.
	bool bShouldSwallow = false;
	for (std::vector<GestureHandler*>::const_iterator iter = handlers.begin();
		 iter != handlers.end(); ++iter) {
		MessageHandleResult res = (*iter)->handleMessage(pMsg);
		bShouldSwallow = bShouldSwallow || (*iter)->shouldSwallow(res);
		if (res == MHR_Triggered) {
			(*iter)->forwardAllTarget(pMsg->hwnd, hwndFirefox);
			break;
		} else if (res == MHR_Canceled) {
			bool bShouldForwardBack = true;
			for (std::vector<GestureHandler*>::const_iterator iter2 = handlers.begin();
				 iter2 != handlers.end(); ++iter2) {
				if ((*iter2)->getState() != GS_None) {
					bShouldForwardBack = false;
					break;
				}
			}
			if (bShouldForwardBack) {
				(*iter)->forwardAllOrigin(pMsg->hwnd);
				for (std::vector<GestureHandler*>::const_iterator iter2 = handlers.begin();
					 iter2 != handlers.end(); ++iter2) {
					(*iter2)->reset();
				}
			}
		}
	}
	return bShouldSwallow;
}

bool ForwardZoomMessage(HWND hwndFirefox, MSG* pMsg) {
	bool bCtrlPressed = HIBYTE(GetKeyState(VK_CONTROL)) != 0;
	bool bShouldForward = bCtrlPressed && pMsg->message == WM_MOUSEWHEEL;
	if (bShouldForward) {
		ATLTRACE(_T("Ctrl+Wheel forwarded.\n"));
		GestureHandler::forwardTarget(pMsg, hwndFirefox);
	}
	return bShouldForward;
}

LRESULT CALLBACK GetMsgHook(int nCode, WPARAM wParam, LPARAM lParam) {
	bool& bReentranceGuard = ThreadLocalStorage::GetInstance().bGetMsgHookReentranceGuard;

	if (nCode < 0 || bReentranceGuard) // Prevent reentrance problems caused by SendMessage
	{
		if (bReentranceGuard)
			ATLTRACE(_T("GetMsgHook WARNING: reentered.\n"));
		return CallNextHookEx(NULL, nCode, wParam, lParam);
	}
	bReentranceGuard = true;

	if (wParam == PM_REMOVE && lParam) {
		MSG * pMsg = reinterpret_cast<MSG *>(lParam);
		HWND hwnd = pMsg->hwnd;

		// here we only handle keyboard messages and mouse button messages
		if (!(WM_KEYFIRST <= pMsg->message && pMsg->message <= WM_KEYLAST) && !(WM_MOUSEFIRST <= pMsg->message && pMsg->message <= WM_MOUSELAST) || hwnd == NULL) {
			goto Exit;
		}

		// Get top MozillaWindowClass object from the window hierarchy
		HWND hwndFirefox = VerifyAndGetTopMozillaWindowClassWindow(hwnd);
		if (hwndFirefox == NULL) {
			goto Exit;
		}

		bool bShouldSwallow = false;

		if (WM_KEYFIRST <= pMsg->message && pMsg->message <= WM_KEYLAST) {
			// Forward the key press messages to firefox
			if (pMsg->message == WM_KEYDOWN || pMsg->message == WM_SYSKEYDOWN || pMsg->message == WM_SYSKEYUP) {
				bShouldSwallow = bShouldSwallow || ForwardFirefoxKeyMessage(hwndFirefox, pMsg);
			}
		}

		// Check if we should enable mouse gestures
		if (WM_MOUSEFIRST <= pMsg->message && pMsg->message <= WM_MOUSELAST) {
			bShouldSwallow = bShouldSwallow || ForwardFirefoxMouseMessage(hwndFirefox, pMsg);
		}

		// Check if we should handle Ctrl+Wheel zooming
		bShouldSwallow = bShouldSwallow || ForwardZoomMessage(hwndFirefox, pMsg);

		if (bShouldSwallow) {
			ATLTRACE(_T("GetMsgHook SWALLOWED.\n"));
			pMsg->message = WM_NULL;
		}
	}
Exit:
	bReentranceGuard = false;
	return CallNextHookEx(NULL, nCode, wParam, lParam);
}
