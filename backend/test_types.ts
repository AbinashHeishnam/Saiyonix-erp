import prisma from "./src/core/db/prisma";
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type DbClient = typeof prisma | TransactionClient;

async function doSomething(client: DbClient) {
  return client.admitCard.findFirst();
}
