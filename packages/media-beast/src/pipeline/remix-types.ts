export const remixTargetStyles = [
  "dark_cinematic",
  "hype_sports",
  "documentary",
  "horror",
  "true_crime",
  "vintage_football",
  "anime",
  "comics",
  "bodybuilding",
  "generic"
] as const;

export type RemixTargetStyle = (typeof remixTargetStyles)[number];