import { GeneratedImagesManager } from "../../components/generated-images-manager";
import { getGeneratedImagesGallerySnapshot } from "../../lib/studio-api";

export default async function GeneratedImagesPage() {
  const snapshot = await getGeneratedImagesGallerySnapshot();

  return (
    <GeneratedImagesManager
      initialItems={snapshot.items}
      initialSource={snapshot.source}
    />
  );
}
