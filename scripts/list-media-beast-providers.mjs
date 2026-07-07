import { createMediaBeastEngine, listMediaBeastProviders } from "../packages/media-beast/dist/index.js";

const providers = listMediaBeastProviders();

console.log(`=== MEDIA BEAST PROVIDERS (${providers.length}) ===\n`);

for (const provider of providers) {
  const { descriptor } = provider;
  const { capabilities: caps } = descriptor;

  console.log(`${descriptor.id}`);
  console.log(`  name: ${descriptor.name}`);
  console.log(`  description: ${descriptor.description}`);
  console.log(
    `  capabilities: discoveryOnly=${caps.discoveryOnly}, importSupported=${caps.importSupported}, dateFilters=${caps.supportsDateFilters}`
  );
  console.log(
    `  media: images=${caps.supportsImages}, videos=${caps.supportsVideos}, audio=${caps.supportsAudio}`
  );
  console.log(`  riskNotes (${descriptor.riskNotes.length}):`);
  for (const note of descriptor.riskNotes) {
    console.log(`    - ${note}`);
  }
  console.log("");
}

const engine = createMediaBeastEngine();
const result = await engine.discover({
  niche: "true_crime",
  keywords: ["serial killers 1970s"],
  maxCandidates: 3
});

console.log("=== SAMPLE DISCOVERY (true_crime) ===");
console.log(`candidates: ${result.candidates.length}`);
console.log(`providers: ${[...new Set(result.candidates.map((c) => c.providerId))].join(", ")}`);
console.log(
  `temporal lenses: ${[...new Set(result.candidates.map((c) => c.metadata.temporalLens))].join(", ")}`
);