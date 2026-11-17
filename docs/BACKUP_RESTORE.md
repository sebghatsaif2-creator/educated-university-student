<div dir="rtl">

# راهنمای پشتیبان‌گیری روزانه و بازیابی دیتابیس (Backup & Restore)

**سیستم آفلاین درخواست و چاپ تصدیق‌نامه — پوهنتون کندز (معاونیت امور محصلان)**

این سند نحوه پشتیبان‌گیری خودکار روزانه از دیتابیس MongoDB با ابزار رسمی `mongodump` (با نگهداری **۱۴ نسخه آخر**) و نحوه بازیابی کامل اطلاعات در صورت بروز مشکل سخت‌افزاری یا خطای انسانی را شرح می‌دهد.

---

## ۱. پیش‌نیاز ابزار پشتیبان‌گیری

ابزارهای `mongodump` و `mongorestore` بخشی از بسته رسمی **MongoDB Database Tools** هستند:

- بررسی نصب بودن در سرور:
  ```bash
  mongodump --version
  mongorestore --version
  ```
- اگر نصب نبود، بسته آفلاین `mongodb-database-tools` (فایل `.deb` برای Ubuntu/Debian یا `.msi` برای Windows Server) را روی کمپیوتر دارای انترنت دانلود نموده، با فلش به سرور آفلاین منتقل و نصب نمایید:
  ```bash
  # لینوکس (Ubuntu / Debian) — بدون نیاز به انترنت
  sudo dpkg -i mongodb-database-tools-ubuntu*-x86_64-*.deb
  ```
  *(در ویندوز مسیر پوشه `bin` ابزار، مثلاً `C:\Program Files\MongoDB\Tools\100\bin` را به `PATH` اضافه کنید یا در `.env` متغیر `MONGODUMP_PATH` را تنظیم نمایید.)*

---

## ۲. تنظیمات در فایل `.env`

در فایل `.env` ریشه پروژه متغیرهای ذیل به صورت پیش‌فرض تنظیم شده‌اند:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/kunduz_certificates
BACKUP_DIR=./backups
BACKUP_KEEP_COUNT=14
```

- **`BACKUP_DIR`**: مسیر ذخیره نسخه‌های پشتیبان (توصیه می‌شود روی درایو جداگانه یا هارد اکسترنال تنظیم شود، مثلاً `/srv/ku-backups` یا `D:\KU-Backups`).
- **`BACKUP_KEEP_COUNT`**: تعداد پوشه‌های تاریخ‌دار نگهداری‌شده (پیش‌فرض: **`14`** روز اخیر؛ نسخه‌های قدیمی‌تر فقط **پس از** موفقیت کامل پشتیبان جدید حذف می‌شوند).

---

## ۳. اجرای دستی پشتیبان‌گیری

از پوشه اصلی پروژه یکی از دو دستور ذیل را اجرا کنید:

```bash
# روش اول (سازگار با لینوکس، ویندوز و macOS)
npm run backup

# روش دوم (اسکریپت مستقیم Bash برای لینوکس / کرون)
./scripts/backup-db.sh
```

### ساختار پوشه پشتیبان ایجادشده

هر بار اجرا، یک پوشه تاریخ‌دار مستقل ایجاد می‌گردد:

```text
backups/
├── backup-2026-11-04/
├── backup-2026-11-05/
├── ...
└── backup-2026-11-17/
    ├── kunduz_certificates/
    │   ├── users.bson.gz
    │   ├── faculties.bson.gz
    │   ├── departments.bson.gz
    │   ├── templates.bson.gz
    │   ├── requests.bson.gz
    │   ├── printlogs.bson.gz
    │   ├── counters.bson.gz
    │   ├── assets.bson.gz
    │   └── *.metadata.json.gz
    ├── SHA256SUMS.txt       # امضای دیجیتال بررسی سلامت فایل‌ها
    └── backup-info.json     # زمان، تعداد فایل‌ها و حجم پشتیبان
```

> **نکته ایمنی:** اسکریپت ابتدا فایل‌ها را در پوشه موقت `.staging-...` ذخیره می‌کند. اگر `mongodump` به هر دلیل خطا دهد، هیچ‌یک از ۱۴ پشتیبان سالم قبلی پاک نخواهد شد. همچنین اگر در یک روز دو بار پشتیبان بگیرید، نسخه دوم با پسوند ساعت (`backup-YYYY-MM-DD_HHMMSS`) ذخیره می‌شود تا نسخه قبلی رونویسی نگردد.

---

## ۴. زمان‌بندی خودکار روزانه (نگهداری ۱۴ روز آخر)

### الف) در سرور لینوکس (`crontab`)

۱. فایل زمان‌بندی را باز کنید:
```bash
crontab -e
```
۲. خط ذیل را در انتهای فایل اضافه کنید تا هر شب ساعت **۰۲:۰۰ بامداد** پشتیبان گرفته شود و فقط ۱۴ نسخه آخر باقی بماند:
```cron
0 2 * * * /opt/kunduz-certificates/scripts/backup-db.sh >> /var/log/ku-cert-backup.log 2>&1
```
*(مسیر `/opt/kunduz-certificates` را با مسیر واقعی پروژه در سرور خود جایگزین نمایید.)*

### ب) در سرور ویندوز (Task Scheduler)

۱. برنامه **Task Scheduler** را باز کرده و **Create Basic Task** را انتخاب کنید.
۲. نام وظیفه را `Kunduz University DB Daily Backup` بگذارید و زمان‌بندی را **Daily** (مثلاً ساعت `02:00 AM`) انتخاب کنید.
۳. در بخش **Action → Start a program**:
   - **Program/script:** `C:\Program Files\nodejs\node.exe`
   - **Add arguments:** `scripts\backup-db.js`
   - **Start in:** `C:\kunduz-certificates`

### ج) توصیه امنیتی (قانون ۳-۲-۱ آفلاین)

هفته‌ای یک بار آخرین پوشه داخل `backups/` به همراه فایل `.env` و پوشه `public/logos` را روی یک **فلش یا هارد اکسترنال رمزگذاری‌شده** کاپی و در الماری امن معاونیت امور محصلان نگهداری نمایید.

---

## ۵. راهنمای گام‌به‌گام بازیابی اطلاعات (Restore Guide)

### حالت اول: بازیابی کامل دیتابیس (توصیه‌شده)

۱. **توقف موقت برنامه وب** (تا هنگام بازیابی درخواستی ثبت نشود):
```bash
# اگر با systemd اجرا است:
sudo systemctl stop kunduz-certificates
# یا اگر در ترمینال اجرا است: کلیدهای Ctrl + C
```

۲. **مشاهده فهرست پشتیبان‌های موجود:**
```bash
ls -1 ./backups
```

۳. **بررسی سلامت و اجرای بازیابی با اسکریپت خودکار (لینوکس/macOS):**
```bash
./scripts/restore-db.sh ./backups/backup-2026-11-17
```
این اسکریپت ابتدا فایل `SHA256SUMS.txt` را بررسی کرده، نام دیتابیس و مسیر پشتیبان را نمایش می‌دهد و پس از تأیید شما (`yes`)، تمام مجموعه‌ها را با `mongorestore --gzip --drop` بازگردانی می‌نماید.

۴. **اجرای مستقیم `mongorestore` (در ویندوز یا لینوکس بدون اسکریپت):**
```bash
mongorestore --uri="mongodb://127.0.0.1:27017/kunduz_certificates" --gzip --drop --dir="./backups/backup-2026-11-17/kunduz_certificates"
```

۵. **راه‌اندازی مجدد سرور و بررسی صحت داده‌ها:**
```bash
# راه‌اندازی مجدد
npm start
# (یا: sudo systemctl start kunduz-certificates)

# بررسی وضعیت سلامت سرور
curl http://127.0.0.1:5000/api/health
```
سپس با حساب کارمند یا مدیر وارد سیستم شوید و فهرست درخواست‌ها، شماره سریال آخرین تصدیق‌نامه (`counters`)، تاریخچه چاپ (`printLogs`) و یک صفحه تأیید `/verify/:serial` را بررسی کنید.

### حالت دوم: بازیابی فقط یک مجموعه خاص (مثلاً `templates` یا `requests`)

اگر فقط نیاز به بازگردانی یک جدول بدون دست زدن به سایر اطلاعات دارید:

```bash
mongorestore \
  --uri="mongodb://127.0.0.1:27017/kunduz_certificates" \
  --nsInclude="kunduz_certificates.templates" \
  --gzip \
  --drop \
  "./backups/backup-2026-11-17/kunduz_certificates/templates.bson.gz"
```

### حالت سوم: آزمایش بازیابی روی دیتابیس موقت (توصیه ماهانه)

برای اطمینان از سالم بودن پشتیبان بدون تغییر در دیتابیس اصلی:

```bash
mongorestore \
  --uri="mongodb://127.0.0.1:27017" \
  --nsFrom="kunduz_certificates.*" \
  --nsTo="kunduz_certificates_restore_check.*" \
  --gzip \
  --drop \
  --dir="./backups/backup-2026-11-17"

# حذف دیتابیس آزمایشی پس از بررسی:
mongosh "mongodb://127.0.0.1:27017/kunduz_certificates_restore_check" --eval "db.dropDatabase()"
```

</div>
