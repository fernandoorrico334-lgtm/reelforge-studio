import Link from "next/link";
import { DashboardCard } from "../components/dashboard-card";
import {
  getCharactersSnapshot,
  getDashboardSnapshot,
  getGeneratedAudioGallerySnapshot,
  getGeneratedImagesGallerySnapshot,
  getMediaCollectionsSnapshot,
  getResearchDossiersSnapshot
} from "../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local" : "Mock local";
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function HomePage() {
  const [
    snapshot,
    researchSnapshot,
    mediaCollectionsSnapshot,
    charactersSnapshot,
    generatedImagesSnapshot,
    generatedAudioSnapshot
  ] = await Promise.all([
    getDashboardSnapshot(),
    getResearchDossiersSnapshot(),
    getMediaCollectionsSnapshot(),
    getCharactersSnapshot(),
    getGeneratedImagesGallerySnapshot(),
    getGeneratedAudioGallerySnapshot()
  ]);
  const totalScenes = snapshot.projects.reduce(
    (total, project) => total + project.scenes.length,
    0
  );
  const uniqueTags = new Set(snapshot.assets.flatMap((asset) => asset.tags));
  const assetsWithHighRisk = snapshot.assets.filter(
    (asset) => asset.copyrightRisk === "HIGH"
  ).length;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),rgba(255,255,255,0.04)] p-6 shadow-studio md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Studio Operations
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Base operacional para canais, biblioteca local e projetos verticais
              9:16.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-mist/72">
              A fundacao agora ja sustenta persistencia local com Prisma +
              SQLite, CRUD de canais e assets, upload local real, timeline
              criativa, Research Collector para dossies documentais, flow de
              producao por script e renderizacao V1 por worker local com
              FFmpeg.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-mist/70">
                Canais: {formatSourceLabel(snapshot.sources.channels)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-mist/70">
                Assets: {formatSourceLabel(snapshot.sources.assets)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-mist/70">
                Projetos: {formatSourceLabel(snapshot.sources.projects)}
              </span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Readiness Check
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                  Assets mapeados
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {snapshot.assets.length}
                </p>
                <p className="mt-2 text-sm text-mist/65">
                  Paths locais prontos para intake real.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                  Cenas planejadas
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {totalScenes}
                </p>
              <p className="mt-2 text-sm text-mist/65">
                  Timeline viva para storyboard e montagem local.
              </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                  Tags catalogadas
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {uniqueTags.size}
                </p>
                <p className="mt-2 text-sm text-mist/65">
                  Base para filtros e descoberta rapida.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                  Risco alto
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {assetsWithHighRisk}
                </p>
                <p className="mt-2 text-sm text-mist/65">
                  Ja visivel para politica editorial futura.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
        <DashboardCard
          href="/reels-factory"
          title="Reels Factory"
          value="Batch"
          description="Transforme temas editoriais em projetos prontos com roteiro, prompts, narracao e proximos passos."
          accent="#ffe28a"
        />
        <DashboardCard
          href="/produce"
          title="Nova Producao"
          value="Flow"
          description="Cole o roteiro, aplique defaults do canal e gere a timeline inicial com cenas e sugestoes."
          accent="#63ffe1"
        />
        <DashboardCard
          href="/intake"
          title="Importar Materiais"
          value="Inbox"
          description="Escaneie `storage/inbox`, revise candidatos e importe lotes grandes para a biblioteca."
          accent="#ffcf70"
        />
        <DashboardCard
          href="/media-collector"
          title="Media Collector"
          value={String(mediaCollectionsSnapshot.items.length)}
          description="Busque, revise e importe midias autorizadas a partir de providers publicos e URLs diretas."
          accent="#7be0ff"
        />
        <DashboardCard
          href="/research"
          title="Research Collector"
          value={String(researchSnapshot.items.length)}
          description="Organize dossies, fontes, fatos, hooks e outline antes de abrir a timeline."
          accent="#92a7ff"
        />
        <DashboardCard
          href="/characters"
          title="Characters"
          value={String(charactersSnapshot.items.length)}
          description="Perfis recorrentes, referencias visuais e base prompts para o Hybrid Visual Engine."
          accent="#7ef7d8"
        />
        <DashboardCard
          href="/channels"
          title="Canais"
          value={String(snapshot.channels.length)}
          description="Perfis editoriais, template padrao e direcao narrativa de cada operacao."
          accent="#63ffe1"
        />
        <DashboardCard
          href="/assets"
          title="Biblioteca"
          value={String(snapshot.assets.length)}
          description="Catalogo local de imagens, videos, quadrinhos e referencias ja indexadas."
          accent="#ff9e66"
        />
        <DashboardCard
          href="/generated-images"
          title="Imagens Geradas"
          value={String(generatedImagesSnapshot.items.length)}
          description="Galeria de revisao para escolher, aprovar e reaproveitar visuais gerados."
          accent="#7ef7d8"
        />
        <DashboardCard
          href="/generated-audio"
          title="Narrações Geradas"
          value={String(generatedAudioSnapshot.items.length)}
          description="Galeria de WAVs locais para ouvir, revisar e aplicar por cena."
          accent="#7be0ff"
        />
        <DashboardCard
          href="/projects"
          title="Projetos"
          value={String(snapshot.projects.length)}
          description="Projetos com status, cenas e vinculo com canal para evoluir o storyboard."
          accent="#ffcf70"
        />
        <DashboardCard
          href="/renders"
          title="Renderizacoes"
          value={String(snapshot.renders.length)}
          description="Fila local real, logs operacionais e exportacoes MP4 acompanhadas pelo worker."
          accent="#92a7ff"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Projetos Ativos
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Painel de storyboards prontos para crescer
              </h2>
            </div>
            <Link
              href="/projects"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75 transition hover:border-signal/35 hover:text-white"
            >
              Abrir projetos
            </Link>
          </div>

          <div className="mt-6 grid gap-4">
            {snapshot.projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {project.title}
                    </h3>
                    <p className="mt-2 text-sm text-mist/65">
                      Canal {project.channel.name} - formato {project.format}
                    </p>
                  </div>
                  <span className="rounded-full border border-signal/20 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-signal">
                    {formatStatusLabel(project.status)}
                  </span>
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-mist/70">
                  {project.script ?? "Roteiro ainda nao definido."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {project.scenes.length} cenas
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    duracao alvo {project.durationTarget ?? "n/d"}s
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Studio Signals
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Proximas frentes desbloqueadas
          </h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Upload real</p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                Biblioteca local agora recebe arquivos reais e a timeline ja
                pode reaproveitar esse arsenal por cena.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Media Collector</p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                Requirements do Research e cenas sem asset ja podem abrir
                colecoes revisaveis para abastecer a biblioteca com seguranca.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Character continuity</p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                Profiles, referencias e prompts base ajudam a manter
                consistencia visual entre intake, research e timeline.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Hybrid visual support</p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                Scenes fracas ou repetidas agora podem receber mock visuals
                locais em SVG para planejar reforcos antes da renderizacao.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Worker local</p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                O pipeline V1 ja transforma blueprint em job, processa no
                worker e exporta MP4 vertical em `storage/renders`.
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

