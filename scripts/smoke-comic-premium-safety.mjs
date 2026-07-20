import { spawn } from "node:child_process";

const node = process.execPath;
const commands = [
  [node, ["scripts/smoke-comic-premium-flow-policy.mjs"]],
  [node, ["scripts/smoke-comic-historian-narration-stack.mjs"]],
  [node, ["scripts/smoke-comic-narration-premium-refinements.mjs"]],
  [node, ["scripts/smoke-comic-narration-reference-dna.mjs"]],
  [node, ["scripts/smoke-comic-narrator-director.mjs"]],
  [node, ["scripts/smoke-comic-visual-evidence-sync.mjs"]],
  [node, ["scripts/smoke-comic-combat-framing.mjs"]],
  [node, ["--check", "scripts/render-comic-complete-saga-v1.mjs"]],
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(command + " " + args.join(" ") + " failed with exit code " + code));
    });
  });
}

const startedAt = Date.now();
for (const entry of commands) {
  const command = entry[0];
  const args = entry[1];
  console.log("\n[safety] running: " + command + " " + args.join(" "));
  await run(command, args);
}

console.log(JSON.stringify({
  suiteId: "comic_premium_safety_suite_v1",
  commandCount: commands.length,
  elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
  status: "completed"
}, null, 2));
