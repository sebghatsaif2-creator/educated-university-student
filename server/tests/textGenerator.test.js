'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateCertificateText,
  DEFAULT_TEXT_TEMPLATES,
} = require('../src/services/textGenerator');

const sampleFaculty = {
  code: 'CS',
  name: {
    fa: 'پوهنځی کمپیوتر ساینس',
    ps: 'د کمپیوټر ساینس پوهنځی',
    en: 'Faculty of Computer Science',
  },
};

const sampleDepartment = {
  code: 'SE',
  name: {
    fa: 'انجنیری نرم‌افزار',
    ps: 'سافټویر انجینري',
    en: 'Software Engineering',
  },
};

const sampleTemplate = {
  key: 'official',
  name: 'رسمی وزارت تحصیلات عالی',
  isActive: true,
  textDefaults: DEFAULT_TEXT_TEMPLATES,
};

describe('Text Generation Service (trilingual & gender-aware)', () => {
  it('generates masculine wording in Dari, Pashto, and English for male applicants', () => {
    const text = generateCertificateText({
      template: sampleTemplate,
      faculty: sampleFaculty,
      department: sampleDepartment,
      request: {
        firstName: 'احمد فواد',
        fatherName: 'غلام فاروق',
        firstNameI18n: { fa: 'احمد فواد', ps: 'احمد فواد', en: 'Ahmad Fawad' },
        fatherNameI18n: { fa: 'غلام فاروق', ps: 'غلام فاروق', en: 'Ghulam Farooq' },
        gender: 'male',
        nationalId: '1400-0101-12345',
        gradYearSH: 1403,
        gradYearAD: 2024,
        degreeLevel: 'bachelor',
      },
    });

    // Dari masculine: محترم + فرزند (not محترمه / دختر)
    assert.match(text.fa, /محترم احمد فواد فرزند غلام فاروق/);
    assert.ok(!text.fa.includes('محترمه'));
    assert.ok(!text.fa.includes('دختر'));
    assert.ok(text.fa.includes('پوهنځی کمپیوتر ساینس'));
    assert.ok(text.fa.includes('انجنیری نرم‌افزار'));
    assert.ok(text.fa.includes('لیسانس'));
    assert.ok(text.fa.includes('1403'));
    assert.ok(text.fa.includes('2024'));

    // English masculine: Mr. + son + his (not Ms. / daughter / her)
    assert.match(text.en, /Mr\. Ahmad Fawad, son of Ghulam Farooq/);
    assert.match(text.en, /\bhis\b/);
    assert.ok(!/\bMs\./.test(text.en));
    assert.ok(!/\bdaughter\b/.test(text.en));
    assert.ok(!/\bher\b/.test(text.en));
    assert.ok(text.en.includes('Faculty of Computer Science'));
    assert.ok(text.en.includes('Software Engineering'));
    assert.ok(text.en.includes('Bachelor'));

    // Pashto masculine: ښاغلي + زوی (not ځلانده / لور)
    assert.match(text.ps, /ښاغلي احمد فواد د غلام فاروق زوی/);
    assert.ok(!text.ps.includes('ځلانده'));
    assert.ok(!text.ps.includes('لور'));
    assert.ok(text.ps.includes('د کمپیوټر ساینس پوهنځی'));
    assert.ok(text.ps.includes('سافټویر انجینري'));
  });

  it('generates feminine wording in Dari, Pashto, and English for female applicants', () => {
    const text = generateCertificateText({
      template: sampleTemplate,
      faculty: sampleFaculty,
      department: sampleDepartment,
      request: {
        firstName: 'مریم',
        fatherName: 'عبدالرشید',
        firstNameI18n: { fa: 'مریم', ps: 'مریم', en: 'Maryam' },
        fatherNameI18n: { fa: 'عبدالرشید', ps: 'عبدالرشید', en: 'Abdul Rashid' },
        gender: 'female',
        nationalId: '1401-0402-98765',
        gradYearSH: 1404,
        gradYearAD: 2025,
        degreeLevel: 'master',
      },
    });

    // Dari feminine: محترمه + دختر (not فرزند)
    assert.match(text.fa, /محترمه مریم دختر عبدالرشید/);
    assert.ok(!text.fa.includes('فرزند'));
    assert.ok(text.fa.includes('ماستری'));

    // English feminine: Ms. + daughter + her (not Mr. / son / his)
    assert.match(text.en, /Ms\. Maryam, daughter of Abdul Rashid/);
    assert.match(text.en, /\bher\b/);
    assert.ok(!/\bMr\./.test(text.en));
    assert.ok(!/\bson\b/.test(text.en));
    assert.ok(!/\bhis\b/.test(text.en));
    assert.ok(text.en.includes('Master'));

    // Pashto feminine: ځلانده + لور (not ښاغلي / زوی)
    assert.match(text.ps, /ځلانده مریم د عبدالرشید لور/);
    assert.ok(!text.ps.includes('ښاغلي'));
    assert.ok(!text.ps.includes('زوی'));
    assert.ok(text.ps.includes('ماسټري'));
  });

  it('falls back to base firstName/fatherName and supports custom template text & serial tokens', () => {
    const customTemplate = {
      textDefaults: {
        fa: {
          male: '{{title}} {{firstName}} {{relation}} {{fatherName}} — سریال: {{serial}}',
          female: '{{title}} {{firstName}} {{relation}} {{fatherName}} — سریال: {{serial}}',
        },
        ps: {
          male: '{{title}} {{firstName}} د {{fatherName}} {{relation}} — {{serial}}',
          female: '{{title}} {{firstName}} د {{fatherName}} {{relation}} — {{serial}}',
        },
        en: {
          male: '{{title}} {{firstName}}, {{relation}} of {{fatherName}} ({{possessive}} serial: {{serial}})',
          female: '{{title}} {{firstName}}, {{relation}} of {{fatherName}} ({{possessive}} serial: {{serial}})',
        },
      },
    };

    const text = generateCertificateText({
      template: customTemplate,
      faculty: sampleFaculty,
      department: sampleDepartment,
      request: {
        firstName: 'فرشته',
        fatherName: 'محمد اسماعیل',
        gender: 'female',
        nationalId: '1400-99',
        gradYearSH: 1404,
        gradYearAD: 2025,
        degreeLevel: 'bachelor',
        serial: 'KU-2026-000123',
      },
    });

    assert.equal(text.fa, 'محترمه فرشته دختر محمد اسماعیل — سریال: KU-2026-000123');
    assert.equal(text.ps, 'ځلانده فرشته د محمد اسماعیل لور — KU-2026-000123');
    assert.equal(text.en, 'Ms. فرشته, daughter of محمد اسماعیل (her serial: KU-2026-000123)');
  });
});
