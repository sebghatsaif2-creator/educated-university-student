# Offline Fonts (`public/fonts`)

All fonts used by the Dari RTL web interface and the trilingual (English / Dari / Pashto) A4 certificate generator are stored locally in this folder so the system runs **100% offline** with no CDN or Google Fonts requests.

Included SIL Open Font License (OFL-1.1) font files:

- **Vazirmatn** (`vazirmatn-*-{400,500,600,700}-normal.woff2`) — Primary UI font for Dari (RTL) and Latin numerals/codes.
- **Noto Naskh Arabic** (`noto-naskh-arabic-arabic-{400,600,700}-normal.woff2`) — Formal Naskh script font with complete Dari and Pashto glyph coverage (`ټ ډ ړ ږ ښ ګ ڼ ې ۍ څ ځ`) for printed certificates.
- **EB Garamond** (`eb-garamond-latin-{400,600,700}-normal.woff2`) — Classical serif font for the English (LTR) certificate column.

You may place additional `.woff2` / `.ttf` files here (for example `Bahij Nazanin` or `Amiri`) and reference them via `/public/fonts/<filename>`.
