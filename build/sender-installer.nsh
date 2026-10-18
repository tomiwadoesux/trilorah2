; Trilorah Sender's additions to its Windows installer (electron-builder.sender.yml).
;
; NDI® hands the sound to whichever computer asks for it, so the sender
; accepts connections. Windows Firewall stops a program it has never seen
; from doing that and asks someone at the computer to allow it, which on a
; soundboard computer nobody watches means Trilorah on the other computer
; hears nothing. The installer allows it once, here.
;
; Private and domain networks only: on a network Windows calls Public (a
; hotel, a cafe) the desk's sound is not offered to everyone on it. The sender
; window already tells people to make the church network Private.

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Trilorah Sender"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Trilorah Sender" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=private,domain'
!macroend

; An update runs the old uninstaller first; the rule and open-at-login stay through it.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Trilorah Sender"'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Trilorah Sender"
  ${endIf}
!macroend
