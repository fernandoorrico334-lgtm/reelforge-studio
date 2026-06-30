import { notFound } from "next/navigation";
import { ResearchDossierStudio } from "../../../components/research-dossier-studio";
import {
  getChannelsSnapshot,
  getResearchDossierDetailSnapshot
} from "../../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

interface ResearchDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ResearchDetailPage({
  params
}: ResearchDetailPageProps) {
  const { id } = await params;
  const [detailSnapshot, channelsSnapshot] = await Promise.all([
    getResearchDossierDetailSnapshot(id),
    getChannelsSnapshot()
  ]);

  if (!detailSnapshot.item) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(146,167,255,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,207,112,0.12),transparent_22%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Dossier Desk
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              {detailSnapshot.item.dossier.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Revise fontes, separe fatos e incertezas, acompanhe a linha do tempo,
              refine hooks e transforme o dossie em uma timeline de producao pronta
              para seguir para /projects.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Dossie
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(detailSnapshot.source)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Canais
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(channelsSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ResearchDossierStudio
        channels={channelsSnapshot.items}
        channelsSource={channelsSnapshot.source}
        initialDetail={detailSnapshot.item}
        initialSource={detailSnapshot.source}
      />
    </div>
  );
}