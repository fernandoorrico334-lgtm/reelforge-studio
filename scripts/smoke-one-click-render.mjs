import { printSmokeSummary } from "./lib/smoke-utils.mjs";

printSmokeSummary("smoke:one-click-render", {
  status: "skipped",
  reason:
    "One-click render is executed by the existing worker/runtime. Run One-Click Production with mode=render in the app when FFmpeg and worker are active."
});
