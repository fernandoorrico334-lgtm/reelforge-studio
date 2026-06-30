import { MediaCollectorStudio } from "../../components/media-collector-studio";
import {
  getChannelsSnapshot,
  getMediaCollectionCandidatesSnapshot,
  getMediaCollectionsSnapshot,
  getMediaCollectorProvidersSnapshot,
  getResearchDossiersSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

interface MediaCollectorPageProps {
  searchParams?: Promise<{
    collectionId?: string | string[];
  }>;
}

export default async function MediaCollectorPage({
  searchParams
}: MediaCollectorPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedCollectionId = Array.isArray(resolvedSearchParams.collectionId)
    ? resolvedSearchParams.collectionId[0] ?? null
    : resolvedSearchParams.collectionId ?? null;

  const [providersSnapshot, collectionsSnapshot, channelsSnapshot, dossiersSnapshot] =
    await Promise.all([
      getMediaCollectorProvidersSnapshot(),
      getMediaCollectionsSnapshot(),
      getChannelsSnapshot(),
      getResearchDossiersSnapshot()
    ]);

  const initialCollectionId =
    requestedCollectionId ??
    collectionsSnapshot.items[0]?.id ??
    null;
  const candidatesSnapshot = initialCollectionId
    ? await getMediaCollectionCandidatesSnapshot(initialCollectionId)
    : { items: [], source: "mock" as const };
  const source =
    providersSnapshot.source === "api" ||
    collectionsSnapshot.source === "api" ||
    candidatesSnapshot.source === "api"
      ? "api"
      : "mock";

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,224,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,207,112,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Media Collector
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Providers autorizados, review queue e importacao aprovada
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Busque midias publicas, organize candidatos por colecao, revise
              licenca e metadata antes de importar para `storage/assets`.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Providers
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {providersSnapshot.items.length}
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
                Candidatos
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {candidatesSnapshot.items.length}
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

      <MediaCollectorStudio
        channels={channelsSnapshot.items}
        dossiers={dossiersSnapshot.items}
        initialProviders={providersSnapshot.items}
        initialCollections={collectionsSnapshot.items}
        initialCandidates={candidatesSnapshot.items}
        initialCollectionId={initialCollectionId}
        initialSource={source}
      />
    </div>
  );
}