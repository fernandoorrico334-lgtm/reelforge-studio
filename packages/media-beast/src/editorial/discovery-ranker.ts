import type { MediaBeastCandidate, MediaBeastProviderId } from "../providers/types.js";

const LOW_VALUE_EDITORIAL_PROVIDERS = new Set<MediaBeastProviderId>([
  "trend-scanner",
  "flickr"
]);

const PROVIDER_EDITORIAL_BOOST: Partial<Record<MediaBeastProviderId, number>> = {
  "google-images": 22,
  "internet-archive": 20,
  youtube: 18,
  "old-forums": 14,
  "generic-web": 10,
  "community-miner": 8,
  reddit: 8,
  pinterest: 6
};

const MAX_PER_PROVIDER: Partial<Record<MediaBeastProviderId, number>> = {
  flickr: 0,
  "trend-scanner": 0,
  "google-images": 3,
  youtube: 2,
  "internet-archive": 2,
  "old-forums": 2
};

function readIntent(candidate: MediaBeastCandidate) {
  const intent = candidate.metadata.searchIntent;
  return typeof intent === "string" ? intent : "";
}

function isCurated(candidate: MediaBeastCandidate) {
  return candidate.metadata.curatedLead === true;
}

function isTrendOnlySurface(candidate: MediaBeastCandidate) {
  if (candidate.providerId !== "trend-scanner") {
    return false;
  }

  const intent = readIntent(candidate);
  return (
    intent === "search_trend" ||
    intent === "rising_query" ||
    intent === "cross_platform" ||
    intent === "question_mining"
  );
}

export function rankEditorialDiscoveryCandidates(
  candidates: MediaBeastCandidate[],
  query: string
) {
  const normalizedQuery = query.toLowerCase();

  return [...candidates]
    .map((candidate) => {
      let editorialScore = candidate.score;

      if (isCurated(candidate)) {
        editorialScore += 30;
      }

      const boost = PROVIDER_EDITORIAL_BOOST[candidate.providerId];
      if (boost) {
        editorialScore += boost;
      }

      if (LOW_VALUE_EDITORIAL_PROVIDERS.has(candidate.providerId)) {
        editorialScore -= 35;
      }

      if (isTrendOnlySurface(candidate)) {
        editorialScore -= 40;
      }

      if (candidate.metadata.searchSurface === true) {
        editorialScore -= 28;
      }

      if (
        candidate.metadata.substantiveScore !== undefined &&
        candidate.metadata.substantiveScore !== null &&
        typeof candidate.metadata.substantiveScore === "number" &&
        candidate.metadata.substantiveScore >= 55
      ) {
        editorialScore += 12;
      }

      if (
        candidate.metadata.contentSignals === "article" ||
        candidate.metadata.contentSignals === "archive_item" ||
        candidate.metadata.contentSignals === "forum_thread"
      ) {
        editorialScore += 10;
      }

      if (candidate.metadata.curatedLead === true) {
        editorialScore += 6;
      }

      if (
        normalizedQuery.split(/\s+/).some(
          (term) =>
            term.length > 3 &&
            (candidate.title.toLowerCase().includes(term) ||
              candidate.sourceUrl.toLowerCase().includes(term))
        )
      ) {
        editorialScore += 10;
      }

      if (candidate.sourceUrl.includes("google.com/search?tbm=isch")) {
        editorialScore += candidate.metadata.searchSurface === true ? 2 : 8;
      }

      if (candidate.sourceUrl.includes("archive.org/details")) {
        editorialScore += 16;
      } else if (
        candidate.sourceUrl.includes("archive.org") &&
        candidate.metadata.searchSurface !== true
      ) {
        editorialScore += 8;
      }

      if (candidate.sourceUrl.includes("youtube.com/watch")) {
        editorialScore += 14;
      } else if (candidate.sourceUrl.includes("youtube.com/results")) {
        editorialScore += 2;
      }

      if (candidate.sourceUrl.includes("wikipedia.org/wiki/")) {
        editorialScore += 14;
      }

      if (candidate.sourceUrl.includes("reddit.com/r/") && candidate.sourceUrl.includes("/comments/")) {
        editorialScore += 12;
      }

      return {
        ...candidate,
        score: editorialScore,
        metadata: {
          ...candidate.metadata,
          editorialScore
        }
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function diversifyEditorialCandidates(
  candidates: MediaBeastCandidate[],
  limit = 12
) {
  const picked: MediaBeastCandidate[] = [];
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const providerId = candidate.providerId;
    const maxForProvider = MAX_PER_PROVIDER[providerId];
    const current = counts.get(providerId) ?? 0;

    if (maxForProvider === 0) {
      continue;
    }

    if (maxForProvider !== undefined && current >= maxForProvider) {
      continue;
    }

    picked.push(candidate);
    counts.set(providerId, current + 1);

    if (picked.length >= limit) {
      break;
    }
  }

  if (picked.length < limit) {
    for (const candidate of candidates) {
      if (picked.some((item) => item.id === candidate.id)) {
        continue;
      }
      if (LOW_VALUE_EDITORIAL_PROVIDERS.has(candidate.providerId)) {
        continue;
      }
      picked.push(candidate);
      if (picked.length >= limit) {
        break;
      }
    }
  }

  return picked;
}

export function filterEditorialDisplayCandidates(
  candidates: MediaBeastCandidate[],
  query: string,
  limit = 12
) {
  const ranked = rankEditorialDiscoveryCandidates(candidates, query);
  const withoutNoise = ranked.filter(
    (candidate) =>
      !LOW_VALUE_EDITORIAL_PROVIDERS.has(candidate.providerId) ||
      isCurated(candidate)
  );

  return diversifyEditorialCandidates(withoutNoise, limit);
}