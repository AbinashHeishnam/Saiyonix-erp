const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findFirst({ where: { role: { roleType: 'TEACHER' } }, include: { teacher: true }});
  const student = await prisma.user.findFirst({ where: { role: { roleType: 'STUDENT' } }, include: { student: true }});
  const parent = await prisma.user.findFirst({ where: { role: { roleType: 'PARENT' } }, include: { parent: true }});
  
  console.log("Teacher:", teacher ? teacher.email || teacher.teacher?.phone : "None");
  console.log("Student:", student ? student.email || student.student?.phone : "None");
  console.log("Parent:", parent ? parent.email || parent.parent?.phone : "None");
}
main().finally(() => prisma.$disconnect());
