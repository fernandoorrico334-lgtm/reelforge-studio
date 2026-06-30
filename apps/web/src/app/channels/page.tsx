import { ChannelsManager } from "../../components/channels-manager";
import {
  getAssetsSnapshot,
  getChannelsSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function ChannelsPage() {
  const [snapshot, assetsSnapshot] = await Promise.all([
    getChannelsSnapshot(),
    getAssetsSnapshot()
  ]);
  const templates = new Set(
    snapshot.items.flatMap((channel) =>
      channel.defaultTemplate ? [channel.defaultTemplate] : []
    )
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(99,255,225,0.14),transparent_32%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Channel Control
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Direcao editorial dos canais
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Gerencie nicho, idioma, estilo visual, tom narrativo e template
              padrao de cada canal sem depender de servicos externos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Canais
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {snapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Templates
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {templates.size}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(snapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ChannelsManager
        initialAssets={assetsSnapshot.items}
        initialChannels={snapshot.items}
        initialSource={snapshot.source}
      />
    </div>
  );
}
