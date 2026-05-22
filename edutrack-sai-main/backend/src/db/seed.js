/**
 * Database Seeder — Run with: npm run seed
 *
 * Initializes the database and inserts 6 staff + 42 students.
 * All students are assigned to ALL staff (shared student pool).
 *
 * Use --fresh flag to wipe existing data: npm run seed:fresh
 */

const path    = require('path');
const bcrypt  = require('bcryptjs');

const isFresh = process.argv.includes('--fresh');

// ─── Async main ───────────────────────────────────────────────────────────────
(async () => {
  const { db, initDatabase } = require('./database');
  await initDatabase();

  console.log('\n🌱 Starting database seed...\n');

  if (isFresh) {
    await db.exec('DELETE FROM attendance');
    await db.exec('DELETE FROM students');
    await db.exec('DELETE FROM teachers');
    console.log('🗑️  Cleared existing data.\n');
  }

  // ─── Staff (Teachers) ─────────────────────────────────────────────────────
  const TEACHERS = [
    { name: 'Tamil',     email: 'tamil@dream.com',     password: 'teacher123', role: 'teacher' },
    { name: 'Abiram',    email: 'abiram@dream.com',    password: 'teacher123', role: 'teacher' },
    { name: 'Harris',    email: 'harris@dream.com',    password: 'teacher123', role: 'teacher' },
    { name: 'Sandeep',   email: 'sandeep@dream.com',   password: 'teacher123', role: 'teacher' },
    { name: 'Srikanth',  email: 'srikanth@dream.com',  password: 'teacher123', role: 'admin'   },
    { name: 'Dharshini', email: 'dharshini@dream.com', password: 'teacher123', role: 'teacher' },
  ];

  const teacherIds = [];

  for (const { name, email, password, role } of TEACHERS) {
    const existing = await db.prepare('SELECT id FROM teachers WHERE email = ?').get(email);
    if (existing) {
      // Update role for existing teachers (in case it changed)
      await db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run(role, existing.id);
      teacherIds.push(existing.id);
      console.log(`⏭️  Staff already exists: ${name} (${email}) — role: ${role}`);
      continue;
    }

    const hash   = bcrypt.hashSync(password, 10);
    const result = await db.prepare(
      'INSERT INTO teachers (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hash, role);

    teacherIds.push(result.lastInsertRowid);
    console.log(`👩‍🏫 Staff created: ${name} (${email}) | Role: ${role} | ID: ${result.lastInsertRowid}`);
  }

  // Use first teacher id as default owner (all staff see all students anyway)
  const defaultTeacherId = teacherIds[0];

  // ─── Students ──────────────────────────────────────────────────────────────
  const STUDENTS = [
    // Class 6
    { name: 'Athiyan',                  grade: '6 ICSE',  phone: '919940717874' },

    // Class 7
    { name: 'N Sri Kavin',              grade: '7 CBSE',  phone: '919901399699' },

    // Class 8
    { name: 'R Hariharan',              grade: '8 TN',    phone: '919677708019' },
    { name: 'S Jai Vishak',             grade: '8 CBSE',  phone: '919943388115' },

    // Class 9
    { name: 'Akshita',                  grade: '9 ICSCE', phone: '919944303015' },

    // Class 10
    { name: 'P S Lekha Sree',           grade: '10 TN',    phone: '919003693696' },
    { name: 'KS Kiruthuk Varbhan',      grade: '10 IGCSE', phone: '919698407000' },
    { name: 'SM Vaseegaran',            grade: '10 IGCSE', phone: '919952596292' },
    { name: 'Harshith',                 grade: '10 IGCSE', phone: '917538890749' },
    { name: 'P.Mukundan',               grade: '10 ICSE',  phone: '919159399702' },
    { name: 'G.S Ashvath',              grade: '10 CBSE',  phone: '919894746670' },
    { name: 'S. Albert Richard Singh',  grade: '10 CBSE',  phone: '919600854007' },
    { name: 'S Anirudh',                grade: '10 CBSE',  phone: '919840627077' },
    { name: 'M Thirukkumaran',          grade: '10 CBSE',  phone: '919566700144' },
    { name: 'S S Thanushree',           grade: '10 CBSE',  phone: '918807043001' },
    { name: 'R K Nithin Dharma',        grade: '10 CBSE',  phone: '919944962231' },
    { name: 'S K Kanishk',              grade: '10 CBSE',  phone: '919994394432' },
    { name: 'M S Aradhana',             grade: '10 CBSE',  phone: '919940076612' },
    { name: 'Sudhan Raj',               grade: '10 CBSE',  phone: '919751262437' },
    { name: 'T Manisha',                grade: '10 CBSE',  phone: '918825993325' },
    { name: 'Subikshana',               grade: '10 CBSE',  phone: '918838086856' },

    // Class 12
    { name: 'V Anshika Kajal',          grade: '12 TN',   phone: '919894707388' },
    { name: 'P.Saravanan',              grade: '12 ISC',  phone: '919159399702' },
    { name: 'P Aswin',                  grade: '12 ISC',  phone: '919894461392' },
    { name: 'V Ilakya',                 grade: '12 ISC',  phone: '919442892384' },
    { name: 'Kavin',                    grade: '12 IB',   phone: '917538890749' },
    { name: 'S Kamesh',                 grade: '12 CBSE', phone: '917868999066' },
    { name: 'N Pranav Sriram',          grade: '12 CBSE', phone: '919944157697' },
    { name: 'D Nithessh',               grade: '12 CBSE', phone: '919361729505' },
    { name: 'CS Sooriya Balaji',        grade: '12 CBSE', phone: '919791768670' },
    { name: 'K Sai Nivesh',             grade: '12 CBSE', phone: '919698681000' },
    { name: 'M Karthikeyan',            grade: '12 CBSE', phone: '919150512256' },
    { name: 'J Karan Kaushik',          grade: '12 CBSE', phone: '918608515959' },
    { name: 'S Yaathra',                grade: '12 CBSE', phone: '918438123000' },
    { name: 'M Nandita Shree',          grade: '12 CBSE', phone: '919688584486' },
    { name: 'R Jayasree',               grade: '12 CBSE', phone: '919842246440' },
    { name: 'P Rohith',                 grade: '12 CBSE', phone: '919585323590' },
    { name: 'F Jeff Calvin',            grade: '12 CBSE', phone: '919994343045' },
    { name: 'T Uma Agatheeswari',       grade: '12 CBSE', phone: '919843023025' },
    { name: 'P Ariyan',                 grade: '12 CBSE', phone: '918248404019' },
  ];

  console.log('');

  for (const { name, grade, phone } of STUDENTS) {
    const existing = await db.prepare('SELECT id FROM students WHERE name = ? AND grade = ?').get(name, grade);
    if (existing) {
      console.log(`⏭️  Student already exists: ${name} (${grade})`);
      continue;
    }

    await db.prepare(
      'INSERT INTO students (name, grade, parent_whatsapp, teacher_id) VALUES (?, ?, ?, ?)'
    ).run(name, grade, phone, defaultTeacherId);

    console.log(`👦 Student created: ${name} (${grade}) | Phone: ${phone}`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seeding complete!\n');
  console.log('📋 LOGIN CREDENTIALS:\n');
  console.log('  Email                    Password');
  console.log('  ─────────────────────────────────────────────');
  TEACHERS.forEach(({ email, password }) => {
    console.log(`  ${email.padEnd(25)} ${password}`);
  });
  console.log('\n📁 Database file: backend/data/attendance.db');
  console.log('📝 All staff can see ALL students (shared pool)');
  console.log('🔍 Students can be filtered by class in the dashboard\n');

  setTimeout(() => process.exit(0), 300);
})().catch((err) => {
  console.error('❌ Seed failed:', err);
  setTimeout(() => process.exit(1), 300);
});
