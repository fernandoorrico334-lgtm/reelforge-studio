import { prisma } from "./infrastructure/prisma-client.js";
import {
  runRenderWorkerOnce,
  startRenderWorkerLoop
} from "./services/render-worker.js";

const shouldRunOnce =
  process.argv.includes("--once") ||
  process.env.RENDER_WORKER_ONCE === "true";

function readCliValue(flagName: string) {
  const inlineArg = process.argv.find((arg) =>
    arg.startsWith(`${flagName}=`)
  );
  if (inlineArg) {
    return inlineArg.slice(flagName.length + 1).trim() || null;
  }

  const flagIndex = process.argv.indexOf(flagName);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1]?.trim() || null;
  }

  return null;
}

if (shouldRunOnce) {
  console.log("ReelForge Worker booted in Render Engine V1 once mode.");
  const renderJobId = readCliValue("--render-job-id");
  const result = await runRenderWorkerOnce({
    renderJobId,
    logger: (message) => {
      console.log(`[worker:once] ${message}`);
    }
  });
  console.log(
    `[worker:once] Final status: ${result.finalStatus}. Render job: ${result.renderJobId ?? "none"}.`
  );
  await prisma.$disconnect();
  process.exit(result.exitCode);
}

console.log("ReelForge Worker booted in Render Engine V1 mode.");
console.log("Polling queued render jobs every 3 seconds using Prisma + SQLite.");

try {
  await startRenderWorkerLoop();
} finally {
  await prisma.$disconnect();
}

