"use client";

import { useMemo, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  buildCharacterBasePromptRequest,
  createCharacterFromIntakeRequest,
  createCharacterReferenceRequest,
  createCharacterRequest,
  deleteCharacterReferenceRequest,
  deleteCharacterRequest,
  updateCharacterReferenceRequest,
  updateCharacterRequest
} from "../lib/studio-api";
import type {
  CharacterProfile,
  CharacterProfilePayload,
  CharacterReference,
  CharacterReferencePayload,
  CharacterReferenceType,
  DataSource,
  StudioAsset
} from "../lib/studio-types";
import { characterReferenceTypes } from "../lib/studio-types";

interface CharactersManagerProps {
  initialAssets: StudioAsset[];
  initialCharacters: CharacterProfile[];
  initialSource: DataSource;
}

interface CharacterFormState {
  name: string;
  slug: string;
  franchise: string;
  category: string;
  description: string;
  basePrompt: string;
  negativePrompt: string;
  styleNotes: string;
  defaultVisualStyle: string;
  referenceStrength: string;
  preferredProvider: string;
  tags: string;
}

interface ReferenceFormState {
  assetId: string;
  sourcePath: string;
  title: string;
  notes: string;
  referenceType: CharacterReferenceType;
  strength: string;
}

const emptyCharacterForm: CharacterFormState = {
  name: "",
  slug: "",
  franchise: "",
  category: "",
  description: "",
  basePrompt: "",
  negativePrompt: "",
  styleNotes: "",
  defaultVisualStyle: "",
  referenceStrength: "0.75",
  preferredProvider: "mock-svg",
  tags: ""
};

const emptyReferenceForm: ReferenceFormState = {
  assetId: "",
  sourcePath: "",
  title: "",
  notes: "",
  referenceType: "other",
  strength: "0.75"
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

function toNullableString(value: string) {
  return value.trim() || null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function suggestCharacterWorkflowPack(profile: CharacterProfile) {
  const text = [
    profile.category,
    profile.defaultVisualStyle,
    profile.styleNotes,
    profile.tags.join(" ")
  ]
    .join(" ")
    .toLowerCase();
  const id = text.includes("anime")
    ? "anime_dark"
    : text.includes("comic") || text.includes("hq")
      ? "comic_drama"
      : text.includes("game")
        ? "game_epic"
        : text.includes("horror") || text.includes("dark")
          ? "horror_tension"
          : "cinematic_story";

  return {
    id,
    name: id.replaceAll("_", " "),
    styleNotes:
      "Sugestao local para UI. A API aplica o catalogo oficial de workflow packs.",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: id
  };
}

function toCharacterPayload(form: CharacterFormState): CharacterProfilePayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    franchise: toNullableString(form.franchise),
    category: toNullableString(form.category),
    description: toNullableString(form.description),
    basePrompt: toNullableString(form.basePrompt),
    negativePrompt: toNullableString(form.negativePrompt),
    styleNotes: toNullableString(form.styleNotes),
    defaultVisualStyle: toNullableString(form.defaultVisualStyle),
    referenceStrength: toNullableNumber(form.referenceStrength),
    preferredProvider: toNullableString(form.preferredProvider),
    tags: parseTags(form.tags)
  };
}

function toCharacterForm(profile: CharacterProfile): CharacterFormState {
  return {
    name: profile.name,
    slug: profile.slug,
    franchise: profile.franchise ?? "",
    category: profile.category ?? "",
    description: profile.description ?? "",
    basePrompt: profile.basePrompt ?? "",
    negativePrompt: profile.negativePrompt ?? "",
    styleNotes: profile.styleNotes ?? "",
    defaultVisualStyle: profile.defaultVisualStyle ?? "",
    referenceStrength: profile.referenceStrength.toString(),
    preferredProvider: profile.preferredProvider,
    tags: profile.tags.join(", ")
  };
}

function toReferencePayload(form: ReferenceFormState): CharacterReferencePayload {
  return {
    assetId: form.assetId || null,
    sourcePath: toNullableString(form.sourcePath),
    title: toNullableString(form.title),
    notes: toNullableString(form.notes),
    referenceType: form.referenceType,
    strength: toNullableNumber(form.strength)
  };
}

function toReferenceForm(reference: CharacterReference): ReferenceFormState {
  return {
    assetId: reference.assetId ?? "",
    sourcePath: reference.sourcePath ?? "",
    title: reference.title ?? "",
    notes: reference.notes ?? "",
    referenceType: reference.referenceType,
    strength: reference.strength.toString()
  };
}

function applyCharacterPayload(
  current: CharacterProfile,
  payload: CharacterProfilePayload,
  timestamp: string
): CharacterProfile {
  return {
    ...current,
    ...payload,
    preferredProvider: payload.preferredProvider ?? "mock-svg",
    referenceStrength: payload.referenceStrength ?? 0.75,
    updatedAt: timestamp
  };
}

export function CharactersManager({
  initialAssets,
  initialCharacters,
  initialSource
}: CharactersManagerProps) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [characterForm, setCharacterForm] = useState<CharacterFormState>(emptyCharacterForm);
  const [referenceForm, setReferenceForm] = useState<ReferenceFormState>(emptyReferenceForm);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    initialCharacters[0]?.id ?? null
  );
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [intakeSlug, setIntakeSlug] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Characters conectados a API local."
      : "Characters em modo mock ate a API local ficar disponivel."
  );

  const orderedCharacters = useMemo(
    () =>
      [...characters].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [characters]
  );
  const selectedCharacter =
    orderedCharacters.find((entry) => entry.id === selectedCharacterId) ?? null;
  const selectedCharacterWorkflowPack = selectedCharacter
    ? suggestCharacterWorkflowPack(selectedCharacter)
    : null;
  const referenceAssets = initialAssets.filter(
    (asset) => asset.category === "CHARACTER" || asset.category === "REFERENCE"
  );

  async function handleCharacterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toCharacterPayload(characterForm);
    const now = new Date().toISOString();

    try {
      if (editingCharacterId) {
        const updated = await updateCharacterRequest(editingCharacterId, payload);
        setCharacters((current) =>
          current.map((entry) => (entry.id === editingCharacterId ? updated : entry))
        );
        setStatusMessage("Profile de personagem atualizado.");
      } else {
        const created = await createCharacterRequest(payload);
        setCharacters((current) => [created, ...current]);
        setSelectedCharacterId(created.id);
        setStatusMessage("Novo character profile criado.");
      }

      setSource("api");
    } catch {
      if (editingCharacterId) {
        setCharacters((current) =>
          current.map((entry) =>
            entry.id === editingCharacterId
              ? applyCharacterPayload(entry, payload, now)
              : entry
          )
        );
        setStatusMessage("API indisponivel. Profile atualizado so nesta sessao.");
      } else {
        const created: CharacterProfile = {
          id: createLocalId("character"),
          createdAt: now,
          updatedAt: now,
          references: [],
          name: payload.name,
          slug: payload.slug,
          franchise: payload.franchise,
          category: payload.category,
          description: payload.description,
          basePrompt: payload.basePrompt,
          negativePrompt: payload.negativePrompt,
          styleNotes: payload.styleNotes,
          defaultVisualStyle: payload.defaultVisualStyle,
          referenceStrength: payload.referenceStrength ?? 0.75,
          preferredProvider: payload.preferredProvider ?? "mock-svg",
          tags: payload.tags
        };
        setCharacters((current) => [created, ...current]);
        setSelectedCharacterId(created.id);
        setStatusMessage("API indisponivel. Character criado so nesta sessao.");
      }

      setSource("mock");
    }

    setCharacterForm(emptyCharacterForm);
    setEditingCharacterId(null);
  }

  async function handleReferenceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCharacter) {
      setStatusMessage("Selecione um character profile antes de adicionar referencias.");
      return;
    }

    const payload = toReferencePayload(referenceForm);
    const now = new Date().toISOString();

    try {
      if (editingReferenceId) {
        const updated = await updateCharacterReferenceRequest(
          selectedCharacter.id,
          editingReferenceId,
          payload
        );
        setCharacters((current) =>
          current.map((entry) =>
            entry.id === selectedCharacter.id
              ? {
                  ...entry,
                  references: entry.references.map((reference) =>
                    reference.id === editingReferenceId ? updated : reference
                  ),
                  updatedAt: updated.updatedAt
                }
              : entry
          )
        );
        setStatusMessage("Referencia atualizada.");
      } else {
        const created = await createCharacterReferenceRequest(selectedCharacter.id, payload);
        setCharacters((current) =>
          current.map((entry) =>
            entry.id === selectedCharacter.id
              ? {
                  ...entry,
                  references: [created, ...entry.references],
                  updatedAt: created.updatedAt
                }
              : entry
          )
        );
        setStatusMessage("Referencia adicionada ao character.");
      }

      setSource("api");
    } catch {
      const localAsset =
        referenceAssets.find((asset) => asset.id === payload.assetId) ?? null;

      if (editingReferenceId) {
        setCharacters((current) =>
          current.map((entry) =>
            entry.id === selectedCharacter.id
              ? {
                  ...entry,
                  updatedAt: now,
                  references: entry.references.map((reference) =>
                    reference.id === editingReferenceId
                      ? {
                          ...reference,
                          ...payload,
                          asset: localAsset,
                          strength: payload.strength ?? reference.strength,
                          updatedAt: now
                        }
                      : reference
                  )
                }
              : entry
          )
        );
      } else {
        const created: CharacterReference = {
          id: createLocalId("reference"),
          characterProfileId: selectedCharacter.id,
          assetId: payload.assetId,
          asset: localAsset,
          sourcePath: payload.sourcePath,
          title: payload.title,
          notes: payload.notes,
          referenceType: payload.referenceType,
          strength: payload.strength ?? 0.75,
          createdAt: now,
          updatedAt: now
        };

        setCharacters((current) =>
          current.map((entry) =>
            entry.id === selectedCharacter.id
              ? {
                  ...entry,
                  updatedAt: now,
                  references: [created, ...entry.references]
                }
              : entry
          )
        );
      }

      setSource("mock");
      setStatusMessage("API indisponivel. Referencia salva so nesta sessao.");
    }

    setReferenceForm(emptyReferenceForm);
    setEditingReferenceId(null);
  }

  function startEditingCharacter(profile: CharacterProfile) {
    setEditingCharacterId(profile.id);
    setSelectedCharacterId(profile.id);
    setCharacterForm(toCharacterForm(profile));
    setStatusMessage(`Editando ${profile.name}.`);
  }

  function startEditingReference(reference: CharacterReference) {
    setEditingReferenceId(reference.id);
    setReferenceForm(toReferenceForm(reference));
    setStatusMessage(`Editando referencia ${reference.title ?? reference.referenceType}.`);
  }

  async function handleDeleteCharacter(id: string) {
    try {
      await deleteCharacterRequest(id);
      setSource("api");
      setStatusMessage("Character removido da API local.");
    } catch {
      setSource("mock");
      setStatusMessage("API indisponivel. Character removido so desta sessao.");
    }

    setCharacters((current) => current.filter((entry) => entry.id !== id));

    if (selectedCharacterId === id) {
      setSelectedCharacterId((current) => {
        if (current !== id) {
          return current;
        }

        const next = orderedCharacters.find((entry) => entry.id !== id);
        return next?.id ?? null;
      });
    }

    if (editingCharacterId === id) {
      setEditingCharacterId(null);
      setCharacterForm(emptyCharacterForm);
    }
  }

  async function handleDeleteReference(referenceId: string) {
    if (!selectedCharacter) {
      return;
    }

    try {
      await deleteCharacterReferenceRequest(selectedCharacter.id, referenceId);
      setSource("api");
      setStatusMessage("Referencia removida.");
    } catch {
      setSource("mock");
      setStatusMessage("API indisponivel. Referencia removida so desta sessao.");
    }

    setCharacters((current) =>
      current.map((entry) =>
        entry.id === selectedCharacter.id
          ? {
              ...entry,
              references: entry.references.filter((reference) => reference.id !== referenceId),
              updatedAt: new Date().toISOString()
            }
          : entry
      )
    );
  }

  async function handleBuildPrompt() {
    if (!selectedCharacter) {
      return;
    }

    try {
      const updated = await buildCharacterBasePromptRequest(selectedCharacter.id);
      setCharacters((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setSelectedCharacterId(updated.id);
      setSource("api");
      setStatusMessage("Base prompt reconstruido a partir do profile e das referencias.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao reconstruir base prompt."
      );
    }
  }

  async function handleCreateFromIntake() {
    if (!intakeSlug.trim()) {
      setStatusMessage("Informe um slug para ler storage/inbox/characters/<slug>/references.");
      return;
    }

    try {
      const result = await createCharacterFromIntakeRequest(intakeSlug.trim());
      setCharacters((current) => {
        const remaining = current.filter((entry) => entry.id !== result.profile.id);
        return [result.profile, ...remaining];
      });
      setSelectedCharacterId(result.profile.id);
      setSource("api");
      setStatusMessage(
        result.warnings.length > 0
          ? result.warnings.join(" | ")
          : `${result.referencesCreated} referencia(s) vinculada(s) a partir do intake.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao criar profile via intake."
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-6">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Character Forge
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {editingCharacterId ? "Editar character profile" : "Novo character profile"}
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

          <form className="mt-6 space-y-4" onSubmit={handleCharacterSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Nome</span>
                <input
                  required
                  value={characterForm.name}
                  onChange={(event) =>
                    setCharacterForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Slug</span>
                <input
                  value={characterForm.slug}
                  onChange={(event) =>
                    setCharacterForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  placeholder="silent-archivist"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Franchise</span>
                <input
                  value={characterForm.franchise}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      franchise: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Categoria</span>
                <input
                  value={characterForm.category}
                  onChange={(event) =>
                    setCharacterForm((current) => ({ ...current, category: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Descricao</span>
              <textarea
                rows={3}
                value={characterForm.description}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Style notes</span>
              <textarea
                rows={3}
                value={characterForm.styleNotes}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    styleNotes: event.target.value
                  }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Visual style</span>
                <input
                  value={characterForm.defaultVisualStyle}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      defaultVisualStyle: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Tags</span>
                <input
                  value={characterForm.tags}
                  onChange={(event) =>
                    setCharacterForm((current) => ({ ...current, tags: event.target.value }))
                  }
                  placeholder="scar, coat, archive, silver-hair"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Base prompt</span>
              <textarea
                rows={4}
                value={characterForm.basePrompt}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    basePrompt: event.target.value
                  }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Negative prompt</span>
              <textarea
                rows={3}
                value={characterForm.negativePrompt}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    negativePrompt: event.target.value
                  }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Reference strength</span>
                <input
                  value={characterForm.referenceStrength}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      referenceStrength: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Provider preferido</span>
                <input
                  value={characterForm.preferredProvider}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      preferredProvider: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
              >
                {editingCharacterId ? "Salvar character" : "Criar character"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCharacterId(null);
                  setCharacterForm(emptyCharacterForm);
                }}
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-mist/80"
              >
                Limpar form
              </button>
            </div>
          </form>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Intake Bridge
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Criar profile a partir de `storage/inbox/characters`
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <input
              value={intakeSlug}
              onChange={(event) => setIntakeSlug(event.target.value)}
              placeholder="silent-archivist"
              className="min-w-[16rem] flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/50"
            />
            <button
              type="button"
              onClick={() => {
                void handleCreateFromIntake();
              }}
              className="rounded-full border border-signal/25 bg-signal/10 px-5 py-3 text-sm font-medium text-signal"
            >
              Ler intake
            </button>
          </div>
          <p className="mt-3 text-sm leading-7 text-mist/68">
            Esse fluxo procura referencias importadas e candidatos em
            `storage/inbox/characters/&lt;slug&gt;/references`.
          </p>
        </article>
      </section>

      <section className="space-y-6">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Character Library
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {orderedCharacters.length} profiles
              </h2>
            </div>
            {selectedCharacter ? (
              <button
                type="button"
                onClick={() => {
                  void handleBuildPrompt();
                }}
                className="rounded-full border border-signal/25 bg-signal/10 px-4 py-2 text-xs text-signal"
              >
                Rebuild base prompt
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4">
            {orderedCharacters.map((profile) => (
              <article
                key={profile.id}
                className={`rounded-[1.5rem] border p-5 transition ${
                  selectedCharacterId === profile.id
                    ? "border-signal/35 bg-signal/8"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedCharacterId(profile.id)}
                    className="text-left"
                  >
                    <h3 className="text-xl font-semibold text-white">{profile.name}</h3>
                    <p className="mt-2 text-sm text-mist/68">{profile.slug}</p>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingCharacter(profile)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteCharacter(profile.id);
                      }}
                      className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-100"
                    >
                      Deletar
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <span
                      key={`${profile.id}-${tag}`}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/68"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-7 text-mist/68">
                  {profile.description ?? "Sem descricao editorial ainda."}
                </p>

                <p className="mt-4 text-xs text-mist/45">
                  {profile.references.length} referencia(s) • atualizado em {formatDate(profile.updatedAt)}
                </p>
              </article>
            ))}
          </div>
        </article>

        {selectedCharacter ? (
          <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Reference Desk
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {selectedCharacter.name}
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
                {selectedCharacter.references.length} refs ativas
              </div>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Prompt atual
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/70">
                {selectedCharacter.basePrompt ?? "Base prompt ainda nao montado."}
              </p>
            </div>

            {selectedCharacterWorkflowPack ? (
              <div className="mt-4 rounded-[1.4rem] border border-[#92a7ff]/20 bg-[#92a7ff]/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Suggested workflow pack
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {selectedCharacterWorkflowPack.name} - {selectedCharacterWorkflowPack.id}
                </p>
                <p className="mt-3 text-sm leading-7 text-mist/70">
                  {selectedCharacterWorkflowPack.styleNotes}
                </p>
                <p className="mt-3 text-xs text-mist/55">
                  workflow {selectedCharacterWorkflowPack.recommendedWorkflowId} /
                  prompt {selectedCharacterWorkflowPack.recommendedPromptPackId}
                </p>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleReferenceSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Asset da biblioteca</span>
                  <select
                    value={referenceForm.assetId}
                    onChange={(event) =>
                      setReferenceForm((current) => ({
                        ...current,
                        assetId: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  >
                    <option value="">Sem asset vinculado</option>
                    {referenceAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.filename} • {asset.category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Tipo</span>
                  <select
                    value={referenceForm.referenceType}
                    onChange={(event) =>
                      setReferenceForm((current) => ({
                        ...current,
                        referenceType: event.target.value as CharacterReferenceType
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  >
                    {characterReferenceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Source path</span>
                  <input
                    value={referenceForm.sourcePath}
                    onChange={(event) =>
                      setReferenceForm((current) => ({
                        ...current,
                        sourcePath: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Strength</span>
                  <input
                    value={referenceForm.strength}
                    onChange={(event) =>
                      setReferenceForm((current) => ({
                        ...current,
                        strength: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Titulo</span>
                <input
                  value={referenceForm.title}
                  onChange={(event) =>
                    setReferenceForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Notas</span>
                <textarea
                  rows={3}
                  value={referenceForm.notes}
                  onChange={(event) =>
                    setReferenceForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
                >
                  {editingReferenceId ? "Salvar referencia" : "Adicionar referencia"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingReferenceId(null);
                    setReferenceForm(emptyReferenceForm);
                  }}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-mist/80"
                >
                  Limpar referencia
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              {selectedCharacter.references.map((reference) => (
                <article
                  key={reference.id}
                  className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {reference.title ?? reference.referenceType}
                      </p>
                      <p className="mt-2 text-xs text-mist/55">
                        {reference.referenceType} • strength {reference.strength}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingReference(reference)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteReference(reference.id);
                        }}
                        className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-xs text-red-100"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-mist/68">
                    {reference.notes ?? reference.sourcePath ?? "Sem notas adicionais."}
                  </p>

                  {reference.asset ? (
                    <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/30">
                      <AssetMediaPreview asset={reference.asset} source={source} />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
