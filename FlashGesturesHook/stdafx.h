#pragma once

#include "targetver.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#ifdef _DEBUG
#include <Psapi.h>
#pragma comment(lib, "Psapi.lib")
#endif

#define _ATL_CSTRING_EXPLICIT_CONSTRUCTORS

#include <atlbase.h>
#include <atlstr.h>
#include <atltypes.h>

#include <vector>
