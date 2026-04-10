require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.promotionRecord.deleteMany({}),
    prisma.promotionCriteria.deleteMany({}),
    prisma.studentEnrollment.updateMany({
      data: { promotionStatus: "PENDING" },
    }),
  ]);
  console.log("Promotion data cleared: promotionRecords, promotionCriteria, promotionStatus reset.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
