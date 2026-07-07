# @reelforge/media-beast

Media Beast is the candidate-first production planning engine for ReelForge Studio.
It is designed to help plan many short-form videos across niche channels without
turning discovery into automatic copying.

## Core Rule

Media Beast never downloads, imports, renders or publishes media by itself.
Every provider returns candidates. Every candidate must pass manual source,
license and risk review before becoming a real asset or render input.

## Main Pieces

- `providers/`: discovery surfaces such as YouTube leads, Google Images leads,
  Internet Archive candidates, Reddit leads, sports archives, comics archives
  and generic web leads.
- `niches/niche-presets.ts`: strong presets for serial killers, futebol antigo,
  quadrinhos classicos, cinema horror, fisiculturismo and historia obscura.
- `pipeline/visual-transformer.ts`: builds ComfyUI multi-pass visual plans with
  styles, seeds, workflows and cinematic effects.
- `pipeline/narration-overlay.ts`: builds narration payloads compatible with the
  Local Narration Pipeline.
- `pipeline/fast-cut-editor.ts`: builds fast-cut timing, emotion-based
  transitions and effect cues.
- `scheduler/channel-dna.ts`: defines channel personality, visual style,
  narration tone, music preset and preferred providers.
- `scheduler/daily-beast-producer.ts`: plans daily slots and multi-channel
  candidate assignments.

## Creating a Channel DNA

```ts
import { createChannelDNA } from "@reelforge/media-beast";

const channel = createChannelDNA({
  id: "true-crime-dark",
  name: "Curiosidades Sombrias",
  niche: "true_crime",
  dailyShortTarget: 5
});
```

## Discovering Candidates

```ts
import { createMediaBeastEngine } from "@reelforge/media-beast";

const engine = createMediaBeastEngine();
const result = await engine.discoverAndPlan({
  query: "serial killers 1970s",
  niches: ["true_crime"],
  targetCount: 10
});
```

The result includes candidates, risk review, transform plans and warnings.
Candidates are not assets.

## Discovering and Creating Transform Plans

```ts
const plan = await engine.discoverAndTransform(
  "serial killers 1970s",
  ["true_crime"],
  5,
  channel,
  "extreme"
);
```

This returns reel plans with visual variation, narration, fast cuts and manual
approval gates. It still does not render anything automatically.

## API Endpoints

- `GET /media-beast/providers`
- `POST /media-beast/discover`
- `POST /media-beast/transform-plan`
- `POST /media-beast/daily-batch`

Example discovery request:

```json
{
  "query": "serial killers 1970s",
  "niches": ["true_crime"],
  "channelId": "true-crime-dark",
  "intensity": "extreme",
  "targetCount": 5
}
```

## Daily Batch

```ts
import { distributeDailyBeastPlans } from "@reelforge/media-beast";

const daily = distributeDailyBeastPlans({
  channels: [channel],
  candidates: result.candidates,
  countPerChannel: 5
});
```

Assignments are scheduling hints. They are blocked until manual approval.

## Safety Model

- No automatic scraping.
- No automatic download.
- No auto-import into the asset library.
- No render without manual approval.
- No transformation intended to bypass bans, fingerprints or copyright systems.
- Use approved local, owned, licensed, public-domain or manually confirmed media.

