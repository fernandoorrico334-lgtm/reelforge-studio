import { BeastStudio } from "../../components/beast-studio";
import { getChannelsSnapshot, getMediaBeastCatalogSnapshot } from "../../lib/studio-api";

export default async function BeastStudioPage() {
  const [channelsSnapshot, catalogSnapshot] = await Promise.all([
    getChannelsSnapshot(),
    getMediaBeastCatalogSnapshot()
  ]);

  const presets = catalogSnapshot.item?.nichePresets ?? [
    {
      id: "serial_killers",
      name: "Serial Killers 1970s",
      description:
        "True-crime documentary preset for archive-first research, timelines and dark editorial visuals.",
      defaultKeywords: ["serial killers", "1970s", "case files", "archive"],
      defaultIntensity: "extreme" as const,
      channelTone: "dark documentary",
      visualBias: ["crime_board", "archive_grit", "cinematic_doc"],
      riskNotes: [
        "Avoid sensationalism and unsupported claims.",
        "Prefer public records, archive context and original narration."
      ]
    },
    {
      id: "futebol_antigo",
      name: "Futebol Antigo",
      description:
        "Vintage football preset for old players, matches, stadium atmosphere and stat-driven reels.",
      defaultKeywords: ["futebol antigo", "craques antigos", "lances raros"],
      defaultIntensity: "extreme" as const,
      channelTone: "hype documentary",
      visualBias: ["sports_hype", "archive_grit", "cinematic_doc"],
      riskNotes: [
        "Broadcast footage is high risk unless owned or licensed.",
        "Use stats, generated visuals and approved local microclips."
      ]
    }
  ];

  return <BeastStudio channels={channelsSnapshot.items} initialPresets={presets} />;
}