import { notFound } from "next/navigation";
import { ProjectStudio } from "../../../components/project-studio";
import {
  getAssetsSnapshot,
  getChannelsSnapshot,
  getProjectDetailSnapshot
} from "../../../lib/studio-api";

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function ProjectDetailPage({
  params
}: ProjectDetailPageProps) {
  const { id } = await params;
  const [projectSnapshot, assetsSnapshot, channelsSnapshot] = await Promise.all([
    getProjectDetailSnapshot(id),
    getAssetsSnapshot(),
    getChannelsSnapshot()
  ]);

  if (!projectSnapshot.item) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,158,102,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Editing Desk
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Projeto {projectSnapshot.item.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Monte a narrativa cena por cena, vincule assets locais e acompanhe
              a leitura estrutural da timeline sem entrar em renderizacao ainda.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte projeto
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(projectSnapshot.source)}
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

      <ProjectStudio
        assets={assetsSnapshot.items}
        assetsSource={assetsSnapshot.source}
        channels={channelsSnapshot.items}
        channelsSource={channelsSnapshot.source}
        initialProject={projectSnapshot.item}
        initialSource={projectSnapshot.source}
      />
    </div>
  );
}