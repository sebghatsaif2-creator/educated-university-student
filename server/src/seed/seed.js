'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const {
  User,
  Faculty,
  Department,
  Template,
  Request,
  PrintLog,
  Asset,
  Counter,
} = require('../models');
const { generateCertificateText } = require('../services/textGenerator');
const { ensureCounterAtLeast } = require('../services/serialGenerator');
const {
  FACULTIES_DATA,
  TEMPLATES_DATA,
  ASSETS_DATA,
  REQUESTS_DATA,
} = require('./seedData');

async function upsertUser({ username, password, name, role }) {
  const passwordHash = await User.hashPassword(password);
  const existing = await User.findOne({ username });

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    await existing.save();
    return { user: existing, created: false };
  }

  const user = await User.create({
    username,
    passwordHash,
    name,
    role,
    isActive: true,
  });
  return { user, created: true };
}

async function seed({ reset = false, silent = false } = {}) {
  const log = silent ? () => {} : console.log;

  log('==============================================================');
  log('  Kunduz University Certificate System — Database Seeder');
  log('==============================================================');

  if (reset) {
    log('[seed] --reset flag detected: clearing existing collections...');
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

  // Ensure indexes exist across all models
  await Promise.all([
    User.createIndexes(),
    Faculty.createIndexes(),
    Department.createIndexes(),
    Template.createIndexes(),
    Request.createIndexes(),
    PrintLog.createIndexes(),
    Asset.createIndexes(),
    Counter.createIndexes(),
  ]);

  // 1. Seed default Admin & sample Officer users
  const { user: adminUser } = await upsertUser({
    username: env.seed.adminUsername,
    password: env.seed.adminPassword,
    name: env.seed.adminName,
    role: 'admin',
  });

  const { user: officerUser } = await upsertUser({
    username: env.seed.officerUsername,
    password: env.seed.officerPassword,
    name: env.seed.officerName,
    role: 'officer',
  });
  log(`[seed] Users ready: admin="${adminUser.username}", officer="${officerUser.username}"`);

  // 2. Seed Faculties and Departments (trilingual: fa, ps, en)
  const facultyMap = new Map();
  const deptMap = new Map();
  let totalDepartments = 0;

  for (const facData of FACULTIES_DATA) {
    let faculty = await Faculty.findOne({ code: facData.code });
    if (!faculty) {
      faculty = await Faculty.create({
        code: facData.code,
        name: facData.name,
        isActive: true,
      });
    } else {
      faculty.name = facData.name;
      faculty.isActive = true;
      await faculty.save();
    }
    facultyMap.set(facData.code, faculty);

    for (const deptData of facData.departments) {
      let dept = await Department.findOne({
        facultyId: faculty._id,
        'name.en': deptData.name.en,
      });
      if (!dept) {
        dept = await Department.create({
          facultyId: faculty._id,
          code: deptData.code,
          name: deptData.name,
          isActive: true,
        });
      } else {
        dept.code = deptData.code;
        dept.name = deptData.name;
        dept.isActive = true;
        await dept.save();
      }
      deptMap.set(`${facData.code}:${deptData.code}`, dept);
      totalDepartments += 1;
    }
  }
  log(`[seed] Academic catalog ready: ${facultyMap.size} faculties, ${totalDepartments} departments`);

  // 3. Seed the 8 certificate theme templates
  const templateMap = new Map();
  for (const tplData of TEMPLATES_DATA) {
    let tpl = await Template.findOne({ key: tplData.key });
    if (!tpl) {
      tpl = await Template.create(tplData);
    } else {
      tpl.name = tplData.name;
      tpl.labels = tplData.labels;
      tpl.description = tplData.description;
      tpl.isActive = tplData.isActive;
      tpl.isDefault = tplData.isDefault;
      tpl.textDefaults = tplData.textDefaults;
      await tpl.save();
    }
    templateMap.set(tpl.key, tpl);
  }
  log(`[seed] Templates ready (${templateMap.size}): ${Array.from(templateMap.keys()).join(', ')}`);

  // 4. Seed default local offline logo/watermark Assets
  let assetsCount = 0;
  for (const assetData of ASSETS_DATA) {
    const relativeToPublic = assetData.filePath.replace(/^\/public\/?/, '');
    const diskPath = path.join(env.publicDir, relativeToPublic);
    const fileSize = fs.existsSync(diskPath) ? fs.statSync(diskPath).size : 0;

    let asset = await Asset.findOne({ key: assetData.key });
    if (!asset) {
      await Asset.create({
        ...assetData,
        fileSize,
        uploadedBy: adminUser._id,
      });
    } else {
      asset.name = assetData.name;
      asset.type = assetData.type;
      asset.filePath = assetData.filePath;
      asset.mimeType = assetData.mimeType;
      asset.fileSize = fileSize;
      asset.isActive = assetData.isActive;
      await asset.save();
    }
    assetsCount += 1;
  }
  log(`[seed] Offline assets ready: ${assetsCount} logo/watermark records`);

  // 5. Seed fictional test Requests, sample PrintLog, & sync serial counters
  let seededRequests = 0;
  const maxSerialByYear = new Map();

  for (const reqItem of REQUESTS_DATA) {
    const faculty = facultyMap.get(reqItem.facultyCode);
    const dept = deptMap.get(`${reqItem.facultyCode}:${reqItem.departmentCode}`);
    const template = reqItem.templateKey ? templateMap.get(reqItem.templateKey) : null;

    const isApprovedOrPrinted = reqItem.status === 'approved' || reqItem.status === 'printed';
    const finalText =
      isApprovedOrPrinted && template
        ? generateCertificateText({
            template,
            request: reqItem,
            faculty,
            department: dept,
          })
        : { fa: '', ps: '', en: '' };

    const docPayload = {
      firstName: reqItem.firstName,
      fatherName: reqItem.fatherName,
      firstNameI18n: reqItem.firstNameI18n,
      fatherNameI18n: reqItem.fatherNameI18n,
      gender: reqItem.gender,
      nationalId: reqItem.nationalId,
      phone: reqItem.phone,
      email: reqItem.email || '',
      facultyId: faculty._id,
      departmentId: dept._id,
      gradYearSH: reqItem.gradYearSH,
      gradYearAD: reqItem.gradYearAD,
      degreeLevel: reqItem.degreeLevel,
      notes: reqItem.notes || '',
      trackingCode: reqItem.trackingCode,
      status: reqItem.status,
      rejectReason: reqItem.rejectReason || '',
      officialNo: reqItem.officialNo || '',
      templateId: template ? template._id : null,
      finalText,
      approvedBy: isApprovedOrPrinted ? adminUser._id : null,
      approvedAt: isApprovedOrPrinted ? new Date() : null,
      printedAt: reqItem.status === 'printed' ? new Date() : null,
    };

    if (reqItem.serial) {
      docPayload.serial = reqItem.serial;
      const serialMatch = /^KU-(\d{4})-(\d+)$/.exec(reqItem.serial);
      if (serialMatch) {
        const year = serialMatch[1];
        const seq = Number.parseInt(serialMatch[2], 10);
        maxSerialByYear.set(year, Math.max(maxSerialByYear.get(year) || 0, seq));
      }
    }

    let requestDoc = await Request.findOne({ trackingCode: reqItem.trackingCode });
    if (!requestDoc) {
      requestDoc = await Request.create(docPayload);
    } else {
      Object.assign(requestDoc, docPayload);
      await requestDoc.save();
    }

    if (reqItem.status === 'printed' && template) {
      const existingLog = await PrintLog.findOne({ requestId: requestDoc._id });
      if (!existingLog) {
        await PrintLog.create({
          requestId: requestDoc._id,
          templateId: template._id,
          templateKey: template.key,
          printedBy: officerUser._id,
          serial: requestDoc.serial || '',
          officialNo: requestDoc.officialNo || '',
          isReprint: false,
          ipAddress: '127.0.0.1',
          printedAt: requestDoc.printedAt || new Date(),
        });
      } else {
        existingLog.serial = requestDoc.serial || '';
        existingLog.officialNo = requestDoc.officialNo || '';
        existingLog.templateId = template._id;
        existingLog.templateKey = template.key;
        await existingLog.save();
      }
    }

    seededRequests += 1;
  }

  for (const [year, maxSeq] of maxSerialByYear.entries()) {
    await ensureCounterAtLeast(`serial:${year}`, maxSeq);
  }

  log(`[seed] Fictional test requests ready: ${seededRequests} records`);
  log('--------------------------------------------------------------');
  log('  Seed completed successfully!');
  log(`  Admin login   -> username: ${env.seed.adminUsername} | password: ${env.seed.adminPassword}`);
  log(`  Officer login -> username: ${env.seed.officerUsername} | password: ${env.seed.officerPassword}`);
  log('==============================================================');
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  connectDB()
    .then(() => seed({ reset }))
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[seed] Failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = { seed };
