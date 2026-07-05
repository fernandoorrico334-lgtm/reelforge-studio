export const productionDiscoveryNiches = [
  "true_crime",
  "football",
  "comics",
  "anime",
  "movies",
  "games",
  "history",
  "mystery",
  "documentary",
  "generic"
] as const;

export type ProductionDiscoveryNiche =
  (typeof productionDiscoveryNiches)[number];

export type VisualRequirementMediaType =
  | "image"
  | "video"
  | "microclip"
  | "document"
  | "map"
  | "generated_image"
  | "card"
  | "sfx";

export type VisualRequirementImportance =
  | "low"
  | "medium"
  | "high"
  | "must_have";

export type VisualRequirementFallback =
  | "local_asset"
  | "generated_image"
  | "media_candidate"
  | "text_card";

export interface NicheProfile {
  id: ProductionDiscoveryNiche;
  name: string;
  description: string;
  defaultTemplates: string[];
  defaultTone: string;
  defaultStructure: string[];
  researchFocus: string[];
  entityTypes: string[];
  mediaNeeds: string[];
  sourceSuggestions: string[];
  visualStyle: string;
  safetyRules: string[];
  recommendedWorkflowPackId: string;
  recommendedMusicPresetId: string;
  recommendedAudioMasteringPresetId: string;
  recommendedEditingPresetUseCase: string;
  defaultSceneRoles: string[];
}

export interface BuildNicheResearchQueriesInput {
  topic: string;
  niche: ProductionDiscoveryNiche | string;
  angle?: string | null;
  language?: string | null;
}

export interface NicheResearchQueries {
  researchQueries: string[];
  mediaQueries: string[];
  entityQueries: string[];
  sourceDiscoveryLinks: string[];
  suggestedFactsToFind: string[];
  suggestedMediaToFind: string[];
}

export interface NicheDossier {
  topic: string;
  niche: ProductionDiscoveryNiche;
  title: string;
  angle: string | null;
  language: string;
  tone: string;
  summary: string;
  entities: Array<{ type: string; name: string; notes: string }>;
  timeline: Array<{ order: number; title: string; description: string }>;
  facts: Array<{ claim: string; confidence: "confirmed" | "uncertain" }>;
  uncertainties: string[];
  editorialSafety: string[];
  outline: NicheOutlineScene[];
  assetSeeds: string[];
}

export interface NicheOutlineScene {
  order: number;
  role: string;
  title: string;
  narrationDraft: string;
  captionDraft: string;
  emotion: string;
  estimatedDuration: number;
}

export interface VisualRequirement {
  id: string;
  sceneOrder: number;
  role: string;
  narrationGoal: string;
  visualNeedDescription: string;
  mediaType: VisualRequirementMediaType;
  suggestedQueries: string[];
  suggestedTags: string[];
  fallbackStrategy: VisualRequirementFallback;
  importance: VisualRequirementImportance;
  requiresUserReview: boolean;
}

export type DiscoveryProviderGroup =
  | "open_media"
  | "archives"
  | "museums_open_access"
  | "comics_literature"
  | "sports_data"
  | "audio_sfx"
  | "context_discovery"
  | "internal";

export type DiscoveryProviderRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "editorial_only"
  | "restricted"
  | "unknown";

export type DiscoveryProviderLicenseStatus =
  | "public_domain"
  | "open_license"
  | "creative_commons"
  | "royalty_free"
  | "editorial_only"
  | "restricted"
  | "unknown"
  | "local_user_review";

export interface DiscoveryMediaProvider {
  id: string;
  name: string;
  group: DiscoveryProviderGroup;
  homepage: string;
  requiresApiKey: boolean;
  freeTierAvailable: boolean;
  supportsImage: boolean;
  supportsVideo: boolean;
  supportsAudio: boolean;
  supportsDocuments: boolean;
  supportsData: boolean;
  supportsLicenseMetadata: boolean;
  discoveryOnly: boolean;
  importSupported: boolean;
  defaultRiskLevel: DiscoveryProviderRiskLevel;
  defaultLicenseStatus: DiscoveryProviderLicenseStatus;
  notes: string;
  setupInstructions: string;
}

export interface DiscoverySourcePack {
  id: string;
  name: string;
  description: string;
  recommendedForNiches: ProductionDiscoveryNiche[];
  primaryProviderIds: string[];
  fallbackProviderIds: string[];
  blockedAutoImportProviderIds: string[];
  notes: string[];
}

export interface CandidateProviderPlan {
  providerId: string;
  providerName: string;
  sourcePackId: string;
  discoveryOnly: boolean;
  importSupported: boolean;
  requiresApiKey: boolean;
  enabledByDefault: boolean;
  defaultRiskLevel: DiscoveryProviderRiskLevel;
  defaultLicenseStatus: DiscoveryProviderLicenseStatus;
  score: number;
  reason: string;
  warning: string | null;
  previewUrl: string | null;
  sourceUrl: string;
}

function mediaProvider(input: DiscoveryMediaProvider): DiscoveryMediaProvider {
  return input;
}

const discoveryMediaProviders: DiscoveryMediaProvider[] = [
  mediaProvider({
    id: "openverse",
    name: "Openverse",
    group: "open_media",
    homepage: "https://openverse.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Open catalog for image/audio discovery; license still needs review per item.",
    setupInstructions: "No key required for manual discovery. Import only after user review."
  }),
  mediaProvider({
    id: "wikimedia-commons",
    name: "Wikimedia Commons",
    group: "open_media",
    homepage: "https://commons.wikimedia.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Useful for public-domain/CC media, but files may contain trademark/personality rights concerns.",
    setupInstructions: "No key required. Review file page license and attribution before import."
  }),
  mediaProvider({
    id: "pexels",
    name: "Pexels",
    group: "open_media",
    homepage: "https://www.pexels.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "royalty_free",
    notes: "Good b-roll source; API requires a free key and item license review.",
    setupInstructions: "Set a future PEXELS_API_KEY before enabling connector. Manual candidate review remains required."
  }),
  mediaProvider({
    id: "pixabay",
    name: "Pixabay",
    group: "open_media",
    homepage: "https://pixabay.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "royalty_free",
    notes: "Can provide images, videos, music and SFX with license metadata.",
    setupInstructions: "Set a future PIXABAY_API_KEY before enabling connector. User approval required before import."
  }),
  mediaProvider({
    id: "unsplash",
    name: "Unsplash",
    group: "open_media",
    homepage: "https://unsplash.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "royalty_free",
    notes: "Strong photo discovery source; verify use restrictions and attribution expectations.",
    setupInstructions: "Set a future UNSPLASH_ACCESS_KEY before enabling connector."
  }),
  mediaProvider({
    id: "flickr-creative-commons",
    name: "Flickr Creative Commons",
    group: "open_media",
    homepage: "https://www.flickr.com/creativecommons",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Large CC catalog with uneven metadata quality.",
    setupInstructions: "Set a future FLICKR_API_KEY before enabling connector."
  }),
  mediaProvider({
    id: "internet-archive",
    name: "Internet Archive",
    group: "archives",
    homepage: "https://archive.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Excellent archive source, but item rights vary widely.",
    setupInstructions: "Review item metadata/license manually before import."
  }),
  mediaProvider({
    id: "library-of-congress",
    name: "Library of Congress",
    group: "archives",
    homepage: "https://www.loc.gov",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Strong historical/archive source; rights statements still need item review.",
    setupInstructions: "Use public item pages and preserve rights/credit metadata."
  }),
  mediaProvider({
    id: "chronicling-america",
    name: "Chronicling America",
    group: "archives",
    homepage: "https://chroniclingamerica.loc.gov",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Historical newspapers for documentary/true-crime context.",
    setupInstructions: "Review newspaper page and OCR quality before import."
  }),
  mediaProvider({
    id: "national-archives",
    name: "National Archives",
    group: "archives",
    homepage: "https://www.archives.gov",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "US archival media and documents; check catalog restrictions.",
    setupInstructions: "Record catalog URL and rights statement before import."
  }),
  mediaProvider({
    id: "dpla",
    name: "Digital Public Library of America",
    group: "archives",
    homepage: "https://dp.la",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Aggregator; rights come from source institutions.",
    setupInstructions: "Set a future DPLA_API_KEY. Review each source item."
  }),
  mediaProvider({
    id: "nypl-digital-collections",
    name: "NYPL Digital Collections",
    group: "archives",
    homepage: "https://digitalcollections.nypl.org",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Rich historical image/document catalog.",
    setupInstructions: "Set a future NYPL_API_KEY for connector use; review rights."
  }),
  mediaProvider({
    id: "europeana",
    name: "Europeana",
    group: "archives",
    homepage: "https://www.europeana.eu",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "European cultural heritage aggregator; rights vary by provider.",
    setupInstructions: "Set a future EUROPEANA_API_KEY and review item rights."
  }),
  mediaProvider({
    id: "nasa-image-video",
    name: "NASA Image and Video Library",
    group: "archives",
    homepage: "https://images.nasa.gov",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Strong science/space source; avoid implying endorsement.",
    setupInstructions: "Review NASA media usage guidelines before import."
  }),
  mediaProvider({
    id: "noaa-digital-collections",
    name: "NOAA Digital Collections",
    group: "archives",
    homepage: "https://www.noaa.gov/digital-collections",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Weather/ocean/climate media and data.",
    setupInstructions: "Review item metadata and credit requirements."
  }),
  mediaProvider({
    id: "usgs-multimedia",
    name: "USGS Multimedia",
    group: "archives",
    homepage: "https://www.usgs.gov/products/multimedia-gallery",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Earth science, maps and hazard visuals.",
    setupInstructions: "Review item source/credit metadata before import."
  }),
  mediaProvider({
    id: "smithsonian-open-access",
    name: "Smithsonian Open Access",
    group: "museums_open_access",
    homepage: "https://www.si.edu/openaccess",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Open-access cultural and scientific collection.",
    setupInstructions: "Set a future SMITHSONIAN_API_KEY for connector use."
  }),
  mediaProvider({
    id: "met-museum",
    name: "The Met Collection",
    group: "museums_open_access",
    homepage: "https://www.metmuseum.org/art/collection",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Open Access objects can support history/art documentary visuals.",
    setupInstructions: "Import only objects flagged Open Access/public domain."
  }),
  mediaProvider({
    id: "art-institute-chicago",
    name: "Art Institute of Chicago",
    group: "museums_open_access",
    homepage: "https://www.artic.edu/open-access",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Open artwork images and metadata.",
    setupInstructions: "Review public-domain flag and credit metadata."
  }),
  mediaProvider({
    id: "cleveland-museum-art",
    name: "Cleveland Museum of Art",
    group: "museums_open_access",
    homepage: "https://www.clevelandart.org/open-access",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Open access artwork catalog.",
    setupInstructions: "Review CC0/open access status before import."
  }),
  mediaProvider({
    id: "rijksmuseum",
    name: "Rijksmuseum",
    group: "museums_open_access",
    homepage: "https://www.rijksmuseum.nl",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "High-quality museum images; API key required.",
    setupInstructions: "Set a future RIJKSMUSEUM_API_KEY."
  }),
  mediaProvider({
    id: "getty-open-content",
    name: "Getty Open Content",
    group: "museums_open_access",
    homepage: "https://www.getty.edu/projects/open-content-program/",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Open content collection; confirm item rights.",
    setupInstructions: "Review open content label before import."
  }),
  mediaProvider({
    id: "harvard-art-museums",
    name: "Harvard Art Museums",
    group: "museums_open_access",
    homepage: "https://harvardartmuseums.org/collections/api",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Museum objects and images; rights vary.",
    setupInstructions: "Set a future HARVARD_ART_MUSEUMS_API_KEY and review rights."
  }),
  mediaProvider({
    id: "victoria-and-albert",
    name: "Victoria and Albert Museum",
    group: "museums_open_access",
    homepage: "https://developers.vam.ac.uk",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Design/art objects with rights metadata.",
    setupInstructions: "Review individual image rights before import."
  }),
  mediaProvider({
    id: "science-museum-group",
    name: "Science Museum Group",
    group: "museums_open_access",
    homepage: "https://collection.sciencemuseumgroup.org.uk",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Science/history objects and collection metadata.",
    setupInstructions: "Review image licensing and attribution."
  }),
  mediaProvider({
    id: "princeton-art-museum",
    name: "Princeton University Art Museum",
    group: "museums_open_access",
    homepage: "https://artmuseum.princeton.edu",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Museum object discovery; rights vary.",
    setupInstructions: "Review object rights before import."
  }),
  mediaProvider({
    id: "british-museum-discovery",
    name: "British Museum Discovery",
    group: "museums_open_access",
    homepage: "https://www.britishmuseum.org/collection",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "editorial_only",
    defaultLicenseStatus: "editorial_only",
    notes: "Useful for discovery/reference; media reuse may be restricted.",
    setupInstructions: "Use for candidate discovery; import only if rights are manually cleared."
  }),
  mediaProvider({
    id: "public-domain-image-archive",
    name: "Public Domain Image Archive",
    group: "museums_open_access",
    homepage: "https://pdimagearchive.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Public-domain image discovery source.",
    setupInstructions: "Review original source and attribution before import."
  }),
  mediaProvider({
    id: "digital-comic-museum",
    name: "Digital Comic Museum",
    group: "comics_literature",
    homepage: "https://digitalcomicmuseum.com",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "public_domain",
    notes: "Public-domain golden-age comics; still review issue status.",
    setupInstructions: "Confirm public-domain status before importing panels."
  }),
  mediaProvider({
    id: "grand-comics-database",
    name: "Grand Comics Database",
    group: "comics_literature",
    homepage: "https://www.comics.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "editorial_only",
    defaultLicenseStatus: "restricted",
    notes: "Metadata/reference discovery for comics; not a media import source.",
    setupInstructions: "Use for context and issue identification only."
  }),
  mediaProvider({
    id: "project-gutenberg",
    name: "Project Gutenberg",
    group: "comics_literature",
    homepage: "https://www.gutenberg.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "Public-domain books, images and some audio.",
    setupInstructions: "Review country-specific copyright caveats."
  }),
  mediaProvider({
    id: "gutendex",
    name: "Gutendex",
    group: "comics_literature",
    homepage: "https://gutendex.com",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "public_domain",
    notes: "API mirror for Project Gutenberg metadata.",
    setupInstructions: "Use metadata to create candidates; review before import."
  }),
  mediaProvider({
    id: "statsbomb-open-data",
    name: "StatsBomb Open Data",
    group: "sports_data",
    homepage: "https://github.com/statsbomb/open-data",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "open_license",
    notes: "Open football event data for cards/analysis, not media footage.",
    setupInstructions: "Use to create data candidates/stat cards; respect license terms."
  }),
  mediaProvider({
    id: "thesportsdb",
    name: "TheSportsDB",
    group: "sports_data",
    homepage: "https://www.thesportsdb.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "unknown",
    defaultLicenseStatus: "unknown",
    notes: "Sports metadata and imagery discovery; rights need review.",
    setupInstructions: "Set a future THESPORTSDB_API_KEY; do not auto-import."
  }),
  mediaProvider({
    id: "football-data-org",
    name: "football-data.org",
    group: "sports_data",
    homepage: "https://www.football-data.org",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "open_license",
    notes: "Football fixtures/results data for context cards.",
    setupInstructions: "Set a future FOOTBALL_DATA_API_KEY."
  }),
  mediaProvider({
    id: "balldontlie",
    name: "balldontlie",
    group: "sports_data",
    homepage: "https://www.balldontlie.io",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "open_license",
    notes: "Basketball stats discovery for cards.",
    setupInstructions: "Set a future BALLDONTLIE_API_KEY."
  }),
  mediaProvider({
    id: "api-sports-free-tier-optional",
    name: "API-SPORTS Free Tier Optional",
    group: "sports_data",
    homepage: "https://www.api-football.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "unknown",
    notes: "Optional sports data connector; quota/API-key gated.",
    setupInstructions: "Set a future API_SPORTS_KEY only if user opts in."
  }),
  mediaProvider({
    id: "freesound",
    name: "Freesound",
    group: "audio_sfx",
    homepage: "https://freesound.org",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "SFX discovery with varied CC licenses.",
    setupInstructions: "Set a future FREESOUND_API_KEY; review attribution/license before import."
  }),
  mediaProvider({
    id: "pixabay-music-sfx",
    name: "Pixabay Music/SFX",
    group: "audio_sfx",
    homepage: "https://pixabay.com/music/",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "royalty_free",
    notes: "Music and SFX candidates from Pixabay.",
    setupInstructions: "Set a future PIXABAY_API_KEY; candidate-first import only."
  }),
  mediaProvider({
    id: "openverse-audio",
    name: "Openverse Audio",
    group: "audio_sfx",
    homepage: "https://openverse.org/audio",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Open audio discovery; license review required.",
    setupInstructions: "Review source item and attribution before import."
  }),
  mediaProvider({
    id: "wikimedia-audio",
    name: "Wikimedia Audio",
    group: "audio_sfx",
    homepage: "https://commons.wikimedia.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Audio from Wikimedia Commons.",
    setupInstructions: "Review Commons file license before import."
  }),
  mediaProvider({
    id: "internet-archive-audio",
    name: "Internet Archive Audio",
    group: "audio_sfx",
    homepage: "https://archive.org/details/audio",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: true,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "unknown",
    notes: "Audio archive with varied rights.",
    setupInstructions: "Review item rights before importing audio."
  }),
  mediaProvider({
    id: "wikidata",
    name: "Wikidata",
    group: "context_discovery",
    homepage: "https://www.wikidata.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "open_license",
    notes: "Entity discovery and fact context, not media import.",
    setupInstructions: "Use for context candidates and source leads only."
  }),
  mediaProvider({
    id: "wikipedia-mediawiki",
    name: "Wikipedia/MediaWiki",
    group: "context_discovery",
    homepage: "https://www.wikipedia.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "creative_commons",
    notes: "Context and media leads; verify original Commons/source files.",
    setupInstructions: "Use as discovery-only; import from original licensed source."
  }),
  mediaProvider({
    id: "open-library",
    name: "Open Library",
    group: "context_discovery",
    homepage: "https://openlibrary.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "unknown",
    defaultLicenseStatus: "unknown",
    notes: "Book/reference discovery; do not import copyrighted pages automatically.",
    setupInstructions: "Use for context and leads only."
  }),
  mediaProvider({
    id: "gdelt-news-discovery",
    name: "GDELT News Discovery",
    group: "context_discovery",
    homepage: "https://www.gdeltproject.org",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "editorial_only",
    defaultLicenseStatus: "editorial_only",
    notes: "News/source discovery only; articles are not media assets.",
    setupInstructions: "Use as source leads; do not scrape/paywall/login."
  }),
  mediaProvider({
    id: "youtube-discovery",
    name: "YouTube Discovery",
    group: "context_discovery",
    homepage: "https://www.youtube.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: false,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "restricted",
    defaultLicenseStatus: "restricted",
    notes: "Discovery-only for references/highlights. No automatic downloads.",
    setupInstructions: "Set a future YOUTUBE_API_KEY only for metadata discovery. User must provide authorized clips."
  }),
  mediaProvider({
    id: "google-assisted-search",
    name: "Google Assisted Search",
    group: "context_discovery",
    homepage: "https://www.google.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "unknown",
    defaultLicenseStatus: "unknown",
    notes: "Assisted search leads only; no scraping or automatic import.",
    setupInstructions: "Use only if a future configured search key exists; user reviews every result."
  }),
  mediaProvider({
    id: "reddit-discovery",
    name: "Reddit Discovery",
    group: "context_discovery",
    homepage: "https://www.reddit.com",
    requiresApiKey: true,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "restricted",
    defaultLicenseStatus: "restricted",
    notes: "Community leads only; do not scrape or import user content automatically.",
    setupInstructions: "Use only as discovery leads with explicit user review."
  }),
  mediaProvider({
    id: "forum-discovery",
    name: "Forum Discovery",
    group: "context_discovery",
    homepage: "https://www.google.com/search?q=forum",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: true,
    importSupported: false,
    defaultRiskLevel: "restricted",
    defaultLicenseStatus: "restricted",
    notes: "Forum leads only; no scraping, login bypass or automatic media import.",
    setupInstructions: "User must manually review and supply authorized files."
  }),
  mediaProvider({
    id: "manual-url",
    name: "Manual URL",
    group: "internal",
    homepage: "manual://url",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: false,
    discoveryOnly: false,
    importSupported: false,
    defaultRiskLevel: "unknown",
    defaultLicenseStatus: "local_user_review",
    notes: "User-provided URL candidate; still requires explicit review/import.",
    setupInstructions: "Paste URL manually and confirm rights before use."
  }),
  mediaProvider({
    id: "local-library",
    name: "Local Library",
    group: "internal",
    homepage: "local://assets",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "local_user_review",
    notes: "Already local assets; still show license/risk metadata.",
    setupInstructions: "Review local asset metadata before assigning."
  }),
  mediaProvider({
    id: "manual-intake",
    name: "Manual Intake",
    group: "internal",
    homepage: "local://storage/inbox",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "local_user_review",
    notes: "Inbox/manual upload candidate flow.",
    setupInstructions: "Place files in storage/inbox and approve candidates manually."
  }),
  mediaProvider({
    id: "media-collector",
    name: "Media Collector",
    group: "internal",
    homepage: "local://media-collector",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsDocuments: true,
    supportsData: true,
    supportsLicenseMetadata: true,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "medium",
    defaultLicenseStatus: "local_user_review",
    notes: "Existing local/manual media collector flow.",
    setupInstructions: "Use approved local candidates only."
  }),
  mediaProvider({
    id: "comfyui-generated-fallback",
    name: "ComfyUI Generated Fallback",
    group: "internal",
    homepage: "local://comfyui",
    requiresApiKey: false,
    freeTierAvailable: true,
    supportsImage: true,
    supportsVideo: false,
    supportsAudio: false,
    supportsDocuments: false,
    supportsData: false,
    supportsLicenseMetadata: false,
    discoveryOnly: false,
    importSupported: true,
    defaultRiskLevel: "low",
    defaultLicenseStatus: "local_user_review",
    notes: "Fallback generated visual when no reviewed media candidate is available.",
    setupInstructions: "Generate locally; no external media download."
  })
];

const discoveryProviderById = new Map(
  discoveryMediaProviders.map((provider) => [provider.id, provider])
);

function sourcePack(input: DiscoverySourcePack): DiscoverySourcePack {
  return input;
}

const sourcePacks: DiscoverySourcePack[] = [
  sourcePack({
    id: "football_source_pack",
    name: "Football Source Pack",
    description: "Football context, local highlights and safe b-roll/data leads.",
    recommendedForNiches: ["football"],
    primaryProviderIds: [
      "local-library",
      "manual-intake",
      "media-collector",
      "wikimedia-commons",
      "statsbomb-open-data",
      "football-data-org",
      "youtube-discovery"
    ],
    fallbackProviderIds: ["pexels", "pixabay", "google-assisted-search", "comfyui-generated-fallback"],
    blockedAutoImportProviderIds: ["youtube-discovery", "google-assisted-search"],
    notes: ["YouTube and Google are discovery-only; user must supply authorized clips."]
  }),
  sourcePack({
    id: "basketball_source_pack",
    name: "Basketball Source Pack",
    description: "Basketball stats and local clip-first workflow.",
    recommendedForNiches: ["generic"],
    primaryProviderIds: ["local-library", "manual-intake", "balldontlie", "thesportsdb", "youtube-discovery"],
    fallbackProviderIds: ["pexels", "pixabay", "comfyui-generated-fallback"],
    blockedAutoImportProviderIds: ["youtube-discovery", "thesportsdb"],
    notes: ["Data providers create stat/context candidates, not media downloads."]
  }),
  sourcePack({
    id: "true_crime_source_pack",
    name: "True Crime Source Pack",
    description: "Documents, newspapers, maps and cautious public archive leads.",
    recommendedForNiches: ["true_crime", "mystery"],
    primaryProviderIds: [
      "chronicling-america",
      "library-of-congress",
      "national-archives",
      "internet-archive",
      "wikidata",
      "wikipedia-mediawiki"
    ],
    fallbackProviderIds: ["dpla", "nypl-digital-collections", "manual-url", "comfyui-generated-fallback"],
    blockedAutoImportProviderIds: ["gdelt-news-discovery", "reddit-discovery", "forum-discovery"],
    notes: ["Keep allegations clearly marked; do not discard restricted/unknown candidates automatically."]
  }),
  sourcePack({
    id: "comics_anime_source_pack",
    name: "Comics/Anime Source Pack",
    description: "Public-domain comics, metadata leads and generated fallback.",
    recommendedForNiches: ["comics", "anime"],
    primaryProviderIds: [
      "digital-comic-museum",
      "grand-comics-database",
      "project-gutenberg",
      "gutendex",
      "local-library",
      "manual-intake"
    ],
    fallbackProviderIds: ["wikimedia-commons", "comfyui-generated-fallback", "manual-url"],
    blockedAutoImportProviderIds: ["grand-comics-database", "manual-url"],
    notes: ["Official panels/frames may be restricted; candidate-first review is mandatory."]
  }),
  sourcePack({
    id: "history_documentary_source_pack",
    name: "History/Documentary Source Pack",
    description: "Archives, museums and open cultural collections.",
    recommendedForNiches: ["history", "documentary"],
    primaryProviderIds: [
      "library-of-congress",
      "national-archives",
      "internet-archive",
      "wikimedia-commons",
      "europeana",
      "smithsonian-open-access",
      "met-museum"
    ],
    fallbackProviderIds: [
      "art-institute-chicago",
      "cleveland-museum-art",
      "rijksmuseum",
      "getty-open-content",
      "public-domain-image-archive"
    ],
    blockedAutoImportProviderIds: ["british-museum-discovery"],
    notes: ["Aggregators and museum collections require per-item rights review."]
  }),
  sourcePack({
    id: "curiosities_science_source_pack",
    name: "Curiosities/Science Source Pack",
    description: "Science, space, weather, earth and museum sources.",
    recommendedForNiches: ["documentary", "mystery", "generic"],
    primaryProviderIds: [
      "nasa-image-video",
      "noaa-digital-collections",
      "usgs-multimedia",
      "science-museum-group",
      "smithsonian-open-access"
    ],
    fallbackProviderIds: ["wikimedia-commons", "internet-archive", "comfyui-generated-fallback"],
    blockedAutoImportProviderIds: [],
    notes: ["Avoid implying institutional endorsement when using public-domain government media."]
  }),
  sourcePack({
    id: "generic_broll_source_pack",
    name: "Generic B-roll Source Pack",
    description: "General b-roll and image search candidates.",
    recommendedForNiches: ["generic", "movies", "games"],
    primaryProviderIds: ["openverse", "wikimedia-commons", "pexels", "pixabay", "unsplash"],
    fallbackProviderIds: ["flickr-creative-commons", "manual-intake", "comfyui-generated-fallback"],
    blockedAutoImportProviderIds: ["google-assisted-search", "youtube-discovery"],
    notes: ["Royalty-free/open-license candidates still require item review."]
  }),
  sourcePack({
    id: "sfx_audio_source_pack",
    name: "SFX/Audio Source Pack",
    description: "Local and open audio/SFX candidate sources.",
    recommendedForNiches: ["football", "true_crime", "mystery", "documentary", "generic"],
    primaryProviderIds: ["local-library", "manual-intake", "freesound", "pixabay-music-sfx", "openverse-audio"],
    fallbackProviderIds: ["wikimedia-audio", "internet-archive-audio"],
    blockedAutoImportProviderIds: [],
    notes: ["Audio licenses vary; attribution and commercial-use status must be reviewed."]
  })
];

const sourcePackById = new Map(sourcePacks.map((pack) => [pack.id, pack]));

const genericSafetyRules = [
  "Tratar toda midia candidata como pendente ate revisao do usuario.",
  "Nunca baixar automaticamente; criar apenas candidatos e avisos.",
  "Sinalizar licenca desconhecida sem descartar automaticamente."
];

const profiles: Record<ProductionDiscoveryNiche, NicheProfile> = {
  football: {
    id: "football",
    name: "Football",
    description: "Analises de jogadores, times, taticas e momentos de jogo.",
    defaultTemplates: ["player_threat_analysis", "rivalry_breakdown"],
    defaultTone: "hype",
    defaultStructure: ["hook", "context", "threat", "weakness", "climax", "cta"],
    researchFocus: ["estatisticas", "momento atual", "pontos fortes", "pontos fracos", "contexto do confronto"],
    entityTypes: ["player", "team", "match", "competition", "tactic", "stadium"],
    mediaNeeds: ["portrait", "stadium", "tactical_card", "microclip", "generated_image", "crowd", "stat_card"],
    sourceSuggestions: ["biblioteca local", "Wikimedia", "press kit autorizado", "microclips locais/autorizados"],
    visualStyle: "cortes rapidos, cards taticos, energia alta e microclips de impacto",
    safetyRules: [
      ...genericSafetyRules,
      "Clipes oficiais podem ter restricao; usar apenas material local/autorizado."
    ],
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "football_hype",
    recommendedAudioMasteringPresetId: "football_hype",
    recommendedEditingPresetUseCase: "football_hype",
    defaultSceneRoles: ["hook", "context", "threat", "proof", "climax", "cta"]
  },
  true_crime: {
    id: "true_crime",
    name: "True Crime",
    description: "Dossies factuais, linha do tempo e narrativa documental segura.",
    defaultTemplates: ["documentary_case_file", "mystery_timeline"],
    defaultTone: "dark documentary",
    defaultStructure: ["hook", "case_context", "timeline", "uncertainty", "resolution", "cta"],
    researchFocus: ["timeline", "local", "investigacao", "tribunal", "fontes", "pontos incertos"],
    entityTypes: ["person", "location", "date", "event", "investigation", "court"],
    mediaNeeds: ["map", "document", "archive_photo", "newspaper", "location", "text_card", "generated_image"],
    sourceSuggestions: ["fontes publicas", "arquivos locais", "mapas fornecidos", "documentos autorizados"],
    visualStyle: "baixo contraste, cards documentais, mapas e documentos com cuidado editorial",
    safetyRules: [
      ...genericSafetyRules,
      "Nao glorificar criminosos.",
      "Separar fato confirmado de alegacao.",
      "Evitar detalhes graficos e linguagem sensacionalista."
    ],
    recommendedWorkflowPackId: "true_crime_doc",
    recommendedMusicPresetId: "true_crime_dark",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    recommendedEditingPresetUseCase: "true_crime_dark",
    defaultSceneRoles: ["hook", "context", "timeline", "evidence", "uncertainty", "cta"]
  },
  comics: {
    id: "comics",
    name: "Comics",
    description: "Breakdowns de personagem, origem, poderes, feitos e comparacoes.",
    defaultTemplates: ["character_power_breakdown", "origin_story"],
    defaultTone: "epic analysis",
    defaultStructure: ["hook", "origin", "powers", "feat", "comparison", "cta"],
    researchFocus: ["origem", "poderes", "arcos", "feitos", "rivais", "comparacoes"],
    entityTypes: ["character", "power", "origin", "arc", "feat", "rival"],
    mediaNeeds: ["comic_panel", "generated_image", "power_card", "comparison_card", "visual_proof_insert"],
    sourceSuggestions: ["paineis fornecidos pelo usuario", "assets locais", "imagens geradas"],
    visualStyle: "textura de quadrinho, cards de poder e prova visual revisada",
    safetyRules: [
      ...genericSafetyRules,
      "Paineis oficiais podem ter restricao; revisar antes de importar."
    ],
    recommendedWorkflowPackId: "comic_drama",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "origin", "power", "feat", "comparison", "cta"]
  },
  anime: {
    id: "anime",
    name: "Anime",
    description: "Lore e analise de personagem/arco com assets locais ou gerados.",
    defaultTemplates: ["character_power_breakdown"],
    defaultTone: "dramatic lore",
    defaultStructure: ["hook", "origin", "power", "arc", "climax", "cta"],
    researchFocus: ["origem", "habilidades", "arco", "rival", "transformacao"],
    entityTypes: ["character", "power", "arc", "rival", "form"],
    mediaNeeds: ["generated_image", "character_card", "power_card", "user_panel", "visual_proof_insert"],
    sourceSuggestions: ["assets fornecidos pelo usuario", "imagens geradas", "cards textuais"],
    visualStyle: "contraste dramatico, energia alta e foco em personagem",
    safetyRules: [...genericSafetyRules, "Cenas oficiais devem ser revisadas pelo usuario antes de uso."],
    recommendedWorkflowPackId: "anime_dark",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "origin", "power", "tension", "climax", "cta"]
  },
  movies: {
    id: "movies",
    name: "Movies",
    description: "Analise documental/critica com foco em cenas autorizadas ou geradas.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "cinematic analysis",
    defaultStructure: ["hook", "context", "scene", "meaning", "climax", "cta"],
    researchFocus: ["contexto", "personagens", "temas", "bastidores", "analise de cena"],
    entityTypes: ["movie", "character", "scene", "director", "theme"],
    mediaNeeds: ["generated_image", "poster_card", "scene_reference", "text_card"],
    sourceSuggestions: ["assets locais", "press kit autorizado", "imagens geradas"],
    visualStyle: "cinematico, limpo, com cards de cena",
    safetyRules: [...genericSafetyRules, "Cenas oficiais devem passar por revisao de uso."],
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "context", "analysis", "meaning", "resolution", "cta"]
  },
  games: {
    id: "games",
    name: "Games",
    description: "Lore, mecanicas, personagens e momentos de gameplay autorizados.",
    defaultTemplates: ["character_power_breakdown"],
    defaultTone: "epic gameplay",
    defaultStructure: ["hook", "context", "mechanic", "proof", "climax", "cta"],
    researchFocus: ["lore", "personagens", "mecanicas", "itens", "chefes", "comunidade"],
    entityTypes: ["character", "game", "mechanic", "boss", "item", "map"],
    mediaNeeds: ["game_card", "generated_image", "local_clip", "screenshot", "map"],
    sourceSuggestions: ["screenshots proprios", "clipes locais/autorizados", "imagens geradas"],
    visualStyle: "game epic, HUD cards e cortes energeticos",
    safetyRules: [...genericSafetyRules, "Gameplay de terceiros deve ser autorizado pelo usuario."],
    recommendedWorkflowPackId: "game_epic",
    recommendedMusicPresetId: "viral_fast_cut",
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    recommendedEditingPresetUseCase: "viral_fast_cut",
    defaultSceneRoles: ["hook", "context", "mechanic", "proof", "climax", "cta"]
  },
  history: {
    id: "history",
    name: "History",
    description: "Narrativa historica com mapas, datas, eventos e personagens.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "documentary",
    defaultStructure: ["hook", "context", "timeline", "turning_point", "legacy", "cta"],
    researchFocus: ["datas", "locais", "personagens", "eventos", "fontes primarias"],
    entityTypes: ["person", "location", "date", "event", "document"],
    mediaNeeds: ["map", "document", "archive_photo", "generated_image", "timeline_card"],
    sourceSuggestions: ["Wikimedia", "arquivos publicos", "biblioteca local"],
    visualStyle: "documental escuro, mapas e cards historicos",
    safetyRules: [...genericSafetyRules, "Marcar fonte ausente como incerta."],
    recommendedWorkflowPackId: "history_dark",
    recommendedMusicPresetId: "documentary_clean",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "timeline", "turning_point", "resolution", "cta"]
  },
  mystery: {
    id: "mystery",
    name: "Mystery",
    description: "Misterios, teorias e investigacao leve com cuidado de incerteza.",
    defaultTemplates: ["mystery_timeline"],
    defaultTone: "suspense",
    defaultStructure: ["hook", "clue", "context", "theory", "uncertainty", "cta"],
    researchFocus: ["pistas", "locais", "datas", "teorias", "incertezas"],
    entityTypes: ["event", "location", "person", "clue", "theory"],
    mediaNeeds: ["map", "generated_image", "document", "text_card", "ambient"],
    sourceSuggestions: ["fontes publicas", "assets locais", "imagens geradas"],
    visualStyle: "suspense limpo, pistas e mapas",
    safetyRules: [...genericSafetyRules, "Separar teoria de fato confirmado."],
    recommendedWorkflowPackId: "mystery_doc",
    recommendedMusicPresetId: "true_crime_dark",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    recommendedEditingPresetUseCase: "true_crime_dark",
    defaultSceneRoles: ["hook", "clue", "context", "tension", "uncertainty", "cta"]
  },
  documentary: {
    id: "documentary",
    name: "Documentary",
    description: "Conteudo explicativo limpo, factual e visualmente organizado.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "clean documentary",
    defaultStructure: ["hook", "context", "fact", "development", "resolution", "cta"],
    researchFocus: ["contexto", "dados", "fontes", "personagens", "locais"],
    entityTypes: ["person", "location", "event", "data", "source"],
    mediaNeeds: ["document", "photo", "map", "generated_image", "text_card"],
    sourceSuggestions: ["fontes publicas", "biblioteca local", "Wikimedia"],
    visualStyle: "limpo, editorial, legivel",
    safetyRules: genericSafetyRules,
    recommendedWorkflowPackId: "documentary_clean",
    recommendedMusicPresetId: "documentary_clean",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "fact", "development", "resolution", "cta"]
  },
  generic: {
    id: "generic",
    name: "Generic",
    description: "Descoberta geral para temas ainda sem nicho especifico.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "informative",
    defaultStructure: ["hook", "context", "detail", "tension", "resolution", "cta"],
    researchFocus: ["contexto", "fatos", "entidades", "fontes", "visuais"],
    entityTypes: ["topic", "person", "location", "event"],
    mediaNeeds: ["generated_image", "text_card", "local_asset", "document"],
    sourceSuggestions: ["biblioteca local", "fontes publicas", "imagens geradas"],
    visualStyle: "editorial flexivel",
    safetyRules: genericSafetyRules,
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "shorts_clean_voice",
    recommendedAudioMasteringPresetId: "shorts_clean_voice",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "detail", "tension", "resolution", "cta"]
  }
};

