import { access, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const comfyWorkflowTemplateIds = [
  "txt2img-basic",
  "img2img-reference-basic"
] as const;

export type KnownComfyWorkflowTemplateId =
  (typeof comfyWorkflowTemplateIds)[number];

export type ComfyWorkflowTemplateOrigin =
  | "storage-custom"
  | "package-default";

export const requiredComfyWorkflowPlaceholders = [
  "{{PROMPT}}",
  "{{NEGATIVE_PROMPT}}",
  "{{WIDTH}}",
  "{{HEIGHT}}",
  "{{SEED}}"
] as const;

export interface BuildComfyWorkflowInput {
  prompt: string;
  negativePrompt?: string | null;
  width?: number;
  height?: number;
  seed?: number | null;
  referenceImage?: string | null;
  stylePreset?: string | null;
  denoise?: number | null;
}

export interface ComfyWorkflowTemplateOptions {
  workflowDirectory?: string | null;
}

export interface ResolvedComfyWorkflowTemplate {
  templateId: string;
  template: Record<string, JsonValue>;
  templatePath: string;
  origin: ComfyWorkflowTemplateOrigin;
  rawTemplate: string;
}

export interface ComfyWorkflowTemplateValidationResult {
  valid: boolean;
  warnings: string[];
  placeholdersFound: string[];
  missingPlaceholders: string[];
  templatePath: string | null;
  origin: ComfyWorkflowTemplateOrigin | null;
  templateId: string;
  errorMessage: string | null;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface WorkflowTemplateCandidate {
  path: string;
  origin: ComfyWorkflowTemplateOrigin;
}

function assertSafeTemplateId(templateId: string) {
  const normalized = templateId.trim();

  if (!normalized) {
    throw new Error("ComfyUI workflow template id is required.");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
    throw new Error(
      `Workflow template id '${templateId}' contains unsupported characters. Use only letters, numbers, '.', '_' or '-'.`
    );
  }
}

function normalizeWorkflowDirectory(workflowDirectory?: string | null) {
  if (!workflowDirectory?.trim()) {
    return null;
  }

  return isAbsolute(workflowDirectory)
    ? workflowDirectory
    : resolve(process.cwd(), workflowDirectory);
}

function resolvePackageTemplatePath(templateId: string) {
  return fileURLToPath(
    new URL(`../workflows/comfyui/${templateId}.json`, import.meta.url)
  );
}

function getTemplateCandidates(
  templateId: string,
  options: ComfyWorkflowTemplateOptions = {}
) {
  assertSafeTemplateId(templateId);
  const customWorkflowDirectory = normalizeWorkflowDirectory(
    options.workflowDirectory
  );
  const candidates: WorkflowTemplateCandidate[] = [];

  if (customWorkflowDirectory) {
    candidates.push({
      path: join(customWorkflowDirectory, `${templateId}.json`),
      origin: "storage-custom"
    });
  }

  candidates.push({
    path: resolvePackageTemplatePath(templateId),
    origin: "package-default"
  });

  return candidates;
}

async function resolveExistingTemplateCandidate(
  templateId: string,
  options: ComfyWorkflowTemplateOptions = {}
) {
  const candidates = getTemplateCandidates(templateId, options);

  for (const candidate of candidates) {
    try {
      await access(candidate.path);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function parseTemplateContents(
  templatePath: string,
  contents: string
): Record<string, JsonValue> {
  try {
    const payload = JSON.parse(contents) as unknown;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Template root must be a JSON object.");
    }

    return payload as Record<string, JsonValue>;
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Unknown JSON parse error.";
    throw new Error(
      `ComfyUI workflow template '${templatePath.replaceAll("\\", "/")}' is invalid: ${message}`
    );
  }
}

function normalizeSeed(seed: number | null | undefined) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.trunc(seed);
  }

  return 42;
}

function normalizeNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function replaceTemplateTokens(
  value: JsonValue,
  replacements: Record<string, string | number | boolean | null>
): JsonValue {
  if (typeof value === "string") {
    const exact = replacements[value];

    if (exact !== undefined) {
      return exact;
    }

    return value.replace(/\{\{[A-Z_]+\}\}/g, (token) => {
      const replacement = replacements[token];

      if (replacement === undefined || replacement === null) {
        return "";
      }

      return String(replacement);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      replaceTemplateTokens(entry, replacements)
    ) as JsonValue[];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceTemplateTokens(entry as JsonValue, replacements)
      ])
    ) as JsonValue;
  }

  return value;
}

function findPlaceholders(rawTemplate: string) {
  return [
    ...new Set(rawTemplate.match(/\{\{[A-Z_]+\}\}/g) ?? [])
  ].sort();
}

