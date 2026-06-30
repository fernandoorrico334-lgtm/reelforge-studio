import Link from "next/link";

export interface DashboardCardProps {
  href: string;
  title: string;
  value: string;
  description: string;
  accent: string;
}

export function DashboardCard({
  href,
  title,
  value,
  description,
  accent
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-mist/55">
            {title}
          </p>
          <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
        </div>
        <div
          className="h-12 w-12 rounded-2xl border border-white/10"
          style={{ backgroundColor: accent }}
        />
      </div>
      <p className="mt-6 max-w-xs text-sm leading-7 text-mist/68">
        {description}
      </p>
      <div className="mt-6 text-sm font-medium text-signal transition group-hover:translate-x-1">
        Abrir modulo
      </div>
    </Link>
  );
}

