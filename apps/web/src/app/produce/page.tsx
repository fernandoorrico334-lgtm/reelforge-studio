import { ProductionFlowStudio } from "../../components/production-flow-studio";
import { getAssetsSnapshot, getChannelsSnapshot } from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Preview local";
}

export default async function ProducePage() {
  const [channelsSnapshot, assetsSnapshot] = await Promise.all([
    getChannelsSnapshot(),
    getAssetsSnapshot()
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,207,112,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Production Desk
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Roteiro bruto para projeto com cenas
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              A Etapa 10A transforma um script em projeto, timeline inicial,
              presets sugeridos, defaults de canal e primeiros palpites de
              assets, tudo com regras locais e deterministicas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Canais
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {channelsSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Assets
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {assetsSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(channelsSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ProductionFlowStudio
        assets={assetsSnapshot.items}
        channels={channelsSnapshot.items}
        initialSource={channelsSnapshot.source}
      />
    </div>
  );
}