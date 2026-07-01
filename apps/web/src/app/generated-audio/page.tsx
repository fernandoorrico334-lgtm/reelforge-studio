import { GeneratedAudioManager } from "../../components/generated-audio-manager";
import { getGeneratedAudioGallerySnapshot } from "../../lib/studio-api";

export default async function GeneratedAudioPage() {
  const snapshot = await getGeneratedAudioGallerySnapshot();

  return (
    <GeneratedAudioManager
      initialItems={snapshot.items}
      initialSource={snapshot.source}
    />
  );
}
