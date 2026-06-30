import { prisma } from "./infrastructure/prisma-client.js";
import {
  runRenderWorkerOnce,
  startRenderWorkerLoop
} from "./services/render-worker.js";

const shouldRunOnce =
  process.argv.includes("--once") ||
  process.env.RENDER_WORKER_ONCE === "true";

if (shouldRunOnce) {
  console.log("ReelForge Worker booted in Render Engine V1 once mode.");
  const result = await runRenderWorkerOnce({
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

