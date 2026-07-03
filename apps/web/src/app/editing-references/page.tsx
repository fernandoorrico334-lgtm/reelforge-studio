import { EditingReferencesManager } from "../../components/editing-references-manager";
import {
  getAssetsSnapshot,
  getEditingReferencePresetsSnapshot,
  getEditingReferencesSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function EditingReferencesPage() {
  const [assetsSnapshot, referencesSnapshot, presetsSnapshot] = await Promise.all([
    getAssetsSnapshot(),
    getEditingReferencesSnapshot(),
    getEditingReferencePresetsSnapshot()
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,158,102,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(123,224,255,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Editing Reference Presets
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Reels de referencia locais virando linguagem editorial reutilizavel
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Cadastre videos autorizados, rode analise local com FFmpeg/ffprobe
              e transforme o ritmo de corte, os inserts e a assinatura visual
              em presets prontos para orientar novos projetos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Referencias
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(referencesSnapshot.source)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Presets
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(presetsSnapshot.source)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Biblioteca
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(assetsSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <EditingReferencesManager
        assets={assetsSnapshot.items}
        initialReferences={referencesSnapshot.items}
        initialReferenceSource={referencesSnapshot.source}
        initialPresets={presetsSnapshot.items}
        initialPresetSource={presetsSnapshot.source}
      />
    </div>
  );
}
