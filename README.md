<div dir="rtl">

# سیستم آفلاین درخواست و چاپ تصدیق‌نامه فراغت — پوهنتون کندز

**وزارت تحصیلات عالی افغانستان | ریاست پوهنتون کندز | معاونیت امور محصلان**

این سیستم یک نرم‌افزار وب **۱۰۰٪ آفلاین** برای ثبت درخواست، بررسی، تأیید، ویرایش سه‌زبانه، چاپ PDF و تأیید اصالت تصدیق‌نامه‌های فراغت پوهنتون کندز روی **شبکه محلی داخلی (LAN)** می‌باشد.

### ویژگی‌های کلیدی

- **کارکرد ۱۰۰٪ آفلاین (بدون نیاز به انترنت):** هیچ لینک CDN، Google Fonts، تصویر بیرونی یا سرویس آنلاین در پروژه وجود ندارد. تمام فونت‌ها در `public/fonts` و نشان‌های رسمی در `public/logos` ذخیره شده‌اند.
- **رابط کاربری کاملاً دری و راست‌به‌چپ (`dir="rtl"`):** طراحی واکنش‌گرا (Responsive) با React + Vite برای کمپیوترهای اداری، تبلت و مبایل.
- **تصدیق‌نامه سه‌زبانه در یک صفحه A4 افقی (Landscape):**
  - ستون چپ: **انگلیسی** (چپ‌به‌راست — فونت `EB Garamond`)
  - ستون وسط: **دری** (راست‌به‌چپ — فونت `Vazirmatn`)
  - ستون راست: **پشتو** (راست‌به‌چپ — فونت نسخ `Noto Naskh Arabic`) همراه با نمبر رسمی (`د ثبت ګڼه`) در بالای ستون
  - نشان رسمی پوهنتون کندز در مرکز سرلوحه و نشان وزارت تحصیلات عالی در کنار آن، محل امضا و مهر معاون امور محصلان و رئیس پوهنځی، شماره سریال یکتا (`KU-YYYY-000001`) و **کود QR آفلاین**.
- **۸ قالب رسمی قابل انتخاب (`theme-<key>`):** `classic`، `official` (سیاه‌وسفید پیش‌فرض)، `green`، `modern`، `watermark`، `cream`، `blue-stripes` و `gold-corners` با یک قالب HTML واحد و تنظیم خودکار اندازه فونت برای متون طولانی.
- **نقش‌های کاربری (بدون ماژول پرداخت):**
  1. **متقاضی / فارغ‌التحصیل:** بدون نیاز به حساب کاربری؛ ثبت درخواست و پیگیری وضعیت با **کود پیگیری یکتا**.
  2. **کارمند امور محصلان (`officer`):** بررسی و فلتر درخواست‌ها، تأیید یا رد با ذکر دلیل، انتخاب قالب با پیش‌نمایش زنده نمونه، ویرایش متن هر سه زبان (`fa`، `ps`، `en`) با پیش‌نمایش زنده، بازگردانی به متن پیش‌فرض، تولید PDF و چاپ (با ثبت خودکار هر چاپ در `printLogs`).
  3. **مدیر سیستم (`admin`):** تمام دسترسی‌های کارمند به علاوه مدیریت کاربران، پوهنځی‌ها و دیپارتمنت‌ها (سه‌زبانه)، مدیریت قالب‌ها و متن‌های پیش‌فرض (ذکور و اناث) و گزارش‌های احصائیوی.
- **فناوری‌ها:** Node.js + Express + MongoDB (Mongoose) + Zod + JWT/bcrypt + Puppeteer + `qrcode` + React 18 + Vite.

---

## یادداشت مهم (TODO) — بازبینی متن پیش‌فرض پشتو توسط گویشور بومی

