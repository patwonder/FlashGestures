#pragma once

// ���� SDKDDKVer.h ��������õ���߰汾�� Windows ƽ̨��

// ���ҪΪ��ǰ�� Windows ƽ̨����Ӧ�ó�������� WinSDKVer.h������
// WIN32_WINNT ������ΪҪ֧�ֵ�ƽ̨��Ȼ���ٰ��� SDKDDKVer.h��

#include <WinSDKVer.h>

#ifdef _DEBUG
	#define WINVER 0x0600
	#define _WIN32_WINNT 0x0600
#else
	#define WINVER 0x0501
	#define _WIN32_WINNT 0x0501
#endif

#include <SDKDDKVer.h>
