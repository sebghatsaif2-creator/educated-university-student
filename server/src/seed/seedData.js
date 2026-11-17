'use strict';

const {
  DEFAULT_TEXT_TEMPLATES: BASE_TEXT_DEFAULTS,
  DEGREE_LABELS,
} = require('../services/textGenerator');

/**
 * Sample Kunduz University faculties & departments (Dari, Pashto, English).
 */
const FACULTIES_DATA = [
  {
    code: 'CS',
    name: {
      fa: 'پوهنځی کمپیوتر ساینس',
      ps: 'د کمپیوټر ساینس پوهنځی',
      en: 'Faculty of Computer Science',
    },
    departments: [
      {
        code: 'SE',
        name: {
          fa: 'انجنیری نرم‌افزار',
          ps: 'سافټویر انجینري',
          en: 'Software Engineering',
        },
      },
      {
        code: 'IT',
        name: {
          fa: 'تکنالوژی معلوماتی',
          ps: 'معلوماتي ټکنالوژي',
          en: 'Information Technology',
        },
      },
      {
        code: 'IS',
        name: {
          fa: 'سیستم‌های معلوماتی',
          ps: 'معلوماتي سیسټمونه',
          en: 'Information Systems',
        },
      },
    ],
  },
  {
    code: 'EDU',
    name: {
      fa: 'پوهنځی تعلیم و تربیه',
      ps: 'د ښوونې او روزنې پوهنځی',
      en: 'Faculty of Education',
    },
    departments: [
      {
        code: 'MATH',
        name: {
          fa: 'ریاضی',
          ps: 'ریاضي',
          en: 'Mathematics',
        },
      },
      {
        code: 'PHYS',
        name: {
          fa: 'فزیک',
          ps: 'فزیک',
          en: 'Physics',
        },
      },
      {
        code: 'ENG',
        name: {
          fa: 'زبان و ادبیات انگلیسی',
          ps: 'انګلیسي ژبه او ادبیات',
          en: 'English Language and Literature',
        },
      },
      {
        code: 'DARI',
        name: {
          fa: 'زبان و ادبیات دری',
          ps: 'دري ژبه او ادبیات',
          en: 'Dari Language and Literature',
        },
      },
      {
        code: 'PASHTO',
        name: {
          fa: 'زبان و ادبیات پشتو',
          ps: 'پښتو ژبه او ادبیات',
          en: 'Pashto Language and Literature',
        },
      },
    ],
  },
  {
    code: 'AGR',
    name: {
      fa: 'پوهنځی زراعت',
      ps: 'د کرنې پوهنځی',
      en: 'Faculty of Agriculture',
    },
    departments: [
      {
        code: 'AGRO',
        name: {
          fa: 'اگرانومی',
          ps: 'اګرانومي',
          en: 'Agronomy',
        },
      },
      {
        code: 'HORT',
        name: {
          fa: 'هارتیکلچر',
          ps: 'بڼوالي',
          en: 'Horticulture',
        },
      },
      {
        code: 'ANSC',
        name: {
          fa: 'علوم حیوانی',
          ps: 'حیواني علوم',
          en: 'Animal Science',
        },
      },
    ],
  },
  {
    code: 'LAW',
    name: {
      fa: 'پوهنځی حقوق و علوم سیاسی',
      ps: 'د حقوقو او سیاسي علومو پوهنځی',
      en: 'Faculty of Law and Political Science',
    },
    departments: [
      {
        code: 'JUD',
        name: {
          fa: 'قضا و څارنوالی',
          ps: 'قضا او څارنوالي',
          en: 'Judiciary and Prosecution',
        },
      },
      {
        code: 'DIPL',
        name: {
          fa: 'اداره و دیپلوماسی',
          ps: 'اداره او ډیپلوماسي',
          en: 'Administration and Diplomacy',
        },
      },
    ],
  },
  {
    code: 'ECO',
    name: {
      fa: 'پوهنځی اقتصاد',
      ps: 'د اقتصاد پوهنځی',
      en: 'Faculty of Economics',
    },
    departments: [
      {
        code: 'FIN',
        name: {
          fa: 'امور مالی و بانکی',
          ps: 'مالي او بانکي چارې',
          en: 'Finance and Banking',
        },
      },
      {
        code: 'BBA',
        name: {
          fa: 'اداره و تشبثات',
          ps: 'د سوداګرۍ اداره',
          en: 'Business Administration',
        },
      },
    ],
  },
  {
    code: 'SHA',
    name: {
      fa: 'پوهنځی شرعیات',
      ps: 'د شرعیاتو پوهنځی',
      en: 'Faculty of Sharia',
    },
    departments: [
      {
        code: 'FIQH',
        name: {
          fa: 'فقه و قانون',
          ps: 'فقه او قانون',
          en: 'Fiqh and Law',
        },
      },
      {
        code: 'ISL',
        name: {
          fa: 'تعلیمات اسلامی',
          ps: 'اسلامي زده کړې',
          en: 'Islamic Studies',
        },
      },
    ],
  },
];

/**
 * The 8 certificate theme records required by the system.
 */
const TEMPLATES_DATA = [
  {
    key: 'classic',
    name: 'کلاسیک اکادمیک',
    labels: {
      fa: 'کلاسیک اکادمیک',
      ps: 'کلاسیک اکاډمیک',
      en: 'Classic Academic',
    },
    description: 'چوکات دوخطی کلاسیک با حاشیه متقارن مناسب برای تصدیق‌نامه‌های رسمی فراغت.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'official',
    name: 'رسمی وزارت تحصیلات عالی',
    labels: {
      fa: 'رسمی وزارت تحصیلات عالی',
      ps: 'د لوړو زده کړو وزارت رسمي بڼه',
      en: 'Official Ministry Standard',
    },
    description: 'قالب رسمی معیاری وزارت تحصیلات عالی و پوهنتون کندز با سرلوحه کامل سه‌زبانه.',
    isActive: true,
    isDefault: true,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'green',
    name: 'سبز زمردی پوهنتون',
    labels: {
      fa: 'سبز زمردی پوهنتون',
      ps: 'د پوهنتون زمردي شین',
      en: 'Emerald Green',
    },
    description: 'چوکات سبز تیره اکادمیک با تزئینات ظریف طلایی.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'modern',
    name: 'مدرن مینیمال',
    labels: {
      fa: 'مدرن مینیمال',
      ps: 'عصري ساده بڼه',
      en: 'Modern Minimal',
    },
    description: 'طراحی ساده و معاصر با خطوط هندسی منظم و خوانایی بالا.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'watermark',
    name: 'واترمارک نشان پوهنتون',
    labels: {
      fa: 'واترمارک نشان پوهنتون',
      ps: 'د پوهنتون نښان واټرمارک',
      en: 'Emblem Watermark',
    },
    description: 'دارای نشان کم‌رنگ پوهنتون کندز در پس‌زمینه مرکزی برای اصالت بیشتر.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'cream',
    name: 'کاغذ کرم تشریفاتی',
    labels: {
      fa: 'کاغذ کرم تشریفاتی',
      ps: 'تشریفاتي کرېم بڼه',
      en: 'Ceremonial Cream',
    },
    description: 'زمینه کرم ملایم به سبک اسناد دیپلوماتیک و اکادمیک با حاشیه قهوه‌ای و طلایی.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'blue-stripes',
    name: 'نوارهای آبی رسمی',
    labels: {
      fa: 'نوارهای آبی رسمی',
      ps: 'رسمي شنې پټۍ',
      en: 'Blue Stripes',
    },
    description: 'دارای نوارهای آبی سرمه‌ای رسمی در بالا و پایین صفحه سه‌زبانه.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
  {
    key: 'gold-corners',
    name: 'گوشه‌های طلایی',
    labels: {
      fa: 'گوشه‌های طلایی',
      ps: 'طلايي کونجونه',
      en: 'Gold Corners',
    },
    description: 'چوکات تشریفاتی با نقش‌ونگار هندسی طلایی در هر چهار گوشه صفحه A4 افقی.',
    isActive: true,
    isDefault: false,
    textDefaults: BASE_TEXT_DEFAULTS,
  },
];

/**
 * Default offline asset records pointing to `public/logos/`.
 */
const ASSETS_DATA = [
  {
    key: 'ministry-logo',
    name: 'لوگوی وزارت تحصیلات عالی',
    type: 'logo',
    filePath: '/public/logos/ministry-logo.png',
    mimeType: 'image/png',
    isActive: true,
  },
  {
    key: 'university-logo',
    name: 'لوگوی پوهنتون کندز',
    type: 'logo',
    filePath: '/public/logos/university-logo.png',
    mimeType: 'image/png',
    isActive: true,
  },
  {
    key: 'watermark-logo',
    name: 'واترمارک پوهنتون کندز',
    type: 'watermark',
    filePath: '/public/logos/university-logo.png',
    mimeType: 'image/png',
    isActive: true,
  },
];

/**
 * Fictional test certificate requests covering all statuses and both genders.
 */
const REQUESTS_DATA = [
  {
    trackingCode: 'KU-1405-TST001',
    firstName: 'احمد فواد',
    fatherName: 'غلام فاروق',
    firstNameI18n: { fa: 'احمد فواد', ps: 'احمد فواد', en: 'Ahmad Fawad' },
    fatherNameI18n: { fa: 'غلام فاروق', ps: 'غلام فاروق', en: 'Ghulam Farooq' },
    gender: 'male',
    nationalId: '1399-0201-45821',
    phone: '0702345671',
    email: 'fawad.student@example.af',
    facultyCode: 'CS',
    departmentCode: 'SE',
    gradYearSH: 1403,
    gradYearAD: 2024,
    degreeLevel: 'bachelor',
    notes: 'درخواست تصدیق‌نامه فراغت جهت شمولیت در برنامه ماستری.',
    status: 'pending',
  },
  {
    trackingCode: 'KU-1405-TST002',
    firstName: 'مریم',
    fatherName: 'عبدالرشید',
    firstNameI18n: { fa: 'مریم', ps: 'مریم', en: 'Maryam' },
    fatherNameI18n: { fa: 'عبدالرشید', ps: 'عبدالرشید', en: 'Abdul Rashid' },
    gender: 'female',
    nationalId: '1400-0512-33190',
    phone: '0789123452',
    email: 'maryam.edu@example.af',
    facultyCode: 'EDU',
    departmentCode: 'MATH',
    gradYearSH: 1403,
    gradYearAD: 2024,
    degreeLevel: 'bachelor',
    notes: 'لطفاً هجای انگلیسی نام مطابق تذکره الکترونیکی درج گردد.',
    status: 'approved',
    serial: 'KU-2026-000001',
    officialNo: '1405/EDU/0118',
    templateKey: 'official',
  },
  {
    trackingCode: 'KU-1405-TST003',
    firstName: 'نجیب‌الله',
    fatherName: 'محمد ظاهر',
    firstNameI18n: { fa: 'نجیب‌الله', ps: 'نجیب‌الله', en: 'Najibullah' },
    fatherNameI18n: { fa: 'محمد ظاهر', ps: 'محمد ظاهر', en: 'Mohammad Zahir' },
    gender: 'male',
    nationalId: '1398-0814-77412',
    phone: '0799456123',
    email: '',
    facultyCode: 'AGR',
    departmentCode: 'AGRO',
    gradYearSH: 1402,
    gradYearAD: 2023,
    degreeLevel: 'bachelor',
    notes: 'جهت ارائه به ریاست زراعت ولایت کندز.',
    status: 'printed',
    serial: 'KU-2026-000002',
    officialNo: '1405/AGR/0074',
    templateKey: 'gold-corners',
  },
  {
    trackingCode: 'KU-1405-TST004',
    firstName: 'حسنا',
    fatherName: 'سید کریم',
    firstNameI18n: { fa: 'حسنا', ps: 'حسنا', en: 'Husna' },
    fatherNameI18n: { fa: 'سید کریم', ps: 'سید کریم', en: 'Sayed Karim' },
    gender: 'female',
    nationalId: '1401-0309-19204',
    phone: '0771882234',
    email: 'husna.eco@example.af',
    facultyCode: 'ECO',
    departmentCode: 'FIN',
    gradYearSH: 1404,
    gradYearAD: 2025,
    degreeLevel: 'bachelor',
    notes: '',
    status: 'pending',
  },
  {
    trackingCode: 'KU-1405-TST005',
    firstName: 'حامد',
    fatherName: 'نورمحمد',
    firstNameI18n: { fa: 'حامد', ps: 'حامد', en: 'Hamid' },
    fatherNameI18n: { fa: 'نورمحمد', ps: 'نورمحمد', en: 'Noor Mohammad' },
    gender: 'male',
    nationalId: '1397-1102-60518',
    phone: '0744551290',
    email: '',
    facultyCode: 'LAW',
    departmentCode: 'JUD',
    gradYearSH: 1401,
    gradYearAD: 2022,
    degreeLevel: 'bachelor',
    notes: 'تصدیق‌نامه فراغت دوره لیسانس.',
    status: 'rejected',
    rejectReason: 'نمبر تذکره با جدول فراغت دیپارتمنت مطابقت ندارد؛ لطفاً با اصل تذکره مراجعه نمایید.',
  },
  {
    trackingCode: 'KU-1405-TST006',
    firstName: 'فرشته',
    fatherName: 'محمد اسماعیل',
    firstNameI18n: { fa: 'فرشته', ps: 'فرښته', en: 'Fereshta' },
    fatherNameI18n: { fa: 'محمد اسماعیل', ps: 'محمد اسماعیل', en: 'Mohammad Ismail' },
    gender: 'female',
    nationalId: '1400-0719-88341',
    phone: '0708991145',
    email: 'fereshta.cs@example.af',
    facultyCode: 'CS',
    departmentCode: 'IT',
    gradYearSH: 1404,
    gradYearAD: 2025,
    degreeLevel: 'bachelor',
    notes: 'درخواست تصدیق‌نامه سه‌زبانه.',
    status: 'approved',
    serial: 'KU-2026-000003',
    officialNo: '1405/CS/0205',
    templateKey: 'green',
  },
];

module.exports = {
  BASE_TEXT_DEFAULTS,
  DEGREE_LABELS,
  FACULTIES_DATA,
  TEMPLATES_DATA,
  ASSETS_DATA,
  REQUESTS_DATA,
};
