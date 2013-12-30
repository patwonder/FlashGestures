/*
 * 这是一个 JavaScript 代码片段速记器。
 *
 * 输入一些 JavaScript，然后可点击右键或从 执行 菜单中选择：
 * 1. 运行 对选中的文本求值(eval) (Ctrl+R)，
 * 2. 查看 对返回值使用对象查看器 (Ctrl+I)，
 * 3. 显示 在选中内容后面以注释的形式插入返回的结果。 (Ctrl+L)
 */

Components.utils.import("resource://gre/modules/ctypes.jsm");

var kernel = ctypes.open("kernel32.dll");
var user = ctypes.open("user32.dll");
var HMODULE = ctypes.uint32_t;
var HWND = ctypes.uint32_t;
var LPCTSTR = ctypes.jschar.ptr;
var LPCSTR = ctypes.char.ptr;
var DWORD = ctypes.uint32_t;
var HHOOK = ctypes.voidptr_t;
var HOOKPROC = ctypes.voidptr_t;
var HINSTANCE = ctypes.voidptr_t;
var LoadLibrary = kernel.declare("LoadLibraryW", ctypes.winapi_abi, HMODULE, LPCTSTR);
var GetProcAddress = kernel.declare("GetProcAddress", ctypes.winapi_abi, ctypes.void_t.ptr, HMODULE, LPCSTR);
var GetCurrentThreadId = kernel.declare("GetCurrentThreadId", ctypes.winapi_abi, DWORD);
var SetWindowsHookEx = user.declare("SetWindowsHookExW", ctypes.winapi_abi, HHOOK, DWORD, HOOKPROC, HINSTANCE, DWORD);
var hHookDll = LoadLibrary("D:\\OpenSourceProjects\\FlashGestures\\Debug\\FlashGesturesHook.dll");
var funcGetMsgHook = GetProcAddress(hHookDll, "GetMsgHook");
var hHook = SetWindowsHookEx(3, funcGetMsgHook, null, GetCurrentThreadId());

[hHookDll, funcGetMsgHook, hHook].map(function(i) i.toString())