> **TODO (بازبینی الزامی متن پشتو پیش از صدور رسمی):**  
> متن‌های پیش‌فرض بخش **پشتو (`ps`)** تصدیق‌نامه — هم گونه ذکور (`ښاغلي ... د ... زوی / د نوموړي`) و هم گونه اناث (`ځلانده ... د ... لور / د نوموړې`) — که در فایل `server/src/services/textGenerator.js` (`DEFAULT_TEXT_TEMPLATES.ps` و `GENDER_TERMS.ps`) تعریف و در دیتابیس بارگذاری شده‌اند، **باید پیش از استفاده رسمی توسط استاد یا گویشور بومی زبان پشتو** (مانند دیپارتمنت زبان و ادبیات پشتو پوهنتون کندز) بازبینی و تأیید نهایی گردند. پس از تأیید، مدیر سیستم می‌تواند بدون تغییر کود، متن نهایی را مستقیماً از صفحه **«مدیریت قالب‌ها»** (`/admin/templates`) ذخیره نماید.

---

## ساختار پروژه

```text
.
├── .env.example              # نمونه تنظیمات محیطی سرور، شبکه محلی، Chromium و پشتیبان‌گیری
├── .npmrc                    # تنظیمات آفلاین npm (غیرفعال‌سازی audit و fund آنلاین)
├── package.json              # دستورات اصلی (start, build, seed, backup, audit:offline, test)
├── public/
│   ├── fonts/                # ۱۴ فایل فونت محلی WOFF2 (Vazirmatn، Noto Naskh Arabic، EB Garamond)
│   └── logos/                # نشان رسمی پوهنتون کندز و وزارت تحصیلات عالی (PNG و SVG)
├── server/                   # بک‌اند Express + Mongoose + موتور PDF آفلاین Puppeteer
│   ├── src/
│   │   ├── config/           # تنظیمات محیطی و اتصال دیتابیس (env.js, db.js)
│   │   ├── models/           # مدل‌ها: User, Faculty, Department, Request, Template, PrintLog, Asset, Counter
│   │   ├── templates/        # قالب واحد تصدیق‌نامه (certificateTemplate.js) و ۸ استایل (certificate.css)
│   │   ├── services/         # تولید متن سه‌زبانه، سریال، ثبت چاپ و تولید QR/PDF با Puppeteer
│   │   ├── validators/       # اعتبارسنجی Zod با پیام‌های خطای دری
│   │   ├── middleware/       # احراز هویت JWT/RBAC، محدودکننده نرخ درخواست و پاک‌سازی ورودی
│   │   ├── controllers/      # منطق تمام APIها
│   │   ├── routes/           # مسیرهای REST تحت /api
│   │   ├── seed/             # اسکریپت بارگذاری اطلاعات اولیه پوهنتون کندز
│   │   └── scripts/          # generateSamplePdfs.js (تولید هر ۸ نمونه PDF آفلاین)
│   └── tests/                # تست‌های خودکار واحد، گردش‌کار، PDF و کارکرد بدون انترنت
├── client/                   # فرانت‌اند دری و راست‌به‌چپ (React + Vite -> خروجی در client/dist)
├── scripts/
│   ├── audit-offline.js      # اسکریپت ممیزی و تأیید ۱۰۰٪ آفلاین بودن پروژه
│   ├── backup-db.sh          # اسکریپت پشتیبان‌گیری روزانه mongodump (نگهداری ۱۴ نسخه آخر — لینوکس)
│   ├── backup-db.js          # اسکریپت پشتیبان‌گیری روزانه چندسکویی (ویندوز و لینوکس)
│   └── restore-db.sh         # اسکریپت بازیابی ایمن دیتابیس با بررسی SHA-256
└── docs/
    └── BACKUP_RESTORE.md     # راهنمای کامل پشتیبان‌گیری روزانه و بازیابی اطلاعات
```

---

## ۱. راهنمای نصب ۱۰۰٪ آفلاین (گام‌به‌گام)

برای نصب سیستم روی سرور داخلی پوهنتون کندز که هیچ اتصالی به انترنت ندارد، مراحل را در دو بخش انجام دهید:

### بخش الف — دانلود پیشاپیش روی یک کمپیوتر دارای انترنت

> **مهم:** بهتر است کمپیوتر دارای انترنت دارای **همان سیستم‌عامل و معماری** سرور آفلاین باشد (مثلاً هر دو Ubuntu Server 22.04/24.04 x64 یا هر دو Windows Server x64) تا بسته‌های باینری مانند `bcrypt` دقیقاً سازگار باشند.

