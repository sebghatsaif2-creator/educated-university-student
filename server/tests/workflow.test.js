'use strict';

process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');
const { seed } = require('../src/seed/seed');
const {
  User,
  Faculty,
  Department,
  Template,
  Request,
  PrintLog,
  Asset,
  Counter,
} = require('../src/models');

// Derive an isolated test database URI from MONGODB_URI so dev/prod data is never touched
function buildTestDbUri(baseUri) {
  const url = new URL(baseUri);
  const dbName = (url.pathname.replace(/^\//, '') || 'kunduz_certificates') + '_test';
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function clearTestCollections() {
  await Promise.all([
    PrintLog.deleteMany({}),
    Request.deleteMany({}),
    Department.deleteMany({}),
    Faculty.deleteMany({}),
    Template.deleteMany({}),
    Asset.deleteMany({}),
    Counter.deleteMany({}),
    User.deleteMany({}),
  ]);
}

describe('Stage 2 API & Certificate Workflow', () => {
  let adminToken;
  let officerToken;
  let csFaculty;
  let seDept;
  let eduFaculty;
  let mathDept;
  let createdMaleReq;
  let createdFemaleReq;
  let approvedSerial;

  before(async () => {
    await connectDB(buildTestDbUri(env.mongodbUri));
    await seed({ reset: true, silent: true });

    // Authenticate admin & officer
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seed.adminUsername, password: env.seed.adminPassword });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.body.data.token;

    const officerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seed.officerUsername, password: env.seed.officerPassword });
    assert.equal(officerRes.status, 200);
    officerToken = officerRes.body.data.token;

    // Fetch public faculties & departments
    const facRes = await request(app).get('/api/faculties');
    assert.equal(facRes.status, 200);
    assert.equal(facRes.body.count, 6);

    csFaculty = facRes.body.data.faculties.find((f) => f.code === 'CS');
    eduFaculty = facRes.body.data.faculties.find((f) => f.code === 'EDU');

    const deptRes = await request(app)
      .get('/api/departments')
      .query({ faculty: csFaculty._id });
    assert.equal(deptRes.status, 200);
    assert.equal(deptRes.body.count, 3);
    seDept = deptRes.body.data.departments.find((d) => d.code === 'SE');

    const eduDeptRes = await request(app)
      .get('/api/departments')
      .query({ faculty: eduFaculty._id });
    assert.equal(eduDeptRes.status, 200);
    mathDept = eduDeptRes.body.data.departments.find((d) => d.code === 'MATH');
  });

  after(async () => {
    await clearTestCollections();
    await disconnectDB();
  });

  it('creates public certificate requests (returning unique trackingCode) and validates with Dari errors', async () => {
    // Validation failure returns 400 + Dari message
    const invalidRes = await request(app)
      .post('/api/requests')
      .send({ firstName: 'ا' });
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.code, 'VALIDATION_ERROR');
    assert.match(invalidRes.body.message, /[\u0600-\u06FF]/);
    assert.ok(Array.isArray(invalidRes.body.details) && invalidRes.body.details.length > 0);

    // Mismatched faculty/department is rejected in Dari
    const mismatchRes = await request(app)
      .post('/api/requests')
      .send({
        firstName: 'سمیر',
        fatherName: 'عبدالله',
        gender: 'male',
        nationalId: '1402-0101-55555',
        phone: '0701112233',
        facultyId: csFaculty._id,
        departmentId: mathDept._id,
        gradYearSH: 1404,
        gradYearAD: 2025,
        degreeLevel: 'bachelor',
      });
    assert.equal(mismatchRes.status, 400);
    assert.equal(mismatchRes.body.code, 'DEPARTMENT_FACULTY_MISMATCH');

    // Valid male applicant request (also tests Dari numeral normalization)
    const maleRes = await request(app)
      .post('/api/requests')
      .send({
        firstName: 'زبیر احمد',
        fatherName: 'محمد حنیف',
        firstNameI18n: { en: 'Zubair Ahmad' },
        fatherNameI18n: { en: 'Mohammad Hanif' },
        gender: 'male',
        nationalId: '1402-0303-99001',
        phone: '۰۷۰۱۲۳۴۵۶۷',
        email: 'zubair@example.af',
        facultyId: csFaculty._id,
        departmentId: seDept._id,
        gradYearSH: '۱۴۰۴',
        gradYearAD: 2025,
        degreeLevel: 'bachelor',
        notes: 'درخواست فوری تصدیق‌نامه فراغت.',
      });

    assert.equal(maleRes.status, 201);
    assert.match(maleRes.body.data.trackingCode, /^KU-\d{4}-[A-Z0-9]{6}$/);
    assert.equal(maleRes.body.data.request.status, 'pending');
    assert.equal(maleRes.body.data.request.gradYearSH, 1404);
    assert.equal(maleRes.body.data.request.phone, '0701234567');
    createdMaleReq = maleRes.body.data.request;

    // Valid female applicant request
    const femaleRes = await request(app)
      .post('/api/requests')
      .send({
        firstName: 'نرگس',
        fatherName: 'سید احمد',
        firstNameI18n: { en: 'Nargis' },
        fatherNameI18n: { en: 'Sayed Ahmad' },
        gender: 'female',
        nationalId: '1402-0404-99002',
        phone: '0789876543',
        facultyId: eduFaculty._id,
        departmentId: mathDept._id,
        gradYearSH: 1404,
        degreeLevel: 'bachelor',
      });

    assert.equal(femaleRes.status, 201);
    assert.notEqual(femaleRes.body.data.trackingCode, createdMaleReq.trackingCode);
    assert.equal(femaleRes.body.data.request.gradYearAD, 2025);
    createdFemaleReq = femaleRes.body.data.request;

    // Public tracking works in lowercase too
    const trackRes = await request(app).get(
      `/api/requests/track/${createdMaleReq.trackingCode.toLowerCase()}`
    );
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.data.request.status, 'pending');
    assert.equal(trackRes.body.data.request.serial, null);
  });

  it('approves requests with sequential unique serial (KU-YYYY-000123), officialNo, and gendered finalText', async () => {
    const approveMale = await request(app)
      .patch(`/api/requests/${createdMaleReq._id}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});

    assert.equal(approveMale.status, 200);
    const maleApproved = approveMale.body.data.request;
    assert.equal(maleApproved.status, 'approved');
    assert.match(maleApproved.serial, /^KU-\d{4}-\d{6}$/);
    assert.ok(maleApproved.officialNo.includes('/CS/'));
    assert.ok(maleApproved.templateId && maleApproved.templateId.key === 'official');
    assert.equal(maleApproved.approvedBy.username, env.seed.officerUsername);
    assert.match(maleApproved.finalText.fa, /محترم زبیر احمد فرزند محمد حنیف/);
    assert.match(maleApproved.finalText.en, /Mr\. Zubair Ahmad, son of Mohammad Hanif/);
    assert.match(maleApproved.finalText.ps, /ښاغلي زبیر احمد د محمد حنیف زوی/);
    approvedSerial = maleApproved.serial;

    // Approve female request -> gets a distinct higher serial + feminine text
    const approveFemale = await request(app)
      .patch(`/api/requests/${createdFemaleReq._id}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});

    assert.equal(approveFemale.status, 200);
    const femaleApproved = approveFemale.body.data.request;
    assert.match(femaleApproved.serial, /^KU-\d{4}-\d{6}$/);
    assert.notEqual(femaleApproved.serial, maleApproved.serial);
    assert.match(femaleApproved.finalText.fa, /محترمه نرگس دختر سید احمد/);
    assert.match(femaleApproved.finalText.en, /Ms\. Nargis, daughter of Sayed Ahmad/);
    assert.match(femaleApproved.finalText.ps, /ځلانده نرگس د سید احمد لور/);

    // Duplicate approval is blocked with 409
    const dupApprove = await request(app)
      .patch(`/api/requests/${createdMaleReq._id}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    assert.equal(dupApprove.status, 409);
  });

  it('supports officer filtering, rejecting with reason, per-language finalText edits, template change, printLogs, and QR verify', async () => {
    // Filter by status + faculty + search by nationalId + date
    const today = new Date().toISOString().slice(0, 10);
    const listRes = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${officerToken}`)
      .query({
        status: 'approved',
        faculty: csFaculty._id,
        date: today,
        search: '99001',
      });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.count, 1);
    assert.equal(listRes.body.data.requests[0]._id, createdMaleReq._id);

    // Update finalText for English only; Dari & Pashto stay intact
    const customEn = 'Custom English certificate text verified by officer.';
    const textRes = await request(app)
      .patch(`/api/requests/${createdMaleReq._id}/final-text`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ en: customEn });
    assert.equal(textRes.status, 200);
    assert.equal(textRes.body.data.request.finalText.en, customEn);
    assert.ok(textRes.body.data.request.finalText.fa.includes('زبیر احمد'));
    assert.ok(textRes.body.data.request.finalText.ps.includes('زبیر احمد'));

    // Switch template to `cream` while preserving custom text
    const tplRes = await request(app)
      .get('/api/templates/cream')
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(tplRes.status, 200);
    const creamTemplate = tplRes.body.data.template;

    const setTplRes = await request(app)
      .patch(`/api/requests/${createdMaleReq._id}/template`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ templateId: creamTemplate._id });
    assert.equal(setTplRes.status, 200);
    assert.equal(setTplRes.body.data.request.templateId.key, 'cream');
    assert.equal(setTplRes.body.data.request.finalText.en, customEn);

    // First print -> status becomes printed, logged with isReprint: false
    const print1 = await request(app)
      .post(`/api/requests/${createdMaleReq._id}/print`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    assert.equal(print1.status, 200);
    assert.equal(print1.body.data.isReprint, false);
    assert.equal(print1.body.data.request.status, 'printed');
    assert.ok(print1.body.data.request.printedAt);
    assert.equal(print1.body.data.printLog.templateKey, 'cream');

    // Second print -> logged in printLogs with isReprint: true + reason
    const print2 = await request(app)
      .post(`/api/requests/${createdMaleReq._id}/print`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ reprintReason: 'خرابی کاغذ در چاپگر' });
    assert.equal(print2.status, 200);
    assert.equal(print2.body.data.isReprint, true);
    assert.equal(print2.body.data.printLog.reprintReason, 'خرابی کاغذ در چاپگر');

    // GET single request shows both printLogs
    const detailRes = await request(app)
      .get(`/api/requests/${createdMaleReq._id}`)
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.printLogs.length, 2);

    // Reject flow on a seeded pending request (requires reason)
    const pendingList = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${officerToken}`)
      .query({ status: 'pending' });
    const pendingReq = pendingList.body.data.requests[0];

    // Printing a pending (unapproved) request is blocked and creates no PrintLog
    const unapprovedPrint = await request(app)
      .post(`/api/requests/${pendingReq._id}/print`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    assert.equal(unapprovedPrint.status, 409);

    const noReasonRes = await request(app)
      .patch(`/api/requests/${pendingReq._id}/reject`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    assert.equal(noReasonRes.status, 400);

    const rejectRes = await request(app)
      .patch(`/api/requests/${pendingReq._id}/reject`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ reason: 'مشخصات تذکره ناقص است.' });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.data.request.status, 'rejected');
    assert.equal(rejectRes.body.data.request.rejectReason, 'مشخصات تذکره ناقص است.');

    // Public QR verification returns minimal fields & hides sensitive fields
    const verifyRes = await request(app).get(`/api/verify/${approvedSerial}`);
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.verified, true);
    assert.equal(verifyRes.body.data.name, 'زبیر احمد');
    assert.equal(verifyRes.body.data.faculty.en, 'Faculty of Computer Science');
    assert.equal(verifyRes.body.data.year.sh, 1404);
    assert.equal(verifyRes.body.data.status, 'printed');
    assert.equal(verifyRes.body.data.nationalId, undefined);
    assert.equal(verifyRes.body.data.phone, undefined);
    assert.equal(verifyRes.body.data.email, undefined);
    assert.equal(verifyRes.body.data.trackingCode, undefined);

    const badVerify = await request(app).get('/api/verify/KU-2026-999999');
    assert.equal(badVerify.status, 404);
    assert.equal(badVerify.body.verified, false);
  });

  it('enforces admin RBAC and supports CRUD for users, faculties, departments, templates, and stats report', async () => {
    // Officer is denied admin endpoints
    const forbidden = await request(app)
      .get('/api/stats/report')
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(forbidden.status, 403);

    // User CRUD
    const newUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'کارمند آزمایشی',
        username: 'officer_two',
        password: 'Officer2@12345',
        role: 'officer',
      });
    assert.equal(newUser.status, 201);
    const uid = newUser.body.data.user._id;

    const updUser = await request(app)
      .patch(`/api/users/${uid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'کارمند ارشد محصلان', isActive: false });
    assert.equal(updUser.status, 200);
    assert.equal(updUser.body.data.user.isActive, false);

    const delUser = await request(app)
      .delete(`/api/users/${uid}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(delUser.status, 200);

    // Faculty & Department CRUD
    const newFac = await request(app)
      .post('/api/faculties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'VET',
        name: {
          fa: 'پوهنځی وترنری',
          ps: 'د وترنرۍ پوهنځی',
          en: 'Faculty of Veterinary Science',
        },
      });
    assert.equal(newFac.status, 201);
    const facId = newFac.body.data.faculty._id;

    const newDept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        facultyId: facId,
        code: 'CLIN',
        name: {
          fa: 'علوم کلینیکی',
          ps: 'کلینیکي علوم',
          en: 'Clinical Sciences',
        },
      });
    assert.equal(newDept.status, 201);
    const deptId = newDept.body.data.department._id;

    // Cannot delete faculty while it has a department
    const blockedDel = await request(app)
      .delete(`/api/faculties/${facId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(blockedDel.status, 409);

    // Delete department then faculty
    assert.equal(
      (await request(app).delete(`/api/departments/${deptId}`).set('Authorization', `Bearer ${adminToken}`)).status,
      200
    );
    assert.equal(
      (await request(app).delete(`/api/faculties/${facId}`).set('Authorization', `Bearer ${adminToken}`)).status,
      200
    );

    // Template toggle & default text editing
    const toggleOff = await request(app)
      .patch('/api/templates/blue-stripes/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    assert.equal(toggleOff.status, 200);
    assert.equal(toggleOff.body.data.template.isActive, false);

    // Officer sees 7 active templates; Admin with ?all=true sees all 8
    const officerTpls = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(officerTpls.body.count, 7);

    const adminAllTpls = await request(app)
      .get('/api/templates?all=true')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminAllTpls.body.count, 8);

    // Assigning a deactivated template is rejected with Dari error
    const inactiveTplRes = await request(app)
      .patch(`/api/requests/${createdFemaleReq._id}/template`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ templateId: toggleOff.body.data.template._id });
    assert.equal(inactiveTplRes.status, 400);
    assert.equal(inactiveTplRes.body.code, 'TEMPLATE_INACTIVE_OR_NOT_FOUND');

    const editTpl = await request(app)
      .patch('/api/templates/modern')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'قالب مدرن ویرایش‌شده توسط مدیر',
        textDefaults: {
          en: {
            male: 'Certified that Mr. {{firstName}}, son of {{fatherName}}, completed his {{degreeLevel}} in {{department}} ({{gradYearAD}}).',
          },
        },
      });
    assert.equal(editTpl.status, 200);
    assert.ok(editTpl.body.data.template.textDefaults.en.male.startsWith('Certified that Mr.'));

    // Switching request to edited `modern` template with regenerateText: true applies the new default
    const applyModern = await request(app)
      .patch(`/api/requests/${createdMaleReq._id}/template`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ templateId: editTpl.body.data.template._id, regenerateText: true });
    assert.equal(applyModern.status, 200);
    assert.equal(
      applyModern.body.data.request.finalText.en,
      'Certified that Mr. Zubair Ahmad, son of Mohammad Hanif, completed his Bachelor in Software Engineering (2025).'
    );

    // Admin stats report
    const reportRes = await request(app)
      .get('/api/stats/report')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.body.data.requests.byStatus.total, 8);
    assert.equal(reportRes.body.data.prints.total, 3); // 1 seeded + 2 in test
    assert.equal(reportRes.body.data.prints.reprints, 1);
    assert.equal(reportRes.body.data.system.activeTemplates, 7);
    assert.equal(reportRes.body.data.system.totalTemplates, 8);
  });
});
