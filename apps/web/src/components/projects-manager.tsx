"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createProjectRequest,
  deleteProjectRequest,
  updateProjectRequest
} from "../lib/studio-api";
import type {
  DataSource,
  ProjectPayload,
  ProjectStatus,
  StudioChannel,
  StudioProject
} from "../lib/studio-types";
import { projectStatuses } from "../lib/studio-types";

interface ProjectsManagerProps {
  initialChannels: StudioChannel[];
  initialChannelSource: DataSource;
  initialProjects: StudioProject[];
  initialProjectSource: DataSource;
}

interface ProjectFormState {
  title: string;
  status: ProjectStatus;
  channelId: string;
  script: string;
  durationTarget: string;
  format: string;
}

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

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function formatDuration(value: number | null) {
  if (!value || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
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

function createEmptyForm(channels: StudioChannel[]): ProjectFormState {
  return {
    title: "",
    status: "DRAFT",
    channelId: channels[0]?.id ?? "",
    script: "",
    durationTarget: "30",
    format: "9:16"
  };
}

function toFormState(project: StudioProject): ProjectFormState {
  return {
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    script: project.script ?? "",
    durationTarget: project.durationTarget?.toString() ?? "",
    format: project.format
  };
}

function buildProjectPayload(form: ProjectFormState): ProjectPayload {
  return {
    title: form.title.trim(),
    status: form.status,
    channelId: form.channelId,
    script: toNullableString(form.script),
    durationTarget: toNullableNumber(form.durationTarget),
    format: form.format.trim() || "9:16",
    templateId: null,
    defaultCaptionStyle: null
  };
}

function sortProjects(projects: StudioProject[]) {
  return [...projects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function countScenes(project: StudioProject) {
  return project.scenes.length;
}

function totalProjectDuration(project: StudioProject) {
  return project.scenes.reduce(
    (total, scene) => total + (scene.duration ?? 0),
    0
  );
}

function replaceProject(
  projects: StudioProject[],
  nextProject: StudioProject
) {
  return sortProjects(
    projects.map((project) =>
      project.id === nextProject.id ? nextProject : project
    )
  );
}

function createLocalProject(
  payload: ProjectPayload,
  channels: StudioChannel[]
): StudioProject | null {
  const channel = channels.find((entry) => entry.id === payload.channelId);

  if (!channel) {
    return null;
  }

  const timestamp = new Date().toISOString();

  return {
    id: createLocalId("project"),
    createdAt: timestamp,
    updatedAt: timestamp,
    scenes: [],
    channel,
    ...payload
  };
}

function applyProjectPayload(
  project: StudioProject,
  payload: ProjectPayload,
  channels: StudioChannel[]
) {
  const channel =
    channels.find((entry) => entry.id === payload.channelId) ?? project.channel;

  return {
    ...project,
    ...payload,
    channel,
    updatedAt: new Date().toISOString()
  };
}

export function ProjectsManager({
  initialChannels,
  initialChannelSource,
  initialProjects,
  initialProjectSource
}: ProjectsManagerProps) {
  const [projects, setProjects] = useState(sortProjects(initialProjects));
  const [projectSource, setProjectSource] =
    useState<DataSource>(initialProjectSource);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localOnlyProjectIds, setLocalOnlyProjectIds] = useState<string[]>([]);
  const [form, setForm] = useState<ProjectFormState>(
    createEmptyForm(initialChannels)
  );
  const [statusMessage, setStatusMessage] = useState(
    initialProjectSource === "api"
      ? "Projetos conectados a API local."
      : "Projetos em modo mock ate a API ficar disponivel."
  );

  const projectCount = projects.length;
  const totalScenes = projects.reduce(
    (total, project) => total + project.scenes.length,
    0
  );
  const readyForEdit = projects.filter(
    (project) => project.status === "READY_FOR_EDIT"
  ).length;

  function startEditing(project: StudioProject) {
    setEditingId(project.id);
    setForm(toFormState(project));
    setStatusMessage(`Editando ${project.title}.`);
  }

  function resetEditor() {
    setEditingId(null);
    setForm(createEmptyForm(initialChannels));
  }

  function cancelEditing() {
    resetEditor();
    setStatusMessage(
      projectSource === "api"
        ? "Projetos conectados a API local."
        : "Projetos em modo mock ate a API ficar disponivel."
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildProjectPayload(form);

    if (!payload.channelId) {
      setStatusMessage("Selecione um canal antes de salvar o projeto.");
      return;
    }

    try {
      if (editingId) {
        const updated = await updateProjectRequest(editingId, payload);
        setProjects((current) => replaceProject(current, updated));
        setStatusMessage("Projeto atualizado na API local.");
      } else {
        const created = await createProjectRequest(payload);
        setProjects((current) => sortProjects([created, ...current]));
        setStatusMessage("Projeto criado na API local.");
      }

      setProjectSource("api");
      setLocalOnlyProjectIds((current) =>
        editingId ? current.filter((id) => id !== editingId) : current
      );
      resetEditor();
      return;
    } catch (error) {
      if (editingId) {
        setProjects((current) =>
          current.map((project) =>
            project.id === editingId
              ? applyProjectPayload(project, payload, initialChannels)
              : project
          )
        );
        setStatusMessage(
          `${extractErrorMessage(error)} Projeto atualizado apenas nesta sessao.`
        );
      } else {
        const localProject = createLocalProject(payload, initialChannels);

        if (!localProject) {
          setStatusMessage("Canal invalido para criacao local do projeto.");
          return;
        }

        setProjects((current) => sortProjects([localProject, ...current]));
        setLocalOnlyProjectIds((current) => [...current, localProject.id]);
        setStatusMessage(
          `${extractErrorMessage(error)} Projeto criado apenas nesta sessao.`
        );
      }

      setProjectSource("mock");
      resetEditor();
    }
  }

  async function handleDelete(project: StudioProject) {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Remover o projeto "${project.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteProjectRequest(project.id);
      setProjects((current) =>
        current.filter((entry) => entry.id !== project.id)
      );
      setProjectSource("api");
      setStatusMessage("Projeto removido da API local.");
    } catch (error) {
      setProjects((current) =>
        current.filter((entry) => entry.id !== project.id)
      );
      setProjectSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Projeto removido apenas desta sessao.`
      );
    }

    setLocalOnlyProjectIds((current) =>
      current.filter((id) => id !== project.id)
    );

    if (editingId === project.id) {
      resetEditor();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Project Rack
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {projectCount} projetos em circulacao
            </h2>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs ${
              projectSource === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {projectSource === "api" ? "API live" : "Mock mode"}
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {statusMessage}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Cenas totais
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {totalScenes}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Ready for edit
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {readyForEdit}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Canais ativos
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {initialChannels.length}
            </p>
            <p className="mt-2 text-xs text-mist/50">
              {initialChannelSource === "api"
                ? "channel list live"
                : "channel list mock"}
            </p>
          </div>
        </div>

        {localOnlyProjectIds.length > 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Projetos criados em fallback local ficam disponiveis apenas nesta
            sessao e nao abrem a pagina de timeline ate a API local voltar.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {projects.map((project) => {
            const localOnly = localOnlyProjectIds.includes(project.id);

            return (
              <article
                key={project.id}
                className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-signal">
                        {formatStatusLabel(project.status)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        {project.channel.name}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        {project.format}
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      {project.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-mist/68">
                      {project.script ?? "Roteiro ainda nao definido."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {localOnly ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                        Sessao local
                      </span>
                    ) : (
                      <Link
                        href={`/projects/${project.id}`}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78 transition hover:border-signal/35 hover:text-white"
                      >
                        Abrir timeline
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditing(project)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(project)}
                      className="rounded-full border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-4 py-2 text-sm text-[#ffd4d4]"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Cenas
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {countScenes(project)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Duracao atual
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatDuration(totalProjectDuration(project))}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Alvo
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatDuration(project.durationTarget)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Atualizado
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(project.updatedAt)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Project Setup
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {editingId ? "Editar projeto" : "Criar novo projeto"}
            </h2>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          Defina o canal, o status editorial, o roteiro base e o formato antes
          de entrar na timeline.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Titulo</span>
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Canal</span>
              <select
                required
                value={form.channelId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channelId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {initialChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ProjectStatus
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Script base</span>
            <textarea
              rows={6}
              value={form.script}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  script: event.target.value
                }))
              }
              className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Duracao alvo (s)
              </span>
              <input
                value={form.durationTarget}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    durationTarget: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Formato</span>
              <input
                required
                value={form.format}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    format: event.target.value
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
            {editingId ? "Salvar projeto" : "Criar projeto"}
          </button>
        </form>
      </section>
    </div>
  );
}