#### ۱) دانلود فایل‌های نصب نرم‌افزارهای پایه
فایل‌های نصب آفلاین ذیل را دانلود و در یک پوشه مثلاً `installers/` روی فلش یا هارد اکسترنال ذخیره کنید:
- **Node.js LTS** (نسخه ۲۰ یا ۲۲ — حداقل ۱۸): فایل `.tar.xz`/`.deb` برای لینوکس یا `.msi` برای ویندوز.
- **MongoDB Community Server** (نسخه ۶.۰ یا ۷.۰): بسته آفلاین `.tgz`/`.deb` برای لینوکس یا `.msi` برای ویندوز.
- **MongoDB Database Tools** (شامل `mongodump` و `mongorestore` برای پشتیبان‌گیری روزانه): فایل `.deb` یا `.msi`.

#### ۲) آماده‌سازی پروژه و دانلود پیشاپیش تمام بسته‌های `npm`
در پوشه پروژه روی کمپیوتر دارای انترنت دستورات ذیل را اجرا کنید:

```bash
# ۱. دانلود و نصب تمام بسته‌های server و client در کش محلی پروژه (بدون دانلود خودکار Chromium)
npm run prepare:offline-cache

# ۲. ساخت فایل‌های نهایی فرانت‌اند در پوشه client/dist
npm run build
```

این دستور دو کار انجام می‌دهد:
- تمام بسته‌های مورد نیاز را در `server/node_modules` و `client/node_modules` نصب می‌کند.
- یک کش کامل آفلاین `npm` نیز در پوشه `offline/npm-cache` ذخیره می‌سازد تا در سرور مقصد در صورت نیاز بتوانید کاملاً آفلاین دوباره نصب نمایید.

#### ۳) دانلود پیشاپیش مرورگر Chromium برای تولید PDF
روی همان کمپیوتر دارای انترنت، نسخه قابل‌حمل (Portable) مرورگر Chrome for Testing / Chromium را مستقیماً داخل پوشه `offline/chromium` پروژه دانلود نمایید:

```bash
# برای سرور لینوکس ۶۴ بیتی (Ubuntu / Debian):
npx @puppeteer/browsers install chrome@stable --platform linux --path ./offline/chromium

# یا اگر سرور مقصد ویندوز ۶۴ بیتی است:
npx @puppeteer/browsers install chrome@stable --platform win64 --path ./offline/chromium
```

*(در لینوکس Ubuntu/Debian اگر کتابخانه‌های گرافیکی پایه روی سرور نصب نیست، بسته‌های `.deb` مربوط به `libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2` را نیز با `apt-get download` در پوشه `installers/chrome-deps/` ذخیره کنید.)*

#### ۴) بسته‌بندی برای انتقال با فلش / هارد اکسترنال
کل پوشه پروژه (شامل `server/node_modules`، `client/node_modules`، `client/dist`، `public/fonts`، `public/logos` و `offline/`) را به همراه پوشه `installers/` فشرده و روی فلش کاپی کنید:

```bash
tar -czf kunduz-certificate-offline-bundle.tar.gz \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='backups' \
  --exclude='server/tmp' \
  .
```

---

### بخش ب — نصب و راه‌اندازی روی سرور بدون انترنت (Offline Server)

۱. **نصب نرم‌افزارهای پایه:** Node.js، MongoDB Community Server و MongoDB Database Tools را از پوشه `installers/` نصب و سرویس MongoDB را فعال کنید:
```bash
# در لینوکس (Ubuntu/Debian):
sudo systemctl enable --now mongod

# نصب کتابخانه‌های وابسته Chromium (فقط در لینوکس در صورت نیاز):
sudo dpkg -i installers/chrome-deps/*.deb
```

۲. **استخراج بسته پروژه در مسیر دائمی سرور** (مثلاً `/opt/kunduz-certificates` در لینوکس یا `C:\kunduz-certificates` در ویندوز):
```bash
sudo mkdir -p /opt/kunduz-certificates
sudo chown "$USER:$USER" /opt/kunduz-certificates
tar -xzf kunduz-certificate-offline-bundle.tar.gz -C /opt/kunduz-certificates
cd /opt/kunduz-certificates
```

