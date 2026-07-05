"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  buildProductionDiscoveryRequirementsRequest,
  createProductionDiscoveryPackageRequest,
  createProductionDiscoveryProjectRequest,
  getProductionDiscoveryMediaCandidates,
  getProductionDiscoveryNiches,
  listProductionDiscoveryPackages,
  runProductionDiscoveryResearchRequest,
  searchProductionDiscoveryCandidatesRequest
} from "../lib/studio-api";
import type {
  ProductionDiscoveryNicheProfile,
  ProductionDiscoveryPackage
} from "../lib/production-discovery-types";
import type { MediaCandidate } from "../lib/studio-types";

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function packageStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function ProductionDiscoveryStudio() {
  const [niches, setNiches] = useState<ProductionDiscoveryNicheProfile[]>([]);
  const [packages, setPackages] = useState<ProductionDiscoveryPackage[]>([]);
  const [activePackage, setActivePackage] = useState<ProductionDiscoveryPackage | null>(null);
  const [candidates, setCandidates] = useState<MediaCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    topic: "Haaland contra o Brasil",
    niche: "football",
    angle: "por que ele pode ser o maior perigo",
    language: "pt-BR",
    tone: "hype",
    targetDurationSeconds: 35
  });

  async function refreshPackages(nextActiveId?: string) {
    const items = await listProductionDiscoveryPackages();
    setPackages(items);
    const nextActive =
      items.find((item) => item.id === nextActiveId) ??
      (nextActiveId ? null : items[0] ?? null);
    if (nextActive) {
      setActivePackage(nextActive);
      setCandidates(
        nextActive.mediaCollectionIds.length > 0
          ? await getProductionDiscoveryMediaCandidates(nextActive.id)
          : []
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getProductionDiscoveryNiches(),
      listProductionDiscoveryPackages()
    ])
      .then(async ([nicheItems, packageItems]) => {
        if (cancelled) {
          return;
        }
        setNiches(nicheItems);
        setPackages(packageItems);
        const first = packageItems[0] ?? null;
        setActivePackage(first);
        if (first && first.mediaCollectionIds.length > 0) {
          setCandidates(await getProductionDiscoveryMediaCandidates(first.id));
        }
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));

    return () => {
      cancelled = true;
    };
  }, []);

  function runStep(
    action: (packageId: string) => Promise<ProductionDiscoveryPackage>
  ) {
    if (!activePackage) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const updated = await action(activePackage.id);
        setActivePackage(updated);
        await refreshPackages(updated.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function createPackage() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createProductionDiscoveryPackageRequest(form);
        setActivePackage(created);
        setCandidates([]);
        await refreshPackages(created.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  const activeNiche = niches.find((niche) => niche.id === form.niche);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,224,255,0.18),transparent_32%),rgba(255,255,255,0.04)] p-6 shadow-studio">
        <p className="text-xs uppercase tracking-[0.32em] text-mist/55">
          Candidate-first discovery
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          Production Discovery
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-mist/70">
          Crie um pacote por nicho, gere dossie local, requisitos visuais e
          candidatos de midia. Nada e baixado ou importado automaticamente.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
          <h2 className="text-xl font-semibold text-white">Novo pacote</h2>
          <div className="mt-5 grid gap-3">
            <label className="text-sm text-mist/70">
              Tema
              <input
                value={form.topic}
                onChange={(event) => setForm({ ...form, topic: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
              />
            </label>
            <label className="text-sm text-mist/70">
              Nicho
              <select
                value={form.niche}
                onChange={(event) => setForm({ ...form, niche: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
              >
                {niches.map((niche) => (
                  <option key={niche.id} value={niche.id}>
                    {niche.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-mist/70">
              Angulo
              <input
                value={form.angle}
                onChange={(event) => setForm({ ...form, angle: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-mist/70">
                Tom
                <input
                  value={form.tone}
                  onChange={(event) => setForm({ ...form, tone: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
                />
              </label>
              <label className="text-sm text-mist/70">
                Idioma
                <input
                  value={form.language}
                  onChange={(event) => setForm({ ...form, language: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
                />
              </label>
              <label className="text-sm text-mist/70">
                Duracao
                <input
                  type="number"
                  value={form.targetDurationSeconds}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      targetDurationSeconds: Number(event.target.value) || 35
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={createPackage}
              disabled={isPending}
              className="rounded-2xl bg-signal px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              Criar pacote
            </button>
          </div>

          {activeNiche ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-mist/45">
                Perfil do nicho
              </p>
              <p className="mt-2 text-sm text-mist/75">{activeNiche.description}</p>
              <p className="mt-3 text-xs text-mist/55">
                Music {activeNiche.recommendedMusicPresetId} / Workflow{" "}
                {activeNiche.recommendedWorkflowPackId}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Pacote ativo</h2>
            <select
              value={activePackage?.id ?? ""}
              onChange={async (event) => {
                const item = packages.find((entry) => entry.id === event.target.value) ?? null;
                setActivePackage(item);
                setCandidates(item ? await getProductionDiscoveryMediaCandidates(item.id) : []);
              }}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white"
            >
              <option value="">Selecionar pacote</option>
              {packages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          {activePackage ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-mist/45">
                  {activePackage.niche} / {packageStatusLabel(activePackage.status)}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {activePackage.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-mist/70">
                  {activePackage.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/65">
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    template {activePackage.suggestedTemplateId ?? "n/a"}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    music {activePackage.suggestedMusicPresetId ?? "n/a"}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    candidates {candidates.length}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runStep(runProductionDiscoveryResearchRequest)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white disabled:opacity-50"
                >
                  Rodar pesquisa
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runStep(buildProductionDiscoveryRequirementsRequest)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white disabled:opacity-50"
                >
                  Criar requisitos
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runStep(searchProductionDiscoveryCandidatesRequest)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white disabled:opacity-50"
                >
                  Buscar candidatos
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runStep(createProductionDiscoveryProjectRequest)}
                  className="rounded-2xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal disabled:opacity-50"
                >
                  Criar projeto
                </button>
              </div>

              {activePackage.createdProjectId ? (
                <Link
                  href={`/projects/${activePackage.createdProjectId}`}
                  className="inline-flex rounded-full border border-signal/30 px-4 py-2 text-sm text-signal"
                >
                  Abrir projeto criado
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-mist/65">Nenhum pacote criado ainda.</p>
          )}
        </div>
      </section>

      {activePackage ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-white">Outline</h2>
            <div className="mt-4 space-y-3">
              {activePackage.outline.map((scene, index) => (
                <div key={`${readString(scene.title)}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                    cena {String(scene.order ?? index + 1)} / {readString(scene.role)}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {readString(scene.title)}
                  </p>
                  <p className="mt-2 text-sm text-mist/65">
                    {readString(scene.narrationDraft)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-white">Visual requirements</h2>
            <div className="mt-4 space-y-3">
              {activePackage.assetRequirements.map((requirement, index) => (
                <div key={`${readString(requirement.id)}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                    {readString(requirement.mediaType)} / {readString(requirement.importance)}
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {readString(requirement.visualNeedDescription)}
                  </p>
                  <p className="mt-2 text-xs text-mist/55">
                    fallback {readString(requirement.fallbackStrategy)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-white">Media candidates</h2>
            <p className="mt-2 text-sm text-mist/65">
              Candidatos ficam pendentes. Confirme/importe manualmente no Media
              Collector ou Intake.
            </p>
            <div className="mt-4 space-y-3">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                    {candidate.provider} / {candidate.status}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {candidate.title}
                  </p>
                  <p className="mt-2 text-xs text-mist/55">
                    license {candidate.sourceLicense ?? "unknown"} / risk{" "}
                    {candidate.copyrightRisk ?? "UNKNOWN"}
                  </p>
                  <p className="mt-2 text-xs text-amber-200">
                    requiresUserReview=true
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
