import { ReelsFactoryStudio } from "../../components/reels-factory-studio";
import {
  getChannelsSnapshot,
  getEditingReferencePresetsSnapshot,
  getReelsFactoryTemplatesSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function ReelsFactoryPage() {
  const [channelsSnapshot, templatesSnapshot, editingReferencePresetsSnapshot] =
    await Promise.all([
    getChannelsSnapshot(),
    getReelsFactoryTemplatesSnapshot(),
    getEditingReferencePresetsSnapshot()
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(123,224,255,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Reels Factory
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Batch editorial reels prontos para virar timeline real
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              A fabrica monta roteiros autorais em lote a partir de tema
              digitado, com narracao por cena, prompt visual, hints de workflow,
              voice pack, mastering e slot opcional de microclip.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Templates
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {templatesSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                templates {formatSourceLabel(templatesSnapshot.source)} / canais{" "}
                {formatSourceLabel(channelsSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ReelsFactoryStudio
        channels={channelsSnapshot.items}
        channelsSource={channelsSnapshot.source}
        templates={templatesSnapshot.items}
        templatesSource={templatesSnapshot.source}
        editingReferencePresets={editingReferencePresetsSnapshot.items}
        editingReferencePresetsSource={editingReferencePresetsSnapshot.source}
      />
    </div>
  );
}
