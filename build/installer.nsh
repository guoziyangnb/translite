; electron-builder 自定义 NSIS 钩子。
; 目的：用户在安装向导的"选择安装目录"页点击下一步后，如果他们选的目录末尾
;       不是 ${PRODUCT_NAME}（TransLite），就自动补一层，避免文件直接散到
;       C:\Apps、D:\、桌面之类的父级目录。

!macro customDirectoryLeave
  ; 把 $INSTDIR 备份到 $R9，后续都对 $R9 操作，最后再写回 $INSTDIR。
  StrCpy $R9 "$INSTDIR"

  ; 去掉路径末尾可能的反斜杠（用户手动输 "C:\Apps\" 这种）。
  StrCpy $R8 "$R9" "" -1
  ${If} $R8 == "\"
    StrCpy $R9 "$R9" -1
  ${EndIf}

  ; 取 $R9 末尾的 strlen(PRODUCT_NAME) 个字符，跟 PRODUCT_NAME 对比。
  StrLen $R7 "${PRODUCT_NAME}"
  StrLen $R6 "$R9"

  ${If} $R6 > $R7
    IntOp $R5 $R6 - $R7
    StrCpy $R4 "$R9" $R7 $R5
    ${If} $R4 != "${PRODUCT_NAME}"
      StrCpy $INSTDIR "$R9\${PRODUCT_NAME}"
    ${Else}
      StrCpy $INSTDIR "$R9"
    ${EndIf}
  ${Else}
    ; 比 PRODUCT_NAME 还短的路径（理论上不会），保险起见直接追加。
    StrCpy $INSTDIR "$R9\${PRODUCT_NAME}"
  ${EndIf}
!macroend
