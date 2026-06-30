import { ProjectsManager } from "../../components/projects-manager";
import {
  getChannelsSnapshot,
  getProjectsSnapshot
} from "../../lib/studio-api";

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function ProjectsPage() {
  const [projectsSnapshot, channelsSnapshot] = await Promise.all([
    getProjectsSnapshot(),
    getChannelsSnapshot()
  ]);
  const totalScenes = projectsSnapshot.items.reduce(
    (total, project) => total + project.scenes.length,
    0
  );
  const planningProjects = projectsSnapshot.items.filter(
    (project) => project.status === "SCENE_PLANNING"
  ).length;
  const readyProjects = projectsSnapshot.items.filter(
    (project) => project.status === "READY_FOR_EDIT"
  ).length;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,207,112,0.16),transparent_28%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Project Board
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Projetos, cenas e timeline inicial de edicao
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Crie projetos por canal, abra a timeline, monte cenas com assets
              existentes e acompanhe sinais de qualidade, presets
              cinematograficos e leitura narrativa sem depender de servicos
              externos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Projetos
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {projectsSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Cenas
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {totalScenes}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Em planejamento
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {planningProjects}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Ready for edit
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {readyProjects}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Fonte de projetos: {formatSourceLabel(projectsSnapshot.source)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Status ativos:{" "}
            {Array.from(
              new Set(projectsSnapshot.items.map((project) => formatStatusLabel(project.status)))
            ).join(", ")}
          </span>
        </div>
      </section>

      <ProjectsManager
        initialChannels={channelsSnapshot.items}
        initialChannelSource={channelsSnapshot.source}
        initialProjects={projectsSnapshot.items}
        initialProjectSource={projectsSnapshot.source}
      />
    </div>
  );
}

