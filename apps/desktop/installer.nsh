; Reserve three lines for localized completion titles, including German.
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TITLE_3LINES

; Use the app palette and put the branded header on the left on ordinary pages.
!ifdef MUI_HEADERIMAGE_RIGHT
  !undef MUI_HEADERIMAGE_RIGHT
!endif
!define MUI_HEADERIMAGE_BITMAP_STRETCH AspectFitHeight
!define MUI_WELCOMEFINISHPAGE_BITMAP_STRETCH AspectFitHeight
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_STRETCH AspectFitHeight
!define MUI_BGCOLOR FFFCF7
!define MUI_TEXTCOLOR 282321

; Keep the standard localized welcome text and skip it for automatic updates.
!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !insertmacro MUI_PAGE_WELCOME
!macroend
