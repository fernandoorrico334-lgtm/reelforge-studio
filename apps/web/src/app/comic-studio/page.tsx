import { ComicStudio } from "../../components/comic-studio";
import { getChannelsSnapshot } from "../../lib/studio-api";

export default async function ComicStudioPage() {
  const channelsSnapshot = await getChannelsSnapshot();
  return <ComicStudio channels={channelsSnapshot.items} />;
}
