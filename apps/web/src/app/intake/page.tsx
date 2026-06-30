import { IntakeManager } from "../../components/intake-manager";
import {
  getIntakeCandidatesSnapshot,
  getIntakeCollectionsSnapshot,
  getIntakeFoldersSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function IntakePage() {
  const [foldersSnapshot, collectionsSnapshot, candidatesSnapshot] =
    await Promise.all([
      getIntakeFoldersSnapshot(),
      getIntakeCollectionsSnapshot(),
      getIntakeCandidatesSnapshot()
    ]);

  const source =
    candidatesSnapshot.source === "api" || collectionsSnapshot.source === "api"
      ? "api"
      : foldersSnapshot.source;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,255,225,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Manual Intake
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Escaneie o inbox local, revise candidatos e importe em lote
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Coloque materiais em `storage/inbox`, rode o scan pela UI ou CLI,
              refine metadata e importe somente o que ja estiver aprovado para
              a biblioteca oficial de assets.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Pastas
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {foldersSnapshot.item.folders.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Collections
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {collectionsSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <IntakeManager
        initialFolders={foldersSnapshot.item}
        initialCollections={collectionsSnapshot.items}
        initialCandidates={candidatesSnapshot.items}
        initialSource={source}
      />
    </div>
  );
}

