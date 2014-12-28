/*
 * 这是一个 JavaScript 代码片段速记器。
 *
 * 输入一些 JavaScript，然后可点击右键或从 执行 菜单中选择：
 * 1. 运行 对选中的文本求值(eval) (Ctrl+R)，
 * 2. 查看 对返回值使用对象查看器 (Ctrl+I)，
 * 3. 显示 在选中内容后面以注释的形式插入返回的结果。 (Ctrl+L)
 */


(function() {
  
var global = window.FlashGestures || (window.FlashGestures = {});
Components.utils.import("resource://gre/modules/ctypes.jsm");
if (!global.installed) {
  var DWORD = ctypes.uint32_t;
  var VOID = ctypes.void_t;
  var LRESULT = ctypes.intptr_t;
  var INT = ctypes.int32_t;
  var WPARAM = ctypes.uintptr_t;
  var LPARAM = ctypes.uintptr_t;
  global.hHookDll = ctypes.open("D:\\OpenSourceProjects\\FlashGestures\\Debug\\FlashGesturesHook.dll");
  global.funcInitialize = global.hHookDll.declare("Initialize", ctypes.winapi_abi, DWORD);
  global.funcInstallHook = global.hHookDll.declare("InstallHook", ctypes.winapi_abi, DWORD);
  global.funcUninstallHook = global.hHookDll.declare("UninstallHook", ctypes.winapi_abi, VOID);
  global.funcGetMsgHook = global.hHookDll.declare("GetMsgHook", ctypes.winapi_abi, LRESULT, INT, WPARAM, LPARAM);
  global.funcUninitialize = global.hHookDll.declare("Uninitialize", ctypes.winapi_abi, VOID);
  global.funcRecordFocusedWindow = global.hHookDll.declare("RecordFocusedWindow", ctypes.winapi_abi, VOID);
  global.funcRestoreFocusedWindow = global.hHookDll.declare("RestoreFocusedWindow", ctypes.winapi_abi, VOID);
  global.funcInitialize();
  global.funcInstallHook();
  global.installed = true;

  window.addEventListener("focus", function(event) {
    var target = event.target;
    if (target.localName == "object" || target.localName == "embed") {
      global.funcRecordFocusedWindow();
      target.blur();
      global.funcRestoreFocusedWindow();
    }
  }, true, true);

  window.addEventListener("mousedown", function(event) {
    var target = event.target;
    if (target.localName == "object" || target.localName == "embed") {

      let evt = document.createEvent("MouseEvents");
      evt.initMouseEvent("mousedown", true, true, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, false, false, false, false, event.button, null);
      event.preventDefault();
      event.stopPropagation();
      target.parentNode.dispatchEvent(evt);
    }  
  }, true, true);
}

return [global.hHookDll, global.funcGetMsgHook].map(function(i) i.toString())
})();
