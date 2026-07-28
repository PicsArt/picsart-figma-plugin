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

// A labeled option for a <select> where the displayed text differs from the
// value sent to the API. Shared by the advanced-settings option lists.
export interface SelectOption {
  label: string;
  value: string;
}

export const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const TEXT2IMAGE_MODEL_OPTIONS: SelectOption[] = [
  { label: "Default", value: "" },
  { label: "Flux Kontext Max", value: "urn:air:sdxl:model:fluxai:flux_kontext_max@1" },
  { label: "Flux Kontext Pro", value: "urn:air:sdxl:model:fluxai:flux_kontext_pro@1" },
  { label: "Flux 2 Flex", value: "urn:air:fluxai:model:fluxai:flux-2-flex@1" },
  { label: "Flux 2 Pro", value: "urn:air:fluxai:model:fluxai:flux-2-pro@1" },
  { label: "Flux 2 Max", value: "urn:air:fluxai:model:fluxai:flux-2-max@1" },
  { label: "Flux 2 Pro (Preview)", value: "urn:air:fluxai:model:fluxai:flux-2-pro-preview@1" },
  { label: "DALL·E 3", value: "urn:air:openai:model:openai:dall-e-3@1" },
  { label: "GPT Image 1", value: "urn:air:openai:model:openai:gpt-image-1@1" },
  { label: "GPT Image 1.5", value: "urn:air:openai:model:openai:gpt-image-1.5@1" },
  { label: "Gemini 2.5 Flash Image", value: "urn:air:google:model:google:gemini-2.5-flash-image@1" },
  { label: "Gemini 3 Pro Image", value: "urn:air:google:model:google:gemini-3-pro-image@1" },
  { label: "Gemini 3.1 Flash Image", value: "urn:air:google:model:google:gemini-3.1-flash-image@1" },
  { label: "Seedream 4.0", value: "urn:air:seedream:model:seedream:seedream@4.0" },
  { label: "Seedream 4.5", value: "urn:air:seedream:model:seedream:seedream@4.5" },
  { label: "Seedream 5.0 Lite", value: "urn:air:seedream:model:seedream:seedream@5.0-lite" },
  { label: "Imagen 4.0", value: "urn:air:google:model:google:imagen-4.0-generate-001@1" },
  { label: "Imagen 4.0 Ultra", value: "urn:air:google:model:google:imagen-4.0-ultra-generate-001@1" },
  { label: "Imagen 4.0 Fast", value: "urn:air:google:model:google:imagen-4.0-fast-generate-001@1" },
  { label: "Ideogram 1", value: "urn:air:ideogram:model:ideogram:ideogram@1" },
  { label: "Ideogram 2", value: "urn:air:ideogram:model:ideogram:ideogram@2" },
  { label: "Ideogram Turbo 1", value: "urn:air:ideogram:model:ideogram:ideogram-turbo@1" },
  { label: "Ideogram Turbo 2", value: "urn:air:ideogram:model:ideogram:ideogram-turbo@2" },
  { label: "Ideogram 2a", value: "urn:air:ideogram:model:ideogram:ideogram-2a@1" },
  { label: "Ideogram 2a Turbo", value: "urn:air:ideogram:model:ideogram:ideogram-2a-turbo@1" },
  { label: "Ideogram 3", value: "urn:air:ideogram:model:ideogram:ideogram@3" },
  { label: "Qwen Image 2.5", value: "urn:air:qwen:model:qwen:qwen-image-2.5@1" },
  { label: "Reve", value: "urn:air:reve:model:reve:reve@1" },
  { label: "Hunyuan Image 3", value: "urn:air:hunyuan:model:hunyuan:hunyuan-image@3" },
  { label: "Runway Gen-4 Image Ref", value: "urn:air:runway:model:runway:gen4-image-ref@1" },
  { label: "Kling V1.5", value: "urn:air:kling:model:kling:kling-v1-5@1" },
  { label: "Kling V2", value: "urn:air:kling:model:kling:kling-v2@1" },
  { label: "Kling V2.1", value: "urn:air:kling:model:kling:kling-v2-1@1" },
  { label: "Kling V3", value: "urn:air:kling:model:kling:kling-v3@1" },
  { label: "Kling V3 Omni", value: "urn:air:kling:model:kling:kling-v3-omni@1" },
  { label: "Kling Image O1", value: "urn:air:kling:model:kling:kling-image-o1@1" },
];

export const DEFAULT_TEXT2IMAGE_MODEL = "" as const;
