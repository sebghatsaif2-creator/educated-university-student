# Offline Logos & Emblems (`public/logos`)

Official university and ministry emblems stored locally so the interface and Puppeteer PDF generator run **100% offline** with zero network dependencies.

Included assets registered by `npm run seed`:

- `university-logo.png` — Official **Kunduz University** (پوهنتون کندز / د کندز پوهنتون) circular seal (transparent background).
- `ministry-logo.png` — Official **Ministry of Higher Education** (وزارت تحصیلات عالی / د لوړو زده کړو وزارت) circular seal (transparent background).
- `university-logo.svg`, `ministry-logo.svg`, `watermark-logo.svg` — Lightweight fallback SVG emblems.

Replace any image file here (or update its `Asset` record in MongoDB) to update printed certificates offline.
