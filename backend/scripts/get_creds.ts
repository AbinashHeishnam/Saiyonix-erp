import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const roles = ["TEACHER", "STUDENT", "PARENT"];
    console.log("=== USERS ===");
    for (const r of roles) {
        const user = await prisma.user.findFirst({
            where: { role: { roleType: r as any } },
            include: { teacher: true, student: true, parent: true }
        });
        console.log(`Role: ${r}`);
        console.log(`Email: ${user?.email || "N/A"}`);
        if (r === "TEACHER") console.log(`Phone: ${user?.teacher?.phone || "N/A"}`);
        if (r === "STUDENT") console.log(`Phone: ${user?.student?.parentMobile || "N/A"} (parent's mobile for generic)`);
        if (r === "PARENT") console.log(`Phone: ${user?.parent?.phone || "N/A"}`);
        console.log("-------------------");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
