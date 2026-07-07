import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const API = "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status}: ${text}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await request("/health");
  assert(health.status === "ok", "API health check failed");

  const channels = await request("/channels");
  const channel =
    channels.find((item) => /football|futebol|sport/i.test(item.niche ?? "")) ??
    channels[0];
  assert(channel?.id, "Expected at least one channel");

  const sampleVideoPath = resolve(
    projectRoot,
    "tmp",
    `beast-http-remix-${Date.now()}.mp4`
  );
  await writeFile(sampleVideoPath, "beast-http-remix-placeholder");

  const remix = await request("/media-beast/remix-video", {
    method: "POST",
    body: JSON.stringify({
      inputVideoPath: sampleVideoPath,
      targetStyle: "hype_sports",
      intensity: "extreme",
      addNarration: true,
      durationTarget: 35
    })
  });

  assert(remix.durationSeconds <= 45, `Remix output must be <= 45s, got ${remix.durationSeconds}`);
  assert(remix.videoAnalysis?.themeSummary, "Expected video analysis");
  assert(remix.assetDiscovery?.comfyui?.variationCount, "Expected asset discovery plan");
  assert(remix.sceneStructure.totalScenes <= 5, `Too many scenes: ${remix.sceneStructure.totalScenes}`);
  assert(remix.visualPlan.comfyVariations.length <= 5, "Too many visual variations");

  const script = (remix.narrationPlan?.suggestedScript ?? "")
    .split("\n")
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");

  const created = await request("/production/create-from-script", {
    method: "POST",
    body: JSON.stringify({
      title: "Beast HTTP Smoke",
      channelId: channel.id,
      script,
      durationTarget: 35,
      sceneDuration: 7,
      maxScenes: 5,
      format: "9:16",
      status: "DRAFT",
      autoCreateScenes: true,
      applyChannelDefaults: true
    })
  });

  const projectId = created.project.id;
  assert(created.scenesCreated <= 5, `Project created with ${created.scenesCreated} scenes`);

  const dryRun = await request(`/reel-production/projects/${projectId}/run`, {
    method: "POST",
    body: JSON.stringify({
      mode: "dry_run",
      remixMode: "remix",
      inputVideoPath: sampleVideoPath,
      targetStyle: "hype_sports",
      intensity: "extreme",
      addNarration: true,
      durationTarget: remix.durationSeconds,
      defaults: {
        voicePackId: "sports_hype_ptbr",
        musicPresetId: remix.musicPlan.musicPresetId
      },
      providerStrategy: {
        visualProvider: "mock-svg",
        fallbackVisualProvider: "mock-svg",
        narrationProvider: "mock-tts"
      },
      options: {
        createRenderJob: false,
        runRender: false
      }
    })
  });

  assert(dryRun.beastPlan?.planType === "video_remix", "Dry run should return remix beast plan");
  assert(!dryRun.renderJobId, "Dry run must not create render job");

  const render = await request(`/reel-production/projects/${projectId}/run`, {
    method: "POST",
    body: JSON.stringify({
      mode: "render",
      remixMode: "remix",
      inputVideoPath: sampleVideoPath,
      targetStyle: "hype_sports",
      intensity: "extreme",
      addNarration: true,
      durationTarget: remix.durationSeconds,
      planApproved: true,
      rightsConfirmed: true,
      defaults: {
        voicePackId: "sports_hype_ptbr",
        musicPresetId: remix.musicPlan.musicPresetId,
        audioMasteringPresetId: remix.musicPlan.masteringPresetId
      },
      providerStrategy: {
        visualProvider: "mock-svg",
        fallbackVisualProvider: "mock-svg",
        narrationProvider: "mock-tts"
      },
      options: {
        generateMissingNarration: true,
        generateMissingVisuals: true,
        selectMusic: true,
        buildBeatSyncPlan: true,
        createRenderJob: true,
        runRender: true
      }
    })
  });

  assert(render.renderJobId, "Authorized beast render must create RenderJob");
  if (render.status === "failed") {
    const failedSteps =
      render.steps?.filter((step) => step.status === "failed") ?? [];
    throw new Error(
      `Render failed: ${failedSteps.map((step) => `${step.id}: ${step.message}`).join(" | ") || render.warnings?.join(" ")}`
    );
  }

  assert(
    render.status === "completed" || render.status === "partial",
    `Unexpected render status: ${render.status}`
  );

  const project = await request(`/video-projects/${projectId}`);
  assert(project.scenes.length <= 5, `Project has ${project.scenes.length} scenes after sync`);

  console.log(
    JSON.stringify(
      {
        smoke: "beast-http-render",
        status: render.outputPath ? "completed" : render.status,
        health: health.status,
        projectId,
        sceneCount: project.scenes.length,
        remixDuration: remix.durationSeconds,
        remixScenes: remix.sceneStructure.totalScenes,
        visualVariations: remix.visualPlan.comfyVariations.length,
        dryRunStatus: dryRun.status,
        renderJobId: render.renderJobId,
        outputPath: render.outputPath,
        finalStatus: render.status,
        warnings: render.warnings?.slice(0, 3) ?? []
      },
      null,
      2
    )
  );

  if (!render.outputPath) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});