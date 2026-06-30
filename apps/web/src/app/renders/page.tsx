import { RendersManager } from "../../components/renders-manager";
import { getRenderJobsSnapshot } from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "fallback local";
}

export default async function RendersPage() {
  const renderJobsSnapshot = await getRenderJobsSnapshot();
  const completedCount = renderJobsSnapshot.items.filter(
    (renderJob) => renderJob.status === "completed"
  ).length;
  const processingCount = renderJobsSnapshot.items.filter(
    (renderJob) =>
      renderJob.status === "queued" || renderJob.status === "processing"
  ).length;
  const failedCount = renderJobsSnapshot.items.filter(
    (renderJob) => renderJob.status === "failed"
  ).length;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(146,167,255,0.18),transparent_30%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Render Queue
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Worker local, FFmpeg e exportacao MP4 vertical
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              A fila de render agora acompanha jobs reais, progresso, logs e o
              MP4 final gerado em `storage/renders`.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Jobs
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {renderJobsSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Em fila/processo
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {processingCount}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Concluidos
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {completedCount}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Falhas
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {failedCount}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Fonte: {formatSourceLabel(renderJobsSnapshot.source)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
            Worker V1 em loop de 3s
          </span>
        </div>
      </section>

      <RendersManager
        initialJobs={renderJobsSnapshot.items}
        initialSource={renderJobsSnapshot.source}
      />
    </div>
  );
}

