'use strict';

/**
 * Gender-specific terms for trilingual certificate generation:
 * - Dari (fa):    محترم / محترمه, فرزند / دختر
 * - English (en): Mr. / Ms., son / daughter, his / her (he/she, him/her)
 * - Pashto (ps):  ښاغلي / ځلانده, زوی / لور (TODO: native Pashto speaker review required)
 */
const GENDER_TERMS = Object.freeze({
  fa: Object.freeze({
    male: Object.freeze({
      title: 'محترم',
      relation: 'فرزند',
      possessive: 'موصوف',
      pronoun: 'وی',
      objectPronoun: 'وی',
    }),
    female: Object.freeze({
      title: 'محترمه',
      relation: 'دختر',
      possessive: 'موصوفه',
      pronoun: 'وی',
      objectPronoun: 'وی',
    }),
  }),
  ps: Object.freeze({
    // TODO: A native Pashto speaker must review the Pashto gendered terms and default wording.
    male: Object.freeze({
      title: 'ښاغلي',
      relation: 'زوی',
      possessive: 'د نوموړي',
      pronoun: 'نوموړی',
      objectPronoun: 'نوموړي',
    }),
    female: Object.freeze({
      title: 'ځلانده',
      relation: 'لور',
      possessive: 'د نوموړې',
      pronoun: 'نوموړې',
      objectPronoun: 'نوموړې',
    }),
  }),
  en: Object.freeze({
    male: Object.freeze({
      title: 'Mr.',
      relation: 'son',
      possessive: 'his',
      pronoun: 'he',
      objectPronoun: 'him',
    }),
    female: Object.freeze({
      title: 'Ms.',
      relation: 'daughter',
      possessive: 'her',
      pronoun: 'she',
      objectPronoun: 'her',
    }),
  }),
});

const DEGREE_LABELS = Object.freeze({
  associate: Object.freeze({
    fa: 'فوق بکلوریا',
    ps: 'فوق بکلوریا',
    en: 'Associate',
  }),
  bachelor: Object.freeze({
    fa: 'لیسانس',
    ps: 'لېسانس',
    en: 'Bachelor',
  }),
  master: Object.freeze({
    fa: 'ماستری',
    ps: 'ماسټري',
    en: 'Master',
  }),
  phd: Object.freeze({
    fa: 'دوکتورا',
    ps: 'دوکتورا',
    en: 'Doctor of Philosophy (PhD)',
  }),
});

const INSTITUTION_LABELS = Object.freeze({
  fa: Object.freeze({
    university: 'پوهنتون کندز',
    ministry: 'وزارت تحصیلات عالی',
  }),
  ps: Object.freeze({
    university: 'د کندز پوهنتون',
    ministry: 'د لوړو زده کړو وزارت',
  }),
  en: Object.freeze({
    university: 'Kunduz University',
    ministry: 'Ministry of Higher Education',
  }),
});

/**
 * Default formal trilingual certificate body texts (male & female versions)
 * for Kunduz University — Ministry of Higher Education, Afghanistan.
 *
 * Supported placeholders:
 *   {{firstName}}, {{fatherName}}, {{nationalId}}, {{faculty}}, {{department}},
 *   {{degreeLevel}}, {{gradYearSH}}, {{gradYearAD}}, {{serial}}, {{officialNo}},
 *   {{title}}, {{relation}}, {{possessive}}, {{pronoun}}, {{objectPronoun}},
 *   {{university}}, {{ministry}}
 */
const DEFAULT_TEXT_TEMPLATES = Object.freeze({
  fa: Object.freeze({
    male:
      'بدین‌وسیله تصدیق می‌گردد که محترم {{firstName}} فرزند {{fatherName}}، دارنده تذکره تابعیت شماره ({{nationalId}})، ' +
      'دوره تحصیلی مقطع {{degreeLevel}} را در دیپارتمنت {{department}} {{faculty}} پوهنتون کندز ' +
      'در سال {{gradYearSH}} هجری شمسی (مطابق {{gradYearAD}} میلادی) موفقانه به پایه اکمال رسانیده و فارغ‌التحصیل گردیده است. ' +
      'این تصدیق‌نامه به اساس سوابق تحصیلی موصوف ترتیب و با تمام حقوق و امتیازات قانونی آن اعطا گردید.',
    female:
      'بدین‌وسیله تصدیق می‌گردد که محترمه {{firstName}} دختر {{fatherName}}، دارنده تذکره تابعیت شماره ({{nationalId}})، ' +
      'دوره تحصیلی مقطع {{degreeLevel}} را در دیپارتمنت {{department}} {{faculty}} پوهنتون کندز ' +
      'در سال {{gradYearSH}} هجری شمسی (مطابق {{gradYearAD}} میلادی) موفقانه به پایه اکمال رسانیده و فارغ‌التحصیل گردیده است. ' +
      'این تصدیق‌نامه به اساس سوابق تحصیلی موصوفه ترتیب و با تمام حقوق و امتیازات قانونی آن اعطا گردید.',
  }),
  // TODO: Have a native Pashto speaker review and finalize both male and female Pashto texts below.
  ps: Object.freeze({
    male:
      'په دې توګه تصدیق کېږي چې ښاغلي {{firstName}} د {{fatherName}} زوی، د ({{nationalId}}) شمېرې تذکرې لرونکي، ' +
      'د کندز پوهنتون د {{faculty}} اړوند د {{department}} په څانګه کې د {{degreeLevel}} تحصیلي دوره ' +
      'په {{gradYearSH}} لمریز کال (مطابق {{gradYearAD}} زېږدیز کال) کې په بریالیتوب سره بشپړه کړې ده. ' +
      'دغه تصدیق‌پاڼه د نوموړي د رسمي تحصیلي اسنادو پر بنسټ له ټولو قانوني حقونو او امتیازاتو سره نوموړي ته ورکړل شوه.',
    female:
      'په دې توګه تصدیق کېږي چې ځلانده {{firstName}} د {{fatherName}} لور، د ({{nationalId}}) شمېرې تذکرې لرونکې، ' +
      'د کندز پوهنتون د {{faculty}} اړوند د {{department}} په څانګه کې د {{degreeLevel}} تحصیلي دوره ' +
      'په {{gradYearSH}} لمریز کال (مطابق {{gradYearAD}} زېږدیز کال) کې په بریالیتوب سره بشپړه کړې ده. ' +
      'دغه تصدیق‌پاڼه د نوموړې د رسمي تحصیلي اسنادو پر بنسټ له ټولو قانوني حقونو او امتیازاتو سره نوموړې ته ورکړل شوه.',
  }),
  en: Object.freeze({
    male:
      'This is to certify that Mr. {{firstName}}, son of {{fatherName}}, holder of National ID ({{nationalId}}), ' +
      'has successfully completed his academic studies and fulfilled all requirements for the {{degreeLevel}} degree ' +
      'in the Department of {{department}}, {{faculty}}, Kunduz University, in the year {{gradYearAD}} ({{gradYearSH}} SH). ' +
      'This certificate is issued based on his official academic records and conferred upon him with all the rights, honors, and privileges appertaining thereto.',
    female:
      'This is to certify that Ms. {{firstName}}, daughter of {{fatherName}}, holder of National ID ({{nationalId}}), ' +
      'has successfully completed her academic studies and fulfilled all requirements for the {{degreeLevel}} degree ' +
      'in the Department of {{department}}, {{faculty}}, Kunduz University, in the year {{gradYearAD}} ({{gradYearSH}} SH). ' +
      'This certificate is issued based on her official academic records and conferred upon her with all the rights, honors, and privileges appertaining thereto.',
  }),
});