function normalizeNiche(value: string | null | undefined): ProductionDiscoveryNiche {
  const normalized = (value ?? "generic").trim().toLowerCase().replaceAll("-", "_");
  return productionDiscoveryNiches.includes(normalized as ProductionDiscoveryNiche)
    ? (normalized as ProductionDiscoveryNiche)
    : "generic";
}

function cleanText(value: string | null | undefined, fallback: string) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getNicheProfiles() {
  return productionDiscoveryNiches.map((niche) => profiles[niche]);
}

export function getNicheProfileById(id: string | null | undefined) {
  return profiles[normalizeNiche(id)];
}

export function buildNicheResearchQueries(
  input: BuildNicheResearchQueriesInput
): NicheResearchQueries {
  const profile = getNicheProfileById(input.niche);
  const topic = cleanText(input.topic, "tema do video");
  const angle = cleanText(input.angle, profile.defaultTone);
  const language = cleanText(input.language, "pt-BR");

  const researchQueries = unique([
    `${topic} contexto ${language}`,
    `${topic} ${angle}`,
    ...profile.researchFocus.map((focus) => `${topic} ${focus}`),
    ...profile.entityTypes.slice(0, 4).map((entity) => `${topic} ${entity}`)
  ]);

  const mediaQueries = unique([
    ...profile.mediaNeeds.map((need) => `${topic} ${need}`),
    `${topic} visual reference`,
    `${topic} public domain media`,
    `${topic} local authorized asset`
  ]);

  return {
    researchQueries,
    mediaQueries,
    entityQueries: profile.entityTypes.map((entity) => `${topic} ${entity}`),
    sourceDiscoveryLinks: profile.sourceSuggestions.map(
      (source) => `${source}: pesquisar manualmente por "${topic}"`
    ),
    suggestedFactsToFind: profile.researchFocus.map(
      (focus) => `Encontrar ${focus} sobre ${topic}`
    ),
    suggestedMediaToFind: profile.mediaNeeds.map(
      (need) => `Encontrar ${need} para ${topic}`
    )
  };
}

export function buildNicheDossier(input: BuildNicheResearchQueriesInput): NicheDossier {
  const profile = getNicheProfileById(input.niche);
  const topic = cleanText(input.topic, "Tema do video");
  const angle = cleanText(input.angle, profile.defaultTone);
  const language = cleanText(input.language, "pt-BR");

  const outline = profile.defaultSceneRoles.slice(0, 6).map((role, index) => {
    const order = index + 1;
    return {
      order,
      role,
      title: `${role.toUpperCase()}: ${topic}`,
      narrationDraft:
        order === 1
          ? `E se ${topic} for mais importante do que parece?`
          : `Agora olhe para ${topic} pelo angulo: ${angle}.`,
      captionDraft:
        order === 1 ? `${topic}: o ponto que muda tudo` : `${role}: ${angle}`,
      emotion:
        profile.id === "football"
          ? "EPIC"
          : profile.id === "true_crime" || profile.id === "mystery"
            ? "TENSE"
            : "MYSTERIOUS",
      estimatedDuration: order === 1 ? 4 : 6
    };
  });

  return {
    topic,
    niche: profile.id,
    title: `${topic} - ${profile.name}`,
    angle,
    language,
    tone: profile.defaultTone,
    summary: `${profile.name}: pacote deterministico para "${topic}" com foco em ${angle}.`,
    entities: profile.entityTypes.slice(0, 6).map((type) => ({
      type,
      name: `${topic} / ${type}`,
      notes: `Entidade sugerida para pesquisa ${type}.`
    })),
    timeline: profile.defaultStructure.map((step, index) => ({
      order: index + 1,
      title: step,
      description: `Bloco ${index + 1} da narrativa: ${step}.`
    })),
    facts: profile.researchFocus.slice(0, 5).map((focus) => ({
      claim: `Verificar ${focus} sobre ${topic}.`,
      confidence: "uncertain"
    })),
    uncertainties: [
      "Fontes publicas ainda precisam de revisao humana.",
      "Midias candidatas nao devem ser importadas sem confirmacao."
    ],
    editorialSafety: profile.safetyRules,
    outline,
    assetSeeds: profile.mediaNeeds
  };
}

export function buildVisualRequirementsFromDossier(
  dossier: NicheDossier,
  profile: NicheProfile = getNicheProfileById(dossier.niche)
): VisualRequirement[] {
  return dossier.outline.map((scene, index) => {
    const mediaNeed = profile.mediaNeeds[index % profile.mediaNeeds.length] ?? "generated_image";
    const mediaType: VisualRequirementMediaType =
      mediaNeed.includes("microclip") || scene.role.includes("proof")
        ? "microclip"
        : mediaNeed.includes("map")
          ? "map"
          : mediaNeed.includes("document") || mediaNeed.includes("newspaper")
            ? "document"
            : mediaNeed.includes("card")
              ? "card"
              : "generated_image";

    return {
      id: `req-${dossier.niche}-${scene.order}`,
      sceneOrder: scene.order,
      role: scene.role,
      narrationGoal: scene.narrationDraft,
      visualNeedDescription: `${mediaNeed} para ${scene.title}`,
      mediaType,
      suggestedQueries: unique([
        `${dossier.topic} ${mediaNeed}`,
        `${dossier.topic} ${scene.role}`,
        `${dossier.topic} ${profile.visualStyle}`
      ]),
      suggestedTags: unique([dossier.niche, scene.role, mediaNeed, ...profile.entityTypes.slice(0, 2)]),
      fallbackStrategy:
        mediaType === "microclip" ? "media_candidate" : "generated_image",
      importance: scene.order <= 2 ? "must_have" : scene.role === "cta" ? "medium" : "high",
      requiresUserReview: mediaType !== "generated_image"
    };
  });
}

export function buildDiscoveryTitle(topic: string, profile: NicheProfile) {
  return `${cleanText(topic, "Novo Reel")} (${profile.name})`;
}

export function buildDiscoveryWarnings(profile: NicheProfile) {
  return [
    ...profile.safetyRules,
    "Candidate-first ativo: search cria candidato, importacao exige acao do usuario."
  ];
}

export function getDiscoveryMediaProviders() {
  return discoveryMediaProviders;
}

export function getDiscoveryMediaProviderById(id: string | null | undefined) {
  return id ? discoveryProviderById.get(id) ?? null : null;
}

export function getDiscoverySourcePacks() {
  return sourcePacks;
}

export function getDiscoverySourcePackById(id: string | null | undefined) {
  return id ? sourcePackById.get(id) ?? null : null;
}

export function getSourcePacksForNiche(niche: string | null | undefined) {
  const normalized = normalizeNiche(niche);
  const matching = sourcePacks.filter((pack) =>
    pack.recommendedForNiches.includes(normalized)
  );

  return matching.length > 0
    ? matching
    : sourcePacks.filter((pack) => pack.id === "generic_broll_source_pack");
}

function providerSupportsRequirement(
  provider: DiscoveryMediaProvider,
  mediaType: VisualRequirementMediaType | string | undefined
) {
  switch (mediaType) {
    case "video":
    case "microclip":
      return provider.supportsVideo;
    case "sfx":
      return provider.supportsAudio;
    case "document":
    case "map":
      return provider.supportsDocuments || provider.supportsData || provider.supportsImage;
    case "card":
      return provider.supportsData || provider.supportsDocuments || provider.supportsImage;
    case "image":
    case "generated_image":
    default:
      return provider.supportsImage || provider.id === "comfyui-generated-fallback";
  }
}

function candidateWarning(provider: DiscoveryMediaProvider) {
  if (provider.discoveryOnly) {
    return "Discovery-only: criar candidato/referencia, sem import automatico.";
  }

  if (provider.requiresApiKey) {
    return "Provider exige chave gratuita/configuracao; manter disabled/not configured ate existir key.";
  }

  if (
    provider.defaultRiskLevel === "unknown" ||
    provider.defaultRiskLevel === "editorial_only" ||
    provider.defaultRiskLevel === "restricted" ||
    provider.defaultLicenseStatus === "unknown" ||
    provider.defaultLicenseStatus === "editorial_only" ||
    provider.defaultLicenseStatus === "restricted"
  ) {
    return "Licenca/risco exige revisao humana antes de qualquer importacao.";
  }

  return null;
}

export function buildCandidateProviderPlan(input: {
  niche: string;
  requirement?: Pick<VisualRequirement, "mediaType" | "importance"> | null;
  sourcePackId?: string | null;
  limit?: number | null;
}): CandidateProviderPlan[] {
  const sourcePack =
    getDiscoverySourcePackById(input.sourcePackId) ??
    getSourcePacksForNiche(input.niche)[0] ??
    getDiscoverySourcePackById("generic_broll_source_pack");

  if (!sourcePack) {
    return [];
  }

  const providerIds = unique([
    ...sourcePack.primaryProviderIds,
    ...sourcePack.fallbackProviderIds
  ]);
  const providers = providerIds
    .map((providerId) => getDiscoveryMediaProviderById(providerId))
    .filter((provider): provider is DiscoveryMediaProvider => Boolean(provider))
    .filter((provider) =>
      providerSupportsRequirement(provider, input.requirement?.mediaType)
    );
  const limitedProviders = providers.slice(0, Math.max(input.limit ?? 3, 1));

  return limitedProviders.map((provider, index) => {
    const supportsLicense = provider.supportsLicenseMetadata ? 8 : 0;
    const importPenalty = provider.importSupported && !provider.discoveryOnly ? 0 : -6;
    const apiPenalty = provider.requiresApiKey ? -5 : 0;
    const riskPenalty =
      provider.defaultRiskLevel === "low"
        ? 8
        : provider.defaultRiskLevel === "medium"
          ? 2
          : -8;
    const importanceBoost = input.requirement?.importance === "must_have" ? 4 : 0;
    const score = Math.max(
      10,
      Math.min(100, 88 - index * 7 + supportsLicense + importPenalty + apiPenalty + riskPenalty + importanceBoost)
    );

    return {
      providerId: provider.id,
      providerName: provider.name,
      sourcePackId: sourcePack.id,
      discoveryOnly: provider.discoveryOnly,
      importSupported: provider.importSupported,
      requiresApiKey: provider.requiresApiKey,
      enabledByDefault: !provider.requiresApiKey,
      defaultRiskLevel: provider.defaultRiskLevel,
      defaultLicenseStatus: provider.defaultLicenseStatus,
      score,
      reason: `${provider.name} combina com ${sourcePack.name} e suporta ${input.requirement?.mediaType ?? "media"}.`,
      warning: candidateWarning(provider),
      previewUrl: provider.homepage.startsWith("http") ? provider.homepage : null,
      sourceUrl: provider.homepage
    };
  });
}
