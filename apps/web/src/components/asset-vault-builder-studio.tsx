"use client";

import { useEffect, useState, useTransition } from "react";
import {
  analyzeAssetVaultGapsRequest,
  confirmDiscoveryCandidateUseRequest,
  createAssetVaultRequest,
  createAssetVaultSearchMissionRequest,
  getAssetVaultCandidatesRequest,
  getAssetVaultMissionsRequest,
  getProductionDiscoverySourcePacks,
  importDiscoveryCandidateRequest,
  listAssetVaultsRequest,
  rejectDiscoveryCandidateRequest,
  runSearchMissionRequest
} from "../lib/studio-api";
import type {
  AssetVaultGapAnalysis,
  AssetVaultRecord,
  ProductionDiscoverySourcePack,
  SearchMissionRecord
} from "../lib/production-discovery-types";
import type { MediaCandidate } from "../lib/studio-types";

function parseUsageNotes(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function AssetVaultBuilderStudio() {
  const [vaults, setVaults] = useState<AssetVaultRecord[]>([]);
  const [sourcePacks, setSourcePacks] = useState<ProductionDiscoverySourcePack[]>([]);
  const [activeVault, setActiveVault] = useState<AssetVaultRecord | null>(null);
  const [missions, setMissions] = useState<SearchMissionRecord[]>([]);
  const [candidates, setCandidates] = useState<MediaCandidate[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<AssetVaultGapAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "Football Impact Vault",
    niche: "football",
    sourcePackId: "football_source_pack",
    targetAssetTypes: "image,video,sfx",
    tags: "football,impact,editorial"
  });
  const [missionForm, setMissionForm] = useState({
    topic: "football stadium night impact moments",
    targetCount: 6
  });

  async function refresh(nextVaultId?: string) {
    const [vaultItems, packItems] = await Promise.all([
      listAssetVaultsRequest(),
      getProductionDiscoverySourcePacks()
    ]);
    setVaults(vaultItems);
    setSourcePacks(packItems);
    const nextVault =
      vaultItems.find((vault) => vault.id === nextVaultId) ??
      (nextVaultId ? null : activeVault ?? vaultItems[0] ?? null);
    setActiveVault(nextVault);
    if (nextVault) {
      const [missionItems, candidateItems] = await Promise.all([
        getAssetVaultMissionsRequest(nextVault.id),
        getAssetVaultCandidatesRequest(nextVault.id)
      ]);
      setMissions(missionItems);
      setCandidates(candidateItems);
    }
  }

  useEffect(() => {
    refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createVault() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createAssetVaultRequest({
          name: form.name,
          niche: form.niche,
          sourcePackId: form.sourcePackId,
          targetAssetTypes: form.targetAssetTypes.split(",").map((item) => item.trim()),
          tags: form.tags.split(",").map((item) => item.trim())
        });
        await refresh(created.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function createMission() {
    if (!activeVault) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createAssetVaultSearchMissionRequest(activeVault.id, {
          topic: missionForm.topic,
          sourcePackId: activeVault.sourcePackId,
          targetCount: missionForm.targetCount
        });
        await refresh(activeVault.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function runMission(missionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await runSearchMissionRequest(missionId);
        if (activeVault) {
          await refresh(activeVault.id);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function analyzeGaps() {
    if (!activeVault) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        setGapAnalysis(await analyzeAssetVaultGapsRequest(activeVault.id));
        await refresh(activeVault.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function candidateAction(
    action: "confirm" | "reject" | "import",
    candidateId: string
  ) {
    setError(null);
    startTransition(async () => {
      try {
        if (action === "confirm") {
          await confirmDiscoveryCandidateUseRequest(candidateId);
        } else if (action === "reject") {
          await rejectDiscoveryCandidateRequest(candidateId);
        } else {
          await importDiscoveryCandidateRequest(candidateId);
        }
        if (activeVault) {
          await refresh(activeVault.id);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.14),transparent_34%),rgba(255,255,255,0.04)] p-6 shadow-studio">
        <p className="text-xs uppercase tracking-[0.32em] text-mist/55">
          Candidate-first asset vault
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          Asset Vault Builder
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-mist/70">
          Construa acervos por nicho com Search Missions, scoring, deduplicacao
          leve e revisao manual. Nada e baixado ou importado automaticamente.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
          <h2 className="text-xl font-semibold text-white">Criar vault</h2>
          <div className="mt-4 grid gap-3">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white" />
            <input value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white" />
            <select value={form.sourcePackId} onChange={(event) => setForm({ ...form, sourcePackId: event.target.value })} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white">
              {sourcePacks.map((pack) => (
                <option key={pack.id} value={pack.id}>{pack.name}</option>
              ))}
            </select>
            <input value={form.targetAssetTypes} onChange={(event) => setForm({ ...form, targetAssetTypes: event.target.value })} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white" />
            <button type="button" onClick={createVault} disabled={isPending} className="rounded-2xl bg-signal px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
              Criar vault
            </button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
          <h2 className="text-xl font-semibold text-white">Vaults</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {vaults.map((vault) => (
              <button key={vault.id} type="button" onClick={() => refresh(vault.id)} className={`rounded-2xl border p-4 text-left ${activeVault?.id === vault.id ? "border-signal/40 bg-signal/10" : "border-white/10 bg-white/[0.04]"}`}>
                <p className="text-sm font-semibold text-white">{vault.name}</p>
                <p className="mt-1 text-xs text-mist/55">{vault.niche} / {vault.status}</p>
                <p className="mt-2 text-xs text-mist/60">
                  candidates {vault.candidateCount} / approved {vault.approvedCount} / imported {vault.importedCount}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeVault ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-white">Search Missions</h2>
            <input value={missionForm.topic} onChange={(event) => setMissionForm({ ...missionForm, topic: event.target.value })} className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white" />
            <button type="button" onClick={createMission} disabled={isPending} className="mt-3 rounded-2xl border border-signal/30 px-4 py-3 text-sm text-signal disabled:opacity-50">
              Criar Search Mission
            </button>
            <div className="mt-4 space-y-3">
              {missions.map((mission) => (
                <div key={mission.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">{mission.topic}</p>
                  <p className="mt-1 text-xs text-mist/55">{mission.status} / candidates {mission.candidateCount}</p>
                  <button type="button" onClick={() => runMission(mission.id)} disabled={isPending} className="mt-3 rounded-full bg-white/10 px-3 py-2 text-xs text-white disabled:opacity-50">
                    Rodar mission
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Gap Analysis</h2>
              <button type="button" onClick={analyzeGaps} disabled={isPending} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50">
                Analisar lacunas
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {(gapAnalysis?.missingByMediaType ?? []).map((gap) => (
                <div key={gap.mediaType} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">{gap.mediaType}</p>
                  <p className="mt-1 text-xs text-mist/60">{gap.reason}</p>
                </div>
              ))}
              {!gapAnalysis ? <p className="text-sm text-mist/60">Rode a analise para ver faltas por tipo de asset.</p> : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-white">Candidates</h2>
            <div className="mt-4 space-y-3">
              {candidates.map((candidate) => {
                const notes = parseUsageNotes(candidate.usageNotes);
                return (
                  <div key={candidate.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-white">{candidate.title}</p>
                    <p className="mt-1 text-xs text-mist/55">{candidate.provider} / {candidate.status} / {candidate.sourceLicense ?? "unknown"}</p>
                    <p className="mt-2 text-xs text-mist/60">score {String(notes.overallScore ?? "n/d")} / duplicate {notes.duplicateWarning ? "yes" : "no"}</p>
                    <p className="mt-2 text-xs text-amber-100">{candidate.recommendedUse}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.sourceUrl ? <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">Abrir fonte</a> : null}
                      <button type="button" onClick={() => candidateAction("confirm", candidate.id)} className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-100">Confirmar</button>
                      <button type="button" onClick={() => candidateAction("import", candidate.id)} className="rounded-full border border-signal/30 px-3 py-1 text-xs text-signal">Importar</button>
                      <button type="button" onClick={() => candidateAction("reject", candidate.id)} className="rounded-full border border-red-400/30 px-3 py-1 text-xs text-red-100">Rejeitar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
