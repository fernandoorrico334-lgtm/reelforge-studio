import { ResearchDossiersManager } from "../../components/research-dossiers-manager";
import {
  getChannelsSnapshot,
  getResearchDossiersSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function ResearchPage() {
  const [dossiersSnapshot, channelsSnapshot] = await Promise.all([
    getResearchDossiersSnapshot(),
    getChannelsSnapshot()
  ]);
  const readyForReview = dossiersSnapshot.items.filter(
    (dossier) => dossier.status === "ready_for_review"
  ).length;
  const totalFacts = dossiersSnapshot.items.reduce(
    (total, dossier) => total + dossier.factCount,
    0
  );
  const totalSources = dossiersSnapshot.items.reduce(
    (total, dossier) => total + dossier.sourceCount,
    0
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(146,167,255,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,255,225,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Research Collector
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Dossies, fontes, fatos e outline para shorts documentais
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Organize pesquisa local com fontes publicas e entradas manuais, separe
              fatos confirmados de pontos incertos, monte timeline, hooks e transforme
              o dossie em projeto editavel sem usar scraping agressivo nem IA externa.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Dossies
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {dossiersSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Sources
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalSources}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Facts
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalFacts}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Review
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {readyForReview}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Fonte dos dossies: {formatSourceLabel(dossiersSnapshot.source)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Canais: {formatSourceLabel(channelsSnapshot.source)}
          </span>
        </div>
      </section>

      <ResearchDossiersManager
        initialChannels={channelsSnapshot.items}
        initialDossiers={dossiersSnapshot.items}
        initialSource={dossiersSnapshot.source}
      />
    </div>
  );
}

