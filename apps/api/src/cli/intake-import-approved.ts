import { prisma } from "../infrastructure/database/prisma-client.js";
import { createPrismaAssetRepository } from "../modules/assets/infrastructure/prisma-asset-repository.js";
import { importApprovedInboxCandidates } from "../modules/intake/application/intake-service.js";
import { createPrismaIntakeRepository } from "../modules/intake/infrastructure/prisma-intake-repository.js";

async function main() {
  const intakeRepository = createPrismaIntakeRepository({ prismaClient: prisma });
  const assetRepository = createPrismaAssetRepository({ prismaClient: prisma });
  const result = await importApprovedInboxCandidates(
    intakeRepository,
    assetRepository
  );
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

