require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const teachers = await prisma.teacher.findMany({ include: { user: true } });
    const parents = await prisma.parent.findMany({ include: { user: true } });
    const students = await prisma.student.findMany({ include: { user: true } });
    const admins = await prisma.user.findMany({ where: { role: { roleType: 'ADMIN' } } });

    console.log("=== WORKING CREDENTIALS ===");
    console.log("\\n[Admins] (Password might be AdminPass123 or whatever was set in phase3)");
    admins.forEach(a => console.log(`Email: ${a.email}`));

    console.log("\\n[Teachers] (Password: Teacher@123 or similar)");
    if (teachers.length === 0) console.log("No teachers found!");
    teachers.forEach(t => console.log(`Name: ${t.fullName}, Email: ${t.email || t.user?.email}`));

    console.log("\\n[Parents] (OTP Login)");
    if (parents.length === 0) console.log("No parents found!");
    parents.forEach(p => console.log(`Name: ${p.fullName}, Mobile: ${p.mobile}`));

    console.log("\\n[Students] (OTP Login)");
    if (students.length === 0) console.log("No students found!");
    students.forEach(s => console.log(`Name: ${s.fullName}, Mobile: ${s.mobile || 'None'}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
