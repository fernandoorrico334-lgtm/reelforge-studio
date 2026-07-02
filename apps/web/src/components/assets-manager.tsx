"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  createAssetRequest,
  deleteAssetRequest,
  updateAssetRequest,
  uploadAssetRequest
} from "../lib/studio-api";
import type {
  AssetCategory,
  AssetPayload,
  AssetType,
  CopyrightRisk,
  DataSource,
  EmotionTag,
  GeneratedImageGalleryItem,
  StudioAsset
} from "../lib/studio-types";
import {
  assetCategories,
  assetTypes,
  copyrightRisks,
  emotionTags
} from "../lib/studio-types";

interface AssetsManagerProps {
  initialAssets: StudioAsset[];
  initialSource: DataSource;
  generatedImages?: GeneratedImageGalleryItem[];
}

type UploadTypeOption = AssetType | "AUTO";

interface UploadFormState {
  file: File | null;
  type: UploadTypeOption;
  category: AssetCategory;
  franchise: string;
  character: string;
  emotion: EmotionTag | "";
  tags: string;
  licenseType: string;
  copyrightRisk: CopyrightRisk;
  recommendedUse: string;
}

interface ManualFormState {
  filename: string;
  originalName: string;
  path: string;
  type: AssetType;
  category: AssetCategory;
  franchise: string;
  character: string;
  emotion: EmotionTag | "";
  tags: string;
  licenseType: string;
  copyrightRisk: CopyrightRisk;
  recommendedUse: string;
  duration: string;
  width: string;
  height: string;
}

const emptyUploadForm: UploadFormState = {
  file: null,
  type: "AUTO",
  category: "REFERENCE",
  franchise: "",
  character: "",
  emotion: "",
  tags: "",
  licenseType: "owned-original",
  copyrightRisk: "LOW",
  recommendedUse: ""
};

const emptyManualForm: ManualFormState = {
  filename: "",
  originalName: "",
  path: "",
  type: "IMAGE",
  category: "REFERENCE",
  franchise: "",
  character: "",
  emotion: "",
  tags: "",
  licenseType: "owned-original",
  copyrightRisk: "LOW",
  recommendedUse: "",
  duration: "",
  width: "",
  height: ""
};

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) {
    return "n/d";
  }

  const units = ["B", "KB", "MB", "GB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  return `${currentValue.toFixed(currentValue >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function toNullableString(value: string) {
  return value.trim() || null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildManualPayload(
  form: ManualFormState,
  existingAsset: StudioAsset | null
): AssetPayload {
  return {
    filename: form.filename.trim(),
    originalName: form.originalName.trim(),
    path: form.path.trim(),
    type: form.type,
    category: form.category,
    franchise: toNullableString(form.franchise),
    character: toNullableString(form.character),
    emotion: form.emotion || null,
    tags: normalizeTags(form.tags),
    licenseType: form.licenseType.trim(),
    copyrightRisk: form.copyrightRisk,
    recommendedUse: toNullableString(form.recommendedUse),
    duration: toNullableNumber(form.duration),
    width: toNullableNumber(form.width),
    height: toNullableNumber(form.height),
    mimeType: existingAsset?.mimeType ?? null,
    extension: existingAsset?.extension ?? null,
    fileSize: existingAsset?.fileSize ?? null
  };
}

function toManualFormState(asset: StudioAsset): ManualFormState {
  return {
    filename: asset.filename,
    originalName: asset.originalName,
    path: asset.path,
    type: asset.type,
    category: asset.category,
    franchise: asset.franchise ?? "",
    character: asset.character ?? "",
    emotion: asset.emotion ?? "",
    tags: asset.tags.join(", "),
    licenseType: asset.licenseType,
    copyrightRisk: asset.copyrightRisk,
    recommendedUse: asset.recommendedUse ?? "",
    duration: asset.duration?.toString() ?? "",
    width: asset.width?.toString() ?? "",
    height: asset.height?.toString() ?? ""
  };
}

function applyPayload(
  asset: StudioAsset,
  payload: AssetPayload,
  timestamp: string
): StudioAsset {
  return {
    ...asset,
    ...payload,
    updatedAt: timestamp
  };
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

function readGeneratedMetadataString(
  item: GeneratedImageGalleryItem | undefined,
  key: string
) {
  const value = item?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isGeneratedAsset(
  asset: StudioAsset,
  item: GeneratedImageGalleryItem | undefined
) {
  return (
    Boolean(item) ||
    asset.tags.includes("generated") ||
    asset.sourceProvider === "mock-svg" ||
    asset.sourceProvider === "comfyui-local" ||
    asset.sourceProvider === "hybrid-visual-engine"
  );
}

function assetMatchesQuery(
  asset: StudioAsset,
  search: string,
  type: string,
  category: string,
  emotion: string,
  risk: string
) {
  if (type !== "ALL" && asset.type !== type) {
    return false;
  }

  if (category !== "ALL" && asset.category !== category) {
    return false;
  }

  if (emotion !== "ALL" && asset.emotion !== emotion) {
    return false;
  }

  if (risk !== "ALL" && asset.copyrightRisk !== risk) {
    return false;
  }

  if (!search.trim()) {
    return true;
  }

  const query = search.toLowerCase();
  const haystack = [
    asset.filename,
    asset.originalName,
    asset.path,
    asset.franchise ?? "",
    asset.character ?? "",
    asset.mimeType ?? "",
    asset.extension ?? "",
    asset.tags.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function inferSelectedFilePreviewKind(file: File | null) {
  if (!file) {
    return "file";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  return "file";
}

function SelectedFilePreview({
  file,
  previewUrl
}: {
  file: File | null;
  previewUrl: string | null;
}) {
  const previewKind = inferSelectedFilePreviewKind(file);

  if (!file || !previewUrl) {
    return (
      <div className="flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-5">
        <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/65">
          Ingest Desk
        </div>
        <div>
          <p className="text-2xl font-semibold text-white">
            Selecione um arquivo
          </p>
          <p className="mt-3 text-sm leading-7 text-mist/68">
            Imagens, videos, audios, musicas, efeitos, overlays e fontes podem
            entrar direto em `storage/assets`.
          </p>
        </div>
      </div>
    );
  }

  if (previewKind === "image") {
    return (
      <div className="min-h-56 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
        <img
          src={previewUrl}
          alt={file.name}
          className="h-full min-h-56 w-full object-cover"
        />
      </div>
    );
  }

  if (previewKind === "video") {
    return (
      <div className="min-h-56 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
        <video
          controls
          preload="metadata"
          className="h-full min-h-56 w-full object-cover"
        >
          <source src={previewUrl} />
        </video>
      </div>
    );
  }

  if (previewKind === "audio") {
    return (
      <div className="flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,158,102,0.18),rgba(255,255,255,0.04))] p-5">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Audio Preview
          </p>
          <p className="mt-4 text-2xl font-semibold text-white">
            {file.name}
          </p>
        </div>
        <audio controls preload="metadata" className="w-full">
          <source src={previewUrl} />
        </audio>
      </div>
    );
  }

  return (
    <div className="flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.18),transparent_32%),rgba(255,255,255,0.04)] p-5">
      <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/65">
        File Ready
      </div>
      <div>
        <p className="text-2xl font-semibold text-white">{file.name}</p>
        <p className="mt-3 text-sm leading-7 text-mist/68">
          Preview visual detalhado para este formato entra em uma iteracao
          futura, mas o upload local ja pode ser catalogado agora.
        </p>
      </div>
    </div>
  );
}

export function AssetsManager({
  initialAssets,
  initialSource,
  generatedImages = []
}: AssetsManagerProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<
    string | null
  >(null);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Biblioteca conectada a API local."
      : "Biblioteca em modo mock ate a API ficar disponivel."
  );
  const generatedImageMap = new Map(
    generatedImages
      .filter((item) => item.asset?.id)
      .map((item) => [item.asset!.id, item])
  );

  const editingAsset =
    editingId !== null
      ? assets.find((asset) => asset.id === editingId) ?? null
      : null;

  useEffect(() => {
    if (!uploadForm.file) {
      setSelectedFilePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(uploadForm.file);
    setSelectedFilePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [uploadForm.file]);

  const visibleAssets = [...assets]
    .filter((asset) =>
      assetMatchesQuery(
        asset,
        deferredSearchQuery,
        typeFilter,
        categoryFilter,
        emotionFilter,
        riskFilter
      )
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadForm.file) {
      setStatusMessage("Selecione um arquivo antes de enviar.");
      return;
    }

    const formData = new FormData();
    formData.set("file", uploadForm.file);
    formData.set("category", uploadForm.category);

    if (uploadForm.type !== "AUTO") {
      formData.set("type", uploadForm.type);
    }

    formData.set("franchise", uploadForm.franchise);
    formData.set("character", uploadForm.character);
    formData.set("emotion", uploadForm.emotion);
    formData.set("tags", uploadForm.tags);
    formData.set("licenseType", uploadForm.licenseType);
    formData.set("copyrightRisk", uploadForm.copyrightRisk);
    formData.set("recommendedUse", uploadForm.recommendedUse);

    try {
      const created = await uploadAssetRequest(formData);
      setAssets((current) => [created, ...current]);
      setSource("api");
      setStatusMessage(
        "Arquivo enviado para storage/assets e catalogado na biblioteca."
      );
      setUploadForm(emptyUploadForm);
      setUploadInputKey((current) => current + 1);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleManualSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const payload = buildManualPayload(manualForm, editingAsset);
    const now = new Date().toISOString();

    try {
      if (editingId) {
        const updated = await updateAssetRequest(editingId, payload);
        setAssets((current) =>
          current.map((asset) => (asset.id === editingId ? updated : asset))
        );
        setStatusMessage("Asset atualizado na API local.");
      } else {
        const created = await createAssetRequest(payload);
        setAssets((current) => [created, ...current]);
        setStatusMessage("Asset manual criado na API local.");
      }

      setSource("api");
    } catch {
      if (editingId) {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === editingId ? applyPayload(asset, payload, now) : asset
          )
        );
        setStatusMessage(
          "API indisponivel. Metadata atualizada apenas nesta sessao local."
        );
      } else {
        setAssets((current) => [
          {
            id: createLocalId("asset"),
            createdAt: now,
            updatedAt: now,
            ...payload
          },
          ...current
        ]);
        setStatusMessage(
          "API indisponivel. Asset manual criado apenas nesta sessao local."
        );
      }

      setSource("mock");
    }

    setManualForm(emptyManualForm);
    setEditingId(null);
  }

  function startEditing(asset: StudioAsset) {
    setEditingId(asset.id);
    setManualForm(toManualFormState(asset));
    setStatusMessage(`Editando ${asset.filename}.`);
  }

  function cancelEditing() {
    setEditingId(null);
    setManualForm(emptyManualForm);
    setStatusMessage(
      source === "api"
        ? "Biblioteca conectada a API local."
        : "Biblioteca em modo mock ate a API ficar disponivel."
    );
  }

  async function handleDelete(id: string) {
    try {
      await deleteAssetRequest(id);
      setAssets((current) => current.filter((asset) => asset.id !== id));
      setSource("api");
      setStatusMessage("Asset removido da API local.");
    } catch {
      setAssets((current) => current.filter((asset) => asset.id !== id));
      setSource("mock");
      setStatusMessage(
        "API indisponivel. Asset removido apenas desta sessao local."
      );
    }

    if (editingId === id) {
      cancelEditing();
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Creative Arsenal
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {visibleAssets.length} assets visiveis
            </h2>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs ${
              source === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {source === "api" ? "API live" : "Mock mode"}
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/70">
          {statusMessage}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por nome, tags, mime ou franquia"
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/50 xl:col-span-2"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os tipos</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todas as categorias</option>
            {assetCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={emotionFilter}
            onChange={(event) => setEmotionFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todas as emocoes</option>
            {emotionTags.map((emotion) => (
              <option key={emotion} value={emotion}>
                {emotion}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os riscos</option>
            {copyrightRisks.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
          <div className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/65">
            Upload real e preview local ativos nesta etapa
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {visibleAssets.map((asset) => {
            const generatedImage = generatedImageMap.get(asset.id);
            const generated = isGeneratedAsset(asset, generatedImage);
            const workflowPackId = readGeneratedMetadataString(
              generatedImage,
              "workflowPackId"
            );
            const qualityPresetId = readGeneratedMetadataString(
              generatedImage,
              "qualityPresetId"
            );

            return (
            <article
              key={asset.id}
              id={`asset-${asset.id}`}
              className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20"
            >
              <AssetMediaPreview asset={asset} source={source} />

              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs text-signal">
                        {asset.type}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        {asset.category}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        risco {asset.copyrightRisk}
                      </span>
                      {generated ? (
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                          generated
                        </span>
                      ) : null}
                      {workflowPackId ? (
                        <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-xs text-[#e2e8ff]">
                          pack {workflowPackId}
                        </span>
                      ) : null}
                      {qualityPresetId ? (
                        <span className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-3 py-1 text-xs text-[#d8f8ff]">
                          quality {qualityPresetId}
                        </span>
                      ) : null}
                      {asset.type === "VIDEO" ? (
                        <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-xs text-[#fff0cb]">
                          microclip-ready
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">
                      {asset.filename}
                    </h3>
                    <p className="mt-2 break-all text-sm text-mist/55">
                      {asset.path}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(asset)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(asset.id)}
                      className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-100"
                    >
                      Deletar
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {asset.mimeType ?? "mime n/d"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {asset.extension ?? "ext n/d"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {formatBytes(asset.fileSize)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {asset.width ?? "?"} x {asset.height ?? "?"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Contexto
                    </p>
                    <p className="mt-2 text-sm leading-7 text-mist/70">
                      {(asset.franchise ?? "Sem franquia")} /{" "}
                      {asset.character ?? "Sem personagem"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Uso recomendado
                    </p>
                    <p className="mt-2 text-sm leading-7 text-mist/70">
                      {asset.recommendedUse ?? "Ainda nao definido."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <span
                      key={`${asset.id}-${tag}`}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70"
                    >
                      {tag}
                    </span>
                  ))}
                  {asset.type === "VIDEO" ? (
                    <a
                      href="/projects"
                      className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-xs text-[#fff0cb]"
                    >
                      usar como microclip
                    </a>
                  ) : null}
                </div>

                <p className="mt-5 text-xs text-mist/45">
                  Atualizado em {formatDate(asset.updatedAt)}
                </p>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Upload Real
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Ingestao direta para storage/assets
              </h2>
            </div>
            <div className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs text-signal">
              multipart/form-data
            </div>
          </div>

          <div className="mt-6">
            <SelectedFilePreview
              file={uploadForm.file}
              previewUrl={selectedFilePreviewUrl}
            />
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleUploadSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Arquivo</span>
              <input
                key={uploadInputKey}
                type="file"
                required
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] ?? null
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/80 file:mr-4 file:rounded-full file:border-0 file:bg-signal file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Type</span>
                <select
                  value={uploadForm.type}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      type: event.target.value as UploadTypeOption
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="AUTO">AUTO</option>
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Category</span>
                <select
                  value={uploadForm.category}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      category: event.target.value as AssetCategory
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {assetCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Franchise</span>
                <input
                  value={uploadForm.franchise}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      franchise: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Character</span>
                <input
                  value={uploadForm.character}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      character: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Emotion</span>
                <select
                  value={uploadForm.emotion}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      emotion: event.target.value as EmotionTag | ""
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Sem emocao</option>
                  {emotionTags.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Copyright risk
                </span>
                <select
                  value={uploadForm.copyrightRisk}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      copyrightRisk: event.target.value as CopyrightRisk
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {copyrightRisks.map((risk) => (
                    <option key={risk} value={risk}>
                      {risk}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Tags</span>
              <input
                value={uploadForm.tags}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    tags: event.target.value
                  }))
                }
                placeholder="anime, hook, ambience"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">License type</span>
                <input
                  value={uploadForm.licenseType}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      licenseType: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Recommended use
                </span>
                <input
                  value={uploadForm.recommendedUse}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      recommendedUse: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
              Destino previsto: `storage/assets/{uploadForm.category.toLowerCase()}/
              {uploadForm.type === "AUTO"
                ? "auto"
                : uploadForm.type.toLowerCase()}
              `
            </div>

            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              Enviar para biblioteca
            </button>
          </form>
        </section>

        <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Advanced Manual Entry
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {editingId ? "Editar metadata" : "Registrar path local manual"}
              </h2>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
            Esta opcao nao move o arquivo. Ela apenas registra um path local ja
            existente para catalogacao avancada.
          </p>

          {editingAsset ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                {editingAsset.mimeType ?? "mime n/d"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                {editingAsset.extension ?? "ext n/d"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                {formatBytes(editingAsset.fileSize)}
              </span>
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleManualSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Filename</span>
                <input
                  required
                  value={manualForm.filename}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      filename: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Original name
                </span>
                <input
                  required
                  value={manualForm.originalName}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      originalName: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Path local</span>
              <input
                required
                value={manualForm.path}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    path: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Type</span>
                <select
                  value={manualForm.type}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      type: event.target.value as AssetType
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Category</span>
                <select
                  value={manualForm.category}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      category: event.target.value as AssetCategory
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {assetCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Franchise</span>
                <input
                  value={manualForm.franchise}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      franchise: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Character</span>
                <input
                  value={manualForm.character}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      character: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Emotion</span>
                <select
                  value={manualForm.emotion}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      emotion: event.target.value as EmotionTag | ""
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Sem emocao</option>
                  {emotionTags.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Copyright risk
                </span>
                <select
                  value={manualForm.copyrightRisk}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      copyrightRisk: event.target.value as CopyrightRisk
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {copyrightRisks.map((risk) => (
                    <option key={risk} value={risk}>
                      {risk}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Tags</span>
              <input
                value={manualForm.tags}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    tags: event.target.value
                  }))
                }
                placeholder="anime, lore, hook"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">License type</span>
                <input
                  required
                  value={manualForm.licenseType}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      licenseType: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Recommended use
                </span>
                <input
                  value={manualForm.recommendedUse}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      recommendedUse: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Duration</span>
                <input
                  value={manualForm.duration}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      duration: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Width</span>
                <input
                  value={manualForm.width}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      width: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Height</span>
                <input
                  value={manualForm.height}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      height: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              {editingId ? "Salvar metadata" : "Criar asset manual"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
