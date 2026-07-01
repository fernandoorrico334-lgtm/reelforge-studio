import { AssetsManager } from "../../components/assets-manager";
import {
  getAssetsSnapshot,
  getGeneratedImagesGallerySnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function AssetsPage() {
  const [snapshot, generatedImagesSnapshot] = await Promise.all([
    getAssetsSnapshot(),
    getGeneratedImagesGallerySnapshot()
  ]);
  const assetTypes = new Set(snapshot.items.map((asset) => asset.type));
  const localOrigins = new Set(
    snapshot.items.map((asset) => asset.path.split("/")[1] ?? asset.path)
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,158,102,0.16),transparent_30%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Local Library
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Biblioteca de assets com metadata pronta para intake real
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Cadastre caminhos locais, classifique risco, emocao, categoria e
              uso recomendado. O upload binario entra na proxima etapa sem
              quebrar esta base.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Assets
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {snapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Tipos
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {assetTypes.size}
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

        <div className="mt-6 flex flex-wrap gap-3">
          {Array.from(localOrigins).map((origin) => (
            <span
              key={origin}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70"
            >
              origem {origin}
            </span>
          ))}
        </div>
      </section>

      <AssetsManager
        initialAssets={snapshot.items}
        initialSource={snapshot.source}
        generatedImages={generatedImagesSnapshot.items}
      />
    </div>
  );
}
