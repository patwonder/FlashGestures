set XPI_NAME=FlashGestures-unified.xpi
cd ..
del /f/q %XPI_NAME%
cd extension
..\tools\7za a ..\%XPI_NAME% chrome\
..\tools\7za a ..\%XPI_NAME% bootstrap.js
..\tools\7za a ..\%XPI_NAME% binaries\*.dll
..\tools\7za a ..\%XPI_NAME% chrome.manifest
..\tools\7za a ..\%XPI_NAME% install.rdf
