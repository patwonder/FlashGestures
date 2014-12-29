#pragma once

#include <WinSDKVer.h>

#ifdef _DEBUG
	#define WINVER 0x0600
	#define _WIN32_WINNT 0x0600
#else
	#define WINVER 0x0501
	#define _WIN32_WINNT 0x0501
#endif

#include <SDKDDKVer.h>