function buildTemplateWarnings(
  templateId: string,
  template: Record<string, JsonValue>,
  rawTemplate: string,
  placeholdersFound: string[]
) {
  const warnings: string[] = [];
  const nodeEntries = Object.values(template).filter(
    (entry): entry is Record<string, JsonValue> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
  const classTypes = new Set(
    nodeEntries
      .map((entry) =>
        typeof entry.class_type === "string" ? entry.class_type.trim() : null
      )
      .filter((value): value is string => Boolean(value))
  );

  if (placeholdersFound.length <= requiredComfyWorkflowPlaceholders.length) {
    warnings.push(
      "Workflow ainda esta bastante basico. Considere adicionar controles extras em um template customizado."
    );
  }

  if (nodeEntries.length < 6) {
    warnings.push(
      "Workflow pequeno demais para uso real. Revise os nodes antes de depender dele em producao."
    );
  }

  if (!classTypes.has("SaveImage")) {
    warnings.push(
      "Workflow nao possui node SaveImage detectado. O download PNG pode falhar."
    );
  }

  if (
    rawTemplate.includes("replace-with-local-checkpoint.safetensors") ||
    rawTemplate.includes("replace-with-your-local-checkpoint")
  ) {
    warnings.push(
      "Workflow ainda referencia checkpoint placeholder. Ajuste o modelo local antes do uso real."
    );
  }

  if (
    templateId.includes("img2img") &&
    !placeholdersFound.includes("{{REFERENCE_IMAGE}}")
  ) {
    warnings.push(
      "Workflow img2img nao expoe {{REFERENCE_IMAGE}}. Referencias podem virar apenas contexto textual."
    );
  }

  return warnings;
}

function buildTemplateReplacements(input: BuildComfyWorkflowInput) {
  return {
    "{{PROMPT}}": input.prompt,
    "{{NEGATIVE_PROMPT}}": input.negativePrompt ?? "",
    "{{WIDTH}}": normalizeNumber(input.width, 1080, 128, 4096),
    "{{HEIGHT}}": normalizeNumber(input.height, 1920, 128, 4096),
    "{{SEED}}": normalizeSeed(input.seed),
    "{{REFERENCE_IMAGE}}": input.referenceImage ?? "",
    "{{STYLE_PRESET}}": input.stylePreset ?? "",
    "{{DENOISE}}":
      typeof input.denoise === "number" && Number.isFinite(input.denoise)
        ? input.denoise
        : 0.55
  } satisfies Record<string, string | number | boolean | null>;
}

export async function resolveComfyWorkflowTemplate(
  templateId: string,
  options: ComfyWorkflowTemplateOptions = {}
) {
  const candidate = await resolveExistingTemplateCandidate(templateId, options);

  if (!candidate) {
    const searchedPaths = getTemplateCandidates(templateId, options)
      .map((entry) => entry.path.replaceAll("\\", "/"))
      .join(", ");
    throw new Error(
      `ComfyUI workflow template '${templateId}' was not found. Searched: ${searchedPaths}.`
    );
  }

  const rawTemplate = await readFile(candidate.path, "utf8");

  return {
    templateId,
    template: parseTemplateContents(candidate.path, rawTemplate),
    templatePath: candidate.path.replaceAll("\\", "/"),
    origin: candidate.origin,
    rawTemplate
  } satisfies ResolvedComfyWorkflowTemplate;
}

export async function loadComfyWorkflowTemplate(
  templateId: string,
  options: ComfyWorkflowTemplateOptions = {}
) {
  const resolvedTemplate = await resolveComfyWorkflowTemplate(templateId, options);
  return resolvedTemplate.template;
}

export async function validateComfyWorkflowTemplate(
  templateId: string,
  options: ComfyWorkflowTemplateOptions = {}
) {
  try {
    const resolvedTemplate = await resolveComfyWorkflowTemplate(
      templateId,
      options
    );
    const placeholdersFound = findPlaceholders(resolvedTemplate.rawTemplate);
    const missingPlaceholders = requiredComfyWorkflowPlaceholders.filter(
      (placeholder) => !placeholdersFound.includes(placeholder)
    );
    const warnings = buildTemplateWarnings(
      templateId,
      resolvedTemplate.template,
      resolvedTemplate.rawTemplate,
      placeholdersFound
    );

    try {
      const renderedTemplate = replaceTemplateTokens(
        resolvedTemplate.template,
        buildTemplateReplacements({
          prompt: "diagnostic prompt",
          negativePrompt: "diagnostic negative prompt",
          width: 1080,
          height: 1920,
          seed: 42,
          referenceImage: "diagnostic-reference.png",
          stylePreset: "diagnostic",
          denoise: 0.55
        })
      ) as Record<string, JsonValue>;

      JSON.parse(JSON.stringify(renderedTemplate));

      return {
        valid: missingPlaceholders.length === 0,
        warnings,
        placeholdersFound,
        missingPlaceholders,
        templatePath: resolvedTemplate.templatePath,
        origin: resolvedTemplate.origin,
        templateId,
        errorMessage: null
      } satisfies ComfyWorkflowTemplateValidationResult;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Rendered workflow could not be serialized.";

      return {
        valid: false,
        warnings,
        placeholdersFound,
        missingPlaceholders,
        templatePath: resolvedTemplate.templatePath,
        origin: resolvedTemplate.origin,
        templateId,
        errorMessage: message
      } satisfies ComfyWorkflowTemplateValidationResult;
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Unknown workflow validation error.";

    return {
      valid: false,
      warnings: [message],
      placeholdersFound: [],
      missingPlaceholders: [...requiredComfyWorkflowPlaceholders],
      templatePath: null,
      origin: null,
      templateId,
      errorMessage: message
    } satisfies ComfyWorkflowTemplateValidationResult;
  }
}

export async function buildComfyWorkflowFromTemplate(
  templateId: string,
  input: BuildComfyWorkflowInput,
  options: ComfyWorkflowTemplateOptions = {}
) {
  const template = await loadComfyWorkflowTemplate(templateId, options);

  return replaceTemplateTokens(
    template,
    buildTemplateReplacements(input)
  ) as Record<string, JsonValue>;
}

