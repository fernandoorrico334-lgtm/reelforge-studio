import { buildComicCombatFramingPlan } from "../packages/media-beast/dist/index.js";

const page = { page: "page-0001.jpg", width: 2000, height: 3000, panelCount: 2, warnings: [], panels: [] };
const baseShot = {
  beatIndex: 0, page: page.page, pageNumber: 1, panelReadingOrder: 1, durationSeconds: 1.8,
  cameraMove: "action_pan", transitionIn: "cut", isColdOpen: false, narrativeOrderExempt: false,
  confidence: 90, dialogueBalloonId: null, speakerAnchor: null, semanticAssociationConfidence: 0, warnings: [],
};
const shots = [
  { ...baseShot, shotId: "wide-punch", panelId: "panel-1", shotRole: "action", normalizedCrop: { x: 0.02, y: 0.2, width: 0.96, height: 0.22 } },
  { ...baseShot, shotId: "vertical-impact", panelId: "panel-2", shotRole: "impact", normalizedCrop: { x: 0.2, y: 0.1, width: 0.55, height: 0.75 } },
];
const plan = buildComicCombatFramingPlan({ shots, detectedPages: [page] });
if (!plan.passed) throw new Error("Combat framing plan failed.");
if (plan.decisions[0]?.mode !== "full_panel_stage") throw new Error("Wide combat panel was not preserved.");
if (!plan.decisions[0]?.preservesAttackerAndTarget) throw new Error("Action pair preservation missing.");
if (plan.decisions[0]?.cameraStrategy !== "establish_then_impact_pan") throw new Error("Wide combat panel lacks dynamic impact pan.");
if (plan.decisions[1]?.mode !== "standard_crop") throw new Error("Vertical panel should keep standard crop.");
console.log(JSON.stringify({ directorId: plan.directorId, fullPanelStageCount: plan.fullPanelStageCount, unsafeWideCombatCropCount: plan.unsafeWideCombatCropCount, widePunchMode: plan.decisions[0]?.mode, cameraStrategy: plan.decisions[0]?.cameraStrategy, targetFocusX: plan.decisions[0]?.targetFocusX, status: "completed" }, null, 2));
