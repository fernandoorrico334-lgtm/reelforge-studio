import { MusicLibraryManager } from "../../components/music-library-manager";
import {
  getMusicLibrarySnapshot,
  getSfxLibrarySnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function MusicLibraryPage() {
  const [musicSnapshot, sfxSnapshot] = await Promise.all([
    getMusicLibrarySnapshot(),
    getSfxLibrarySnapshot()
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,224,255,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,207,112,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Music Library
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Trilha local, SFX e metadados ritmicos para reels premium
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              A biblioteca musical cataloga BPM, energia, uso editorial,
              licenca e sinais de beat para sincronizar microclips, SFX e
              mastering sem depender de servicos externos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Music source
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(musicSnapshot.source)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                SFX source
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(sfxSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <MusicLibraryManager
        initialMusicItems={musicSnapshot.items}
        initialMusicSource={musicSnapshot.source}
        initialSfxItems={sfxSnapshot.items}
        initialSfxSource={sfxSnapshot.source}
      />
    </div>
  );
}
