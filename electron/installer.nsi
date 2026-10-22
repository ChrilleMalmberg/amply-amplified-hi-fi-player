; Llamamp Windows installer (build with: makensis electron/installer.nsi after packaging)
Unicode true
Name "Llamamp"
OutFile "..\electron-release\Llamamp-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Llamamp"
RequestExecutionLevel user
SetCompressor /SOLID lzma

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\electron-release\Llamamp-win32-x64\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Llamamp.lnk" "$INSTDIR\Llamamp.exe"
  CreateDirectory "$SMPROGRAMS\Llamamp"
  CreateShortcut "$SMPROGRAMS\Llamamp\Llamamp.lnk" "$INSTDIR\Llamamp.exe"
  CreateShortcut "$SMPROGRAMS\Llamamp\Uninstall Llamamp.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Llamamp" "DisplayName" "Llamamp"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Llamamp" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Llamamp" "DisplayIcon" "$INSTDIR\Llamamp.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Llamamp" "Publisher" "Llamamp"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Llamamp.lnk"
  RMDir /r "$SMPROGRAMS\Llamamp"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Llamamp"
SectionEnd
