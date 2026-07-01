"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Dashboard", short: "DB" },
  { href: "/intake", label: "Intake", short: "IN" },
  { href: "/media-collector", label: "Media Collector", short: "MC" },
  { href: "/research", label: "Research", short: "RS" },
  { href: "/characters", label: "Characters", short: "CR" },
  { href: "/channels", label: "Canais", short: "CH" },
  { href: "/assets", label: "Biblioteca", short: "AS" },
  { href: "/generated-images", label: "Geradas", short: "GI" },
  { href: "/generated-audio", label: "Narracoes", short: "NA" },
  { href: "/projects", label: "Projetos", short: "PJ" },
  { href: "/renders", label: "Renderizacoes", short: "RD" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export function StudioChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-graphite text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 md:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[2rem] border border-white/10 bg-panel/90 p-6 shadow-studio backdrop-blur xl:flex xl:flex-col">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-mist/70">
              <span className="h-2 w-2 rounded-full bg-signal" />
              Local Studio
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">
              ReelForge Studio
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-7 text-mist/65">
              Operacao local para canais, biblioteca de assets e futuros reels
              verticais com acabamento cinematico.
            </p>
          </div>

          <nav className="mt-10 flex flex-col gap-2">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${
                    active
                      ? "border-signal/40 bg-signal/10 text-white"
                      : "border-white/5 bg-white/[0.03] text-mist/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.22em] ${
                      active
                        ? "bg-signal/20 text-signal"
                        : "bg-white/5 text-mist/70"
                    }`}
                  >
                    {item.short}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-mist/55">
              Proxima camada
            </p>
            <p className="mt-3 text-sm leading-7 text-mist/70">
              Characters, Hybrid Visual Engine, Story Engine, captions premium
              e render local ja convivem sobre a mesma timeline operacional.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col rounded-[2rem] border border-white/10 bg-black/20 shadow-[0_45px_160px_rgba(0,0,0,0.45)] backdrop-blur">
          <header className="border-b border-white/10 px-4 py-4 md:px-8 md:py-6 xl:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-mist/55">
                  ReelForge
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">
                  Studio Dashboard
                </h1>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                {pathname}
              </div>
            </div>
            <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {navigation.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      active
                        ? "border-signal/40 bg-signal/10 text-white"
                        : "border-white/10 bg-white/[0.04] text-mist/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 px-4 py-4 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