۳. **(اختیاری) نصب مجدد بسته‌ها از کش آفلاین بدون انترنت:**  
اگر پوشه‌های `node_modules` را منتقل نکرده‌اید و فقط `offline/npm-cache` را آورده‌اید:
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm --prefix server ci --offline --cache ../offline/npm-cache --no-audit --no-fund
npm --prefix client ci --offline --cache ../offline/npm-cache --no-audit --no-fund
npm run build
```

۴. **بررسی مسیر فایل اجرایی Chromium:**  
سیستم به صورت خودکار پوشه `./offline/chromium` و مسیرهای رایج سیستم‌عامل را شناسایی می‌کند. همچنین می‌توانید مسیر دقیق فایل اجرایی را پیدا کرده و در `.env` قرار دهید:
```bash
# پیدا کردن مسیر دقیق فایل اجرایی دانلودشده در لینوکس:
find ./offline/chromium -type f -name chrome
```

۵. **اجرای ممیزی آفلاین برای اطمینان کامل:**
```bash
npm run audit:offline
```

---

## ۲. تنظیمات فایل `.env`

فایل نمونه را به `.env` کاپی کرده و ویرایش نمایید:

```bash
cp .env.example .env
```

یک کلید تصادفی قوی برای `JWT_SECRET` تولید کنید:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

مهم‌ترین متغیرهای فایل `.env`:

| متغیر | مقدار نمونه | توضیح |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | در سرور اصلی پوهنتون روی `production` قرار دهید (برای توسعه: `development`). |
| `HOST` | `0.0.0.0` | اجازه اتصال سایر کمپیوترهای شبکه محلی (LAN) به سرور. |
| `PORT` | `5000` | پورت اجرای سیستم (وب‌سایت + API هر دو روی همین پورت اجرا می‌شوند). |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/kunduz_certificates` | آدرس دیتابیس محلی MongoDB روی سرور. |
| `JWT_SECRET` | *(رشته تصادفی حداقل ۳۲ حرفی)* | کلید امضای توکن ورود کارمندان و مدیر — **حتماً تغییر دهید**. |
| `JWT_EXPIRES_IN` | `8h` | مدت اعتبار نشست کاربری کارمندان (یک روز کاری). |
| `LAN_BASE_URL` | `http://192.168.1.10:5000` | **بسیار مهم:** آدرس IP ثابت سرور و پورت در شبکه داخلی. کود QR روی تصدیق‌نامه‌ها به `LAN_BASE_URL/verify/:serial` اشاره می‌کند. |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | مسیر فایل اجرایی Chromium/Chrome آفلاین (اگر خالی باشد، `./offline/chromium` یا مرورگر سیستم به صورت خودکار انتخاب می‌شود). |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` | جلوگیری کامل از هرگونه تلاش برای دانلود مرورگر از انترنت. |
| `BACKUP_DIR` | `./backups` | پوشه ذخیره پشتیبان‌های روزانه دیتابیس. |
| `BACKUP_KEEP_COUNT` | `14` | تعداد پشتیبان‌های تاریخ‌دار نگهداری‌شده (۱۴ روز آخر). |
| `SEED_ADMIN_PASSWORD` | `Admin@12345` | رمز اولیه مدیر سیستم هنگام اجرای `npm run seed` (پس از اولین ورود تغییر دهید). |
| `SEED_OFFICER_PASSWORD` | `Officer@12345` | رمز اولیه کارمند هنگام اجرای `npm run seed` (پس از اولین ورود تغییر دهید). |

---

## ۳. بارگذاری اطلاعات اولیه (Seeding)

برای ایجاد حساب‌های اولیه مدیر و کارمند، پوهنځی‌ها و دیپارتمنت‌های سه‌زبانه پوهنتون کندز، هر ۸ قالب تصدیق‌نامه، نشان‌های رسمی و چند درخواست نمونه آزمایشی:

```bash
# بارگذاری ایمن (بدون حذف اطلاعات قبلی)
npm run seed

# فقط در محیط آزمایشی — پاک‌سازی کامل و بارگذاری مجدد داده‌های نمونه:
npm run seed:reset
```

### حساب‌های پیش‌فرض پس از Seeding

| نقش | نام کاربری | رمز عبور اولیه |
| :--- | :--- | :--- |
| **مدیر سیستم (`admin`)** | `admin` | `Admin@12345` |
| **کارمند امور محصلان (`officer`)** | `officer` | `Officer@12345` |

> **هشدار امنیتی:** بلافاصله پس از نصب رسمی، با هر دو حساب وارد شده و از دکمه **«رمز عبور»** در نوار بالا رمزهای پیش‌فرض را تغییر دهید و درخواست‌های نمونه آزمایشی (`KU-1405-TST*`) را پیش از بهره‌برداری رسمی پاک نمایید.

### تولید هر ۸ نمونه تصدیق‌نامه PDF برای بررسی چاپی

```bash
npm run generate:samples
```
تمام ۸ فایل PDF در پوشه `server/tmp/sample-pdfs/` (از `certificate-01-classic.pdf` تا `certificate-08-gold-corners.pdf`) ساخته می‌شوند.

---

## ۴. اجرا روی شبکه محلی پوهنتون (LAN)

### گام ۱: تنظیم IP ثابت برای سرور
در تنظیمات شبکه سرور یا راوتر داخلی پوهنتون، یک آدرس IP ثابت (Static IP) برای کمپیوتر سرور تعیین کنید (مثلاً `192.168.1.10`). برای مشاهده IP فعلی سرور:
- در لینوکس: `hostname -I`
- در ویندوز: `ipconfig`

مقدار `HOST=0.0.0.0`، `PORT=5000` و `LAN_BASE_URL=http://192.168.1.10:5000` را در `.env` ثبت کنید.

### گام ۲: باز کردن پورت ۵۰۰۰ در فایروال شبکه داخلی

```bash
# در لینوکس (Ubuntu — اجازه دسترسی فقط به رنج شبکه داخلی):
sudo ufw allow from 192.168.1.0/24 to any port 5000 proto tcp
```
- در ویندوز: در **Windows Defender Firewall → Advanced Settings → Inbound Rules** یک قانون **TCP Port 5000 (Allow — Private/Domain Network)** ایجاد نمایید.

### گام ۳: ساخت فرانت‌اند و اجرای کامل سیستم

```bash
npm run build
npm start
```

اکنون سرور Express هم رابط کاربری دری (`client/dist`)، هم فونت‌ها و لوگوهای محلی، و هم تمام APIها و تولید PDF را یکجا اجرا می‌کند.

### گام ۴: دسترسی از سایر کمپیوترها و مبایل‌های شبکه محلی
هر کمپیوتر یا مبایل متصل به همان شبکه داخلی (کابل LAN یا وای‌فای داخلی پوهنتون) کافی است مرورگر خود را باز کرده و آدرس ذیل را وارد نماید:

```text
http://SERVER_IP:PORT
مثال: http://192.168.1.10:5000
```

- **صفحه ثبت درخواست متقاضیان:** `http://SERVER_IP:PORT/`
- **صفحه پیگیری وضعیت درخواست:** `http://SERVER_IP:PORT/track`
- **صفحه عمومی تأیید اصالت (کود QR):** `http://SERVER_IP:PORT/verify/KU-2026-000001`
- **ورود کارمندان و مدیریت:** `http://SERVER_IP:PORT/login`
- **پنل کارمند امور محصلان:** `http://SERVER_IP:PORT/officer/requests`
- **پنل مدیر سیستم:** `http://SERVER_IP:PORT/admin/users`، `/admin/catalog`، `/admin/templates`، `/admin/reports`

### گام ۵ (پیشنهادی): اجرای دائمی خودکار در لینوکس با `systemd`
فایل `/etc/systemd/system/kunduz-certificates.service` را ایجاد نمایید:

```ini
[Unit]
Description=Kunduz University Offline Certificate System
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/kunduz-certificates
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

سپس سرویس را فعال کنید:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kunduz-certificates
```

---

## ۵. پشتیبان‌گیری روزانه (نگهداری ۱۴ نسخه آخر) و بازیابی

اسکریپت پشتیبان‌گیری دیتابیس را با `mongodump --gzip` در پوشه تاریخ‌دار `backups/backup-YYYY-MM-DD` همراه با فایل کنترول سلامت `SHA256SUMS.txt` ذخیره کرده و به صورت خودکار **فقط ۱۴ پشتیبان آخر** را نگه می‌دارد:

```bash
# اجرای دستی پشتیبان‌گیری (ویندوز و لینوکس)
npm run backup

# یا اجرای اسکریپت Bash در لینوکس
./scripts/backup-db.sh

# بازیابی اطلاعات از یک پشتیبان مشخص
./scripts/restore-db.sh ./backups/backup-2026-11-17
```

برای تنظیم زمان‌بندی روزانه خودکار (هر شب ساعت ۰۲:۰۰ بامداد در `crontab` یا Windows Task Scheduler) و مراحل کامل بازیابی، سند **[`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md)** را مطالعه نمایید.

---

## ۶. اجرای تست‌ها و ممیزی آفلاین

```bash
# ممیزی کامل آفلاین (بررسی نبود CDN/لینک بیرونی و سلامت فونت‌ها، لوگوها و ۸ قالب)
npm run audit:offline

# اجرای مجموعه کامل تست‌های خودکار (در دیتابیس مجزای آزمایشی بدون تغییر داده‌های اصلی)
npm test

# تولید هر ۸ تصدیق‌نامه نمونه PDF برای بررسی ظاهری و چاپی
npm run generate:samples
```

---

## ۷. عیب‌یابی مشکلات رایج (Troubleshooting)

1. **خطای «فایل مرورگر Chromium یافت نشد» هنگام تولید PDF:**
   - بررسی کنید که مسیر `PUPPETEER_EXECUTABLE_PATH` در فایل `.env` دقیقاً به فایل اجرایی موجود اشاره کند (مثلاً `/usr/bin/chromium` در لینوکس یا `C:\Program Files\Google\Chrome\Application\chrome.exe` در ویندوز) یا پوشه `./offline/chromium` در ریشه پروژه موجود باشد.
   - در لینوکس دستور `$PUPPETEER_EXECUTABLE_PATH --version` را اجرا کنید؛ اگر پیغام کمبود کتابخانه `.so` (مانند `libnss3.so`) نمایش داده شد، بسته‌های `.deb` مربوطه را نصب کرده و `sudo ldconfig` بزنید.

2. **سایر کمپیوترهای شبکه نمی‌توانند `http://SERVER_IP:PORT` را باز کنند:**
   - مطمئن شوید در `.env` مقدار `HOST=0.0.0.0` (نه `127.0.0.1`) تنظیم شده و سرور پس از تغییر ری‌استارت شده است.
   - بررسی کنید هر دو کمپیوتر در یک شبکه محلی (Subnet) قرار دارند (`ping SERVER_IP`).
   - فایروال سرور (`ufw` در لینوکس یا Windows Defender Firewall در ویندوز) را بررسی کنید تا پورت `5000` روی شبکه داخلی باز باشد.

3. **کود QR تصدیق‌نامه هنگام اسکن با مبایل باز نمی‌شود:**
   - بررسی کنید `LAN_BASE_URL` در `.env` روی IP واقعی سرور تنظیم شده باشد (مثلاً `http://192.168.1.10:5000`) و نه `http://localhost:5000`.
   - مبایل اسکن‌کننده باید به وای‌فای شبکه داخلی پوهنتون کندز متصل باشد.

4. **خطای اتصال به دیتابیس MongoDB (`ECONNREFUSED 127.0.0.1:27017`):**
   - وضعیت سرویس MongoDB را بررسی کنید: در لینوکس `sudo systemctl status mongod` و در ویندوز سرویس **MongoDB Server** در `services.msc`.
   - از خالی نبودن فضای دیسک سرور (`df -h`) اطمینان حاصل کنید.

5. **حاشیه اضافی یا کوچک شدن صفحه هنگام چاپ روی کاغذ:**
   - در پنجره چاپ مرورگر یا برنامه نمایش PDF، اندازه کاغذ را روی **A4**، جهت را **Landscape (افقی)**، مقیاس (Scale) را روی **100% / Actual Size** و حاشیه‌ها (Margins) را روی **None / بدون حاشیه** تنظیم کنید و گزینه **Background Graphics** را فعال نگه دارید.

6. **نمایش هشدار طولانی بودن متن تصدیق‌نامه:**
   - سیستم به صورت خودکار اندازه فونت را کوچک می‌کند تا کل محتوا در **یک صفحه A4 افقی** جای بگیرد. اگر هشدار نمایش داده شد، برای زیبایی و خوانایی بهتر جملات اضافی را در بخش ویرایش متن کوتاه‌تر نمایید.

7. **خطای `'mongodump' is not installed` هنگام اجرای پشتیبان‌گیری:**
   - بسته آفلاین **MongoDB Database Tools** را نصب نمایید (در ویندوز مسیر پوشه `bin` آن را به `PATH` اضافه کنید یا متغیر `MONGODUMP_PATH` را تنظیم نمایید).

---

## ۸. چک‌لیست نهایی تأیید سیستم (Final Verification Checklist)

- [x] **یک صفحه کامل A4 افقی:** تمام تصدیق‌نامه‌های PDF دقیقاً در **۱ صفحه** با ابعاد استاندارد `297mm × 210mm` (`@page { size: A4 landscape; margin: 0 }`) و `printBackground: true` تولید می‌شوند و متون طولانی بدون سرریز به صفحه دوم به صورت خودکار تنظیم می‌گردند.
- [x] **پیوستگی صحیح حروف دری و پشتو و جهت راست‌به‌چپ:** ستون دری (وسط) و ستون پشتو (راست، شامل حروف خاص پشتو `ښ، ږ، څ، ځ، ړ، ګ، ڼ، ې،ۍ` و `د ثبت ګڼه`) کاملاً راست‌به‌چپ و با اتصال طبیعی حروف رندر می‌شوند و ستون انگلیسی (چپ) چپ‌به‌راست است؛ شماره‌های تذکره و سریال با ایزوله‌سازی BiDi به هم نمی‌ریزند.
- [x] **نمایش کامل نشان‌های رسمی و فونت‌های محلی:** نشان رسمی پوهنتون کندز در مرکز سرلوحه، نشان وزارت تحصیلات عالی در کنار آن، و فونت‌های محلی `Vazirmatn`، `Noto Naskh Arabic` و `EB Garamond` از پوشه‌های `public/logos` و `public/fonts` در رابط کاربری، پیش‌نمایش و فایل PDF به صورت توکار (Embedded) بارگذاری و نمایش داده می‌شوند.
- [x] **هر ۸ قالب رسمی آزمایش‌شده:** قالب‌های `theme-classic`، `theme-official`، `theme-green`، `theme-modern`، `theme-watermark`، `theme-cream`، `theme-blue-stripes` و `theme-gold-corners` از یک قالب HTML واحد تولید، انتخاب و به PDF تبدیل می‌شوند.
- [x] **کود QR محلی، صفحه تأیید و ثبت تاریخچه چاپ:** کود QR کاملاً آفلاین با آدرس `LAN_BASE_URL/verify/:serial` ساخته می‌شود، صفحه `/verify/:serial` اصالت سند را نمایش می‌دهد و هر بار تولید PDF یا چاپ در مجموعه `printLogs` ثبت می‌گردد.
- [x] **پشتیبان‌گیری روزانه ۱۴ روزه و راهنمای بازیابی:** اسکریپت‌های `scripts/backup-db.sh`، `scripts/backup-db.js` و `scripts/restore-db.sh` به همراه سند `docs/BACKUP_RESTORE.md` آماده و آزمایش‌شده هستند.
- [x] **کارکرد ۱۰۰٪ بدون انترنت:** ممیزی خودکار (`npm run audit:offline`) و تست کامل گردش‌کار با مسدودسازی کامل شبکه بیرونی (`npm test`) بدون هیچ درخواست خارجی یا خطا با موفقیت اجرا گردید.

</div>
