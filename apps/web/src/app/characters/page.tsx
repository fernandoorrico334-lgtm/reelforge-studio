import { CharactersManager } from "../../components/characters-manager";
import {
  getAssetsSnapshot,
  getCharactersSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function CharactersPage() {
  const [charactersSnapshot, assetsSnapshot] = await Promise.all([
    getCharactersSnapshot(),
    getAssetsSnapshot()
  ]);

  const source =
    charactersSnapshot.source === "api" || assetsSnapshot.source === "api"
      ? "api"
      : "mock";

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,158,102,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Character Reference
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Profiles, referencias e base prompts locais
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Estruture personagens recorrentes, una referencias da biblioteca
              e do intake manual e prepare perfis consistentes para o Hybrid
              Visual Engine sem depender de servicos externos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Profiles
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {charactersSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Biblioteca
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
                {formatSourceLabel(source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <CharactersManager
        initialAssets={assetsSnapshot.items}
        initialCharacters={charactersSnapshot.items}
        initialSource={source}
      />
    </div>
  );
}

