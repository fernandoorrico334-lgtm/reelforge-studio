import type { ReactNode } from "react";
import type { Metadata } from "next";
import { StudioChrome } from "../components/studio-chrome";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ReelForge Studio",
  description: "Dark studio dashboard for channels, local assets and reel operations."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <StudioChrome>{children}</StudioChrome>
      </body>
    </html>
  );
}

