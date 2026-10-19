!macro NSIS_HOOK_POSTUNINSTALL
  IfFileExists "$SMPROGRAMS\Cleanmeter Overlay.lnk" 0 cleanmeter_hotkey_removed
  ExecShellWait "runas" "$SYSDIR\schtasks.exe" '/Delete /TN "Cleanmeter Overlay Hotkey" /F' SW_HIDE
  Delete "$SMPROGRAMS\Cleanmeter Overlay.lnk"
  cleanmeter_hotkey_removed:
!macroend
