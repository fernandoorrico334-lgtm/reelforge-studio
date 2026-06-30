import type { CinematicPresetSummary } from "../lib/studio-types";
import {
  describePresetIntensity,
  describePresetMotion
} from "../lib/project-story-analysis";

interface CinematicPresetCardProps {
  preset: CinematicPresetSummary;
  eyebrow: string;
  title: string;
  modeLabel?: string;
}

export function CinematicPresetCard({
  preset,
  eyebrow,
  title,
  modeLabel
}: CinematicPresetCardProps) {
  return (
    <article className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(0,0,0,0.28))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-mist/45">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
        </div>
        {modeLabel ? (
          <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-signal">
            {modeLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-white">{preset.name}</p>
            <p className="mt-2 text-sm leading-7 text-mist/68">
              {preset.description}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
            {preset.id}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Movimento
            </p>
            <p className="mt-2 text-sm text-white">
              {describePresetMotion(preset)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Intensidade
            </p>
            <p className="mt-2 text-sm text-white">
              {describePresetIntensity(preset)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Cor
            </p>
            <p className="mt-2 text-sm text-white">{preset.colorMood}</p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Legenda
            </p>
            <p className="mt-2 text-sm text-white">
              {preset.suggestedCaptionStyle}
            </p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Musica
            </p>
            <p className="mt-2 text-sm text-white">
              {preset.suggestedMusicMood}
            </p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              SFX
            </p>
            <p className="mt-2 text-sm text-white">{preset.suggestedSfx}</p>
          </div>
        </div>
      </div>
    </article>
  );
}