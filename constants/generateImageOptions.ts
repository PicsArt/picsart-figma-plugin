export const STYLE_OPTIONS = [
  "Portrait",
  "Nature Photography", 
  "Black and White",
  "Digital painting",
  "Octane render",
  "Concept art",
  "Steampunk",
  "Cyberpunk",
  "Neon colors",
  "Holographic",
  "Hyperrealism",
  "Etching",
  "Ink illustration",
  "Graphite Pencil",
  "Doodle",
  "Oil Painting",
  "Pop Art",
  "Watercolor",
  "Aquarelle",
  "Futurism",
  "Sci-Fi",
  "Psychedelic",
  "Fantasy",
  "Anime",
  "Anime Character",
  "Anime 2",
  "Manga",
  "Low poly",
  "Isometric"
] as const;

export const ASPECT_RATIO_OPTIONS = [
  "Square",
  "Portrait", 
  "Landscape",
  "Wide Screen",
  "Story",
  "Banner"
] as const;

export const ASPECT_RATIO_DIMENSIONS = {
  "Square": { width: 1024, height: 1024 },      // 1:1
  "Portrait": { width: 768, height: 1024 },     // 3:4
  "Landscape": { width: 1024, height: 768 },    // 4:3
  "Wide Screen": { width: 1280, height: 720 },  // 16:9
  "Story": { width: 720, height: 1280 },        // 9:16
  "Banner": { width: 1536, height: 512 }        // 3:1
} as const;

export const PRESET_TAGS = [
  "Ads", 
  "Landscape"
] as const;

export const DEFAULT_STYLE = "Pop Art" as const;
export const DEFAULT_ASPECT_RATIO = "Square" as const;
export const DEFAULT_NEGATIVE_PROMPT = "" as const;
export const DEFAULT_IMAGE_COUNT = 2 as const; 