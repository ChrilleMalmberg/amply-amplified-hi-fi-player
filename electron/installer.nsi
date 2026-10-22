; AmPly HiFi Player V-2.1 installer (build with: makensis electron/installer.nsi after packaging)
Unicode true
Name "AmPly HiFi Player V-2.1"
OutFile "..\electron-release\AmPly-V2.1-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Ampli Player"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "icon.ico"
UninstallIcon "icon.ico"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\electron-release\Ampli Player-win32-x64\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\AmPly HiFi Player.lnk" "$INSTDIR\Ampli Player.exe"
  CreateDirectory "$SMPROGRAMS\AmPly HiFi Player"
  CreateShortcut "$SMPROGRAMS\AmPly HiFi Player\AmPly HiFi Player.lnk" "$INSTDIR\Ampli Player.exe"
  CreateShortcut "$SMPROGRAMS\AmPly HiFi Player\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "DisplayName" "AmPly HiFi Player V-2.1"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "DisplayVersion" "2.1"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "DisplayIcon" "$INSTDIR\Ampli Player.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "Publisher" "AmPly HiFi Player"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\AmPly HiFi Player.lnk"
  RMDir /r "$SMPROGRAMS\AmPly HiFi Player"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer"
SectionEnd
