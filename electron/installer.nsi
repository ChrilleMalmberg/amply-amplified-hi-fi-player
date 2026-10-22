; AmPly HiFi Player V-3.0 installer
Unicode true
!ifndef PACKAGE_DIR
  !define PACKAGE_DIR "..\electron-release\Ampli Player-win32-x64"
!endif
!ifndef INSTALLER_OUT
  !define INSTALLER_OUT "..\electron-release\AmPly-V3.0-Setup.exe"
!endif
Name "AmPly HiFi Player V-3.0"
OutFile "${INSTALLER_OUT}"
VIProductVersion "3.0.0.0"
VIAddVersionKey "ProductName" "AmPly HiFi Player"
VIAddVersionKey "FileDescription" "AmPly HiFi Player V-3.0 Setup"
VIAddVersionKey "FileVersion" "3.0.0"
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
  File /r "${PACKAGE_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\AmPly HiFi Player.lnk" "$INSTDIR\Ampli Player.exe"
  CreateDirectory "$SMPROGRAMS\AmPly HiFi Player"
  CreateShortcut "$SMPROGRAMS\AmPly HiFi Player\AmPly HiFi Player.lnk" "$INSTDIR\Ampli Player.exe"
  CreateShortcut "$SMPROGRAMS\AmPly HiFi Player\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "DisplayName" "AmPly HiFi Player V-3.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpliPlayer" "DisplayVersion" "3.0"
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