/**
 * Safely interpolate `{{token}}` placeholders in a template string.
 * @param {string} templateStr
 * @param {Record<string, string|number>} vars
 * @returns {string}
 */
function renderTemplateString(templateStr, vars = {}) {
  if (typeof templateStr !== 'string') return '';

  const replaced = templateStr.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== null && vars[key] !== undefined) {
      return String(vars[key]);
    }
    return '';
  });

  return replaced.replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Pick localized applicant/father name if provided, falling back to primary Dari field.
 */
function resolvePersonName(baseValue, i18nObj, lang) {
  const localized = i18nObj && typeof i18nObj[lang] === 'string' ? i18nObj[lang].trim() : '';
  return localized || (typeof baseValue === 'string' ? baseValue.trim() : '');
}

/**
 * Build default trilingual certificate text (`{ fa, ps, en }`) from template defaults
 * and request data, automatically applying masculine or feminine wording per language.
 *
 * @param {object} options
 * @param {object} [options.template] - Template document/object containing `textDefaults`
 * @param {object} options.request - Request document/object (may have populated facultyId/departmentId)
 * @param {object} [options.faculty] - Optional Faculty document/object (overrides request.facultyId)
 * @param {object} [options.department] - Optional Department document/object (overrides request.departmentId)
 * @returns {{ fa: string, ps: string, en: string }}
 */
function generateCertificateText({ template, request, faculty, department }) {
  if (!request || typeof request !== 'object') {
    throw new Error('Request data is required to generate certificate text.');
  }

  const genderKey = request.gender === 'female' ? 'female' : 'male';
  const resolvedFaculty =
    faculty || (request.facultyId && typeof request.facultyId === 'object' ? request.facultyId : null);
  const resolvedDept =
    department ||
    (request.departmentId && typeof request.departmentId === 'object' ? request.departmentId : null);

  const degreeKey = typeof request.degreeLevel === 'string' ? request.degreeLevel : 'bachelor';
  const degreeLabels = DEGREE_LABELS[degreeKey] || DEGREE_LABELS.bachelor;

  const textDefaults = template?.textDefaults || DEFAULT_TEXT_TEMPLATES;
  const output = { fa: '', ps: '', en: '' };

  for (const lang of ['fa', 'ps', 'en']) {
    const rawTemplate =
      (textDefaults?.[lang]?.[genderKey] && String(textDefaults[lang][genderKey]).trim()) ||
      DEFAULT_TEXT_TEMPLATES[lang][genderKey];

    const genderWords = GENDER_TERMS[lang][genderKey];
    const institution = INSTITUTION_LABELS[lang];

    const vars = {
      ...genderWords,
      ...institution,
      firstName: resolvePersonName(request.firstName, request.firstNameI18n, lang),
      fatherName: resolvePersonName(request.fatherName, request.fatherNameI18n, lang),
      nationalId: request.nationalId || '',
      faculty: resolvedFaculty?.name?.[lang] || '',
      department: resolvedDept?.name?.[lang] || '',
      degreeLevel: degreeLabels[lang] || degreeKey,
      gradYearSH: request.gradYearSH != null ? String(request.gradYearSH) : '',
      gradYearAD: request.gradYearAD != null ? String(request.gradYearAD) : '',
      serial: request.serial || '',
      officialNo: request.officialNo || '',
    };

    // Normalize accidental duplicate Pashto preposition `د د` when faculty name starts with `د `
    output[lang] =
      lang === 'ps'
        ? renderTemplateString(rawTemplate, vars).replace(/(^|\s)د\s+د\s+/g, '$1د ')
        : renderTemplateString(rawTemplate, vars);
  }

  return output;
}

module.exports = {
  GENDER_TERMS,
  DEGREE_LABELS,
  INSTITUTION_LABELS,
  DEFAULT_TEXT_TEMPLATES,
  renderTemplateString,
  generateCertificateText,
};
