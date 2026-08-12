export const STYLE_OPTIONS = [
  "None",
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

export const DEFAULT_STYLE = "None" as const;
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
  { label: "Flux 2 Klein", value: "urn:air:picsart:model:picsart:flux-2-klein@1" },
  { label: "GPT Image 1", value: "urn:air:openai:model:openai:gpt-image-1@1" },
  { label: "GPT Image 1.5", value: "urn:air:openai:model:openai:gpt-image-1.5@1" },
  { label: "GPT Image 2", value: "urn:air:openai:model:openai:gpt-image-2@1" },
  { label: "Gemini 2.5 Flash Image", value: "urn:air:google:model:google:gemini-2.5-flash-image@1" },
  { label: "Gemini 3 Pro Image", value: "urn:air:google:model:google:gemini-3-pro-image@1" },
  { label: "Gemini 3 Pro Image (Preview)", value: "urn:air:google:model:google:gemini-3-pro-image-preview@1" },
  { label: "Gemini 3.1 Flash Image", value: "urn:air:google:model:google:gemini-3.1-flash-image@1" },
  { label: "Gemini 3.1 Flash Image (Preview)", value: "urn:air:google:model:google:gemini-3.1-flash-image-preview@1" },
  { label: "Gemini 3.1 Flash Lite Image", value: "urn:air:google:model:google:gemini-3.1-flash-lite-image@1" },
  { label: "Imagen 4.0", value: "urn:air:google:model:google:imagen-4.0-generate-001@1" },
  { label: "Imagen 4.0 Ultra", value: "urn:air:google:model:google:imagen-4.0-ultra-generate-001@1" },
  { label: "Imagen 4.0 Fast", value: "urn:air:google:model:google:imagen-4.0-fast-generate-001@1" },
  { label: "Seedream 4.0", value: "urn:air:seedream:model:seedream:seedream@4.0" },
  { label: "Seedream 4.5", value: "urn:air:seedream:model:seedream:seedream@4.5" },
  { label: "Seedream 5.0 Lite", value: "urn:air:seedream:model:seedream:seedream@5.0-lite" },
  { label: "Seedream 5.0 Pro", value: "urn:air:seedream:model:seedream:seedream@5.0-pro" },
  { label: "Ideogram 2", value: "urn:air:ideogram:model:ideogram:ideogram@2" },
  { label: "Ideogram Turbo 2", value: "urn:air:ideogram:model:ideogram:ideogram-turbo@2" },
  { label: "Ideogram 2a", value: "urn:air:ideogram:model:ideogram:ideogram-2a@1" },
  { label: "Ideogram 2a Turbo", value: "urn:air:ideogram:model:ideogram:ideogram-2a-turbo@1" },
  { label: "Ideogram 3", value: "urn:air:ideogram:model:ideogram:ideogram@3" },
  { label: "Ideogram 4", value: "urn:air:ideogram:model:ideogram:ideogram@4" },
  { label: "Ideogram Turbo 4", value: "urn:air:ideogram:model:ideogram:ideogram-turbo@4" },
  { label: "P Image Very Low", value: "urn:air:ideogram:model:ideogram:p-image-very-low@1" },
  { label: "P Image Low", value: "urn:air:ideogram:model:ideogram:p-image-low@1" },
  { label: "P Image Medium", value: "urn:air:ideogram:model:ideogram:p-image-medium@1" },
  { label: "P Image High", value: "urn:air:ideogram:model:ideogram:p-image-high@1" },
  { label: "Recraft v2", value: "urn:air:recraft:model:recraft:recraftv2@1" },
  { label: "Recraft v3", value: "urn:air:recraft:model:recraft:recraftv3@1" },
  { label: "Recraft v4", value: "urn:air:recraft:model:recraft:recraftv4@1" },
  { label: "Recraft v4 Pro", value: "urn:air:recraft:model:recraft:recraftv4_pro@1" },
  { label: "Recraft v4.1", value: "urn:air:recraft:model:recraft:recraftv4_1@1" },
  { label: "Recraft v4.1 Pro", value: "urn:air:recraft:model:recraft:recraftv4_1_pro@1" },
  { label: "Recraft v4.1 Utility", value: "urn:air:recraft:model:recraft:recraftv4_1_utility@1" },
  { label: "Recraft v4.1 Utility Pro", value: "urn:air:recraft:model:recraft:recraftv4_1_utility_pro@1" },
  { label: "Qwen Image 2.5", value: "urn:air:qwen:model:qwen:qwen-image-2.5@1" },
  { label: "Qwen Image 2", value: "urn:air:qwen:model:qwen:qwen-image-2@1" },
  { label: "Qwen Image 2.0 Pro", value: "urn:air:qwen:model:qwen:qwen-image-2.0-pro@1" },
  { label: "Qwen Image 3.0", value: "urn:air:qwen:model:qwen:qwen-image-3.0@1" },
  { label: "Sana Sprint V1", value: "urn:air:picsart:model:picsart:sana-sprint-v1@1" },
  { label: "Grok Imagine Image", value: "urn:air:xai:model:xai:grok-imagine-image@1" },
  { label: "Grok Imagine Image Quality", value: "urn:air:xai:model:xai:grok-imagine-image-quality@1" },
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

export const EDIT_IMAGE_MODEL_OPTIONS: SelectOption[] = [
  { label: "Default", value: "" },
  { label: "Flux Kontext Max", value: "urn:air:sdxl:model:fluxai:flux_kontext_max@1" },
  { label: "Flux Kontext Pro", value: "urn:air:sdxl:model:fluxai:flux_kontext_pro@1" },
  { label: "Flux 2 Flex", value: "urn:air:fluxai:model:fluxai:flux-2-flex@1" },
  { label: "Flux 2 Pro", value: "urn:air:fluxai:model:fluxai:flux-2-pro@1" },
  { label: "Flux 2 Max", value: "urn:air:fluxai:model:fluxai:flux-2-max@1" },
  { label: "Flux 2 Pro (Preview)", value: "urn:air:fluxai:model:fluxai:flux-2-pro-preview@1" },
  { label: "Seedream 4.0", value: "urn:air:seedream:model:seedream:seedream@4.0" },
  { label: "Seedream 4.5", value: "urn:air:seedream:model:seedream:seedream@4.5" },
  { label: "Seedream 5.0 Lite", value: "urn:air:seedream:model:seedream:seedream@5.0-lite" },
  { label: "Seedream 5.0 Pro", value: "urn:air:seedream:model:seedream:seedream@5.0-pro" },
  { label: "Gemini 2.5 Flash Image", value: "urn:air:google:model:google:gemini-2.5-flash-image@1" },
  { label: "Gemini 3 Pro Image", value: "urn:air:google:model:google:gemini-3-pro-image@1" },
  { label: "Gemini 3 Pro Image (Preview)", value: "urn:air:google:model:google:gemini-3-pro-image-preview@1" },
  { label: "Gemini 3.1 Flash Image", value: "urn:air:google:model:google:gemini-3.1-flash-image@1" },
  { label: "Gemini 3.1 Flash Image (Preview)", value: "urn:air:google:model:google:gemini-3.1-flash-image-preview@1" },
  { label: "Gemini 3.1 Flash Lite Image", value: "urn:air:google:model:google:gemini-3.1-flash-lite-image@1" },
  { label: "GPT Image 1", value: "urn:air:openai:model:openai:gpt-image-1@1" },
  { label: "Reve Edit", value: "urn:air:reve:model:reve:reve-edit@1" },
  { label: "Runway Gen-4 Image Ref", value: "urn:air:runway:model:runway:gen4-image-ref@1" },
  { label: "Qwen Image", value: "urn:air:qwen:model:qwen:qwen-image@1" },
  { label: "Qwen Image Edit Plus", value: "urn:air:qwen:model:qwen:qwen-image-edit-plus@1" },
  { label: "Qwen Image Edit", value: "urn:air:picsart:model:picsart:qwen-image-edit@1" },
  { label: "Grok Imagine Image Edit", value: "urn:air:xai:model:xai:grok-imagine-image-edit@1" },
  { label: "Kling V2", value: "urn:air:kling:model:kling:kling-v2@1" },
  { label: "Kling V2 New", value: "urn:air:kling:model:kling:kling-v2-new@1" },
  { label: "Kling V1.5", value: "urn:air:kling:model:kling:kling-v1-5@1" },
  { label: "Kling V3", value: "urn:air:kling:model:kling:kling-v3@1" },
  { label: "Kling Image O1", value: "urn:air:kling:model:kling:kling-image-o1@1" },
  { label: "Kling V3 Omni", value: "urn:air:kling:model:kling:kling-v3-omni@1" },
];

export const DEFAULT_EDIT_IMAGE_MODEL = "" as const;

export const EDIT_IMAGE_COUNT_OPTIONS = [1, 2, 3, 4] as const;
export const DEFAULT_EDIT_IMAGE_COUNT = 2 as const;

export const EDIT_IMAGE_FORMAT_OPTIONS: SelectOption[] = [
  { label: "PNG (keeps transparency)", value: "PNG" },
  { label: "JPG (smaller file)", value: "JPG" },
];
export const DEFAULT_EDIT_IMAGE_FORMAT = "PNG" as const;

export const EDIT_PROMPT_STARTERS: SelectOption[] = [
  { label: "Change background", value: "Change the background to a sunlit beach" },
  { label: "Change colour", value: "Make the main subject blue" },
  { label: "Add an object", value: "Add a pair of sunglasses to the subject" },
  { label: "Restyle", value: "Redraw this in a flat vector illustration style" },
];
