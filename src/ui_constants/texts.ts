// Copy that names the CONSEQUENCE, not the state.
//
// "Firstly, select the image" / "The image is selected" both reported a fact and left
// the user to infer what the button would do with it. On Generate Image that inference
// is the difference between two endpoints with different prices, so the banner now
// says what happens next rather than what is true.
export const SELECT_IMAGE = "Select a layer to enhance it" as const
export const IMAGE_SELECTED = "Ready — this layer will be used" as const
// The banner had two states for four situations. These are the missing two.
// "Checking" covers the gap between the UI mounting and the sandbox's first
// report 400ms later, during which the old banner asserted nothing was selected
// even with an image selected.
export const SELECTION_CHECKING = "Checking your selection…" as const
// Shown when a layer IS selected but carries no image. The old copy said
// "Firstly, select the image" to someone who had just selected a layer, which
// reads as the plugin being broken rather than as a wrong layer type.
export const SELECTION_NO_IMAGE = "That layer has no image in it. Pick an image, a shape with an image fill, or a frame containing one." as const
// Only the first selected layer is used, so multi-select has to say which one.
export const selectionMultiNote = (name: string, count: number) =>
  `Using “${name}” — the first of ${count} selected layers.`

// Generate Image, where the banner stops being a precondition warning and becomes
// the mode indicator. These four strings are the only place a user learns that
// selecting a layer changed which endpoint their credits go to — and each names the
// consequence, because "no image selected" does not tell anyone they are about to
// buy a text-to-image generation.
export const EDIT_MODE_READY = "Editing this layer" as const
export const EDIT_MODE_EMPTY = "Nothing selected — a new image will be created from your text" as const
export const EDIT_MODE_NO_IMAGE =
  "That layer has no image in it, so a new image will be created from your text instead" as const

// Edit mode relabels the prompt controls, because "describe your image" is exactly
// the wrong instruction: the model already has the image. Getting a description
// where an instruction belongs is the main failure mode of image-to-image.
export const EDIT_PROMPT_LABEL = "Describe your edit" as const
export const EDIT_PROMPT_TITLE = "Say what to change about the selected image" as const
export const EDIT_PROMPT_TOOLTIP =
  "Give an instruction, not a description. “Make the sky stormy”, not “a stormy sky”." as const
export const EDIT_PROMPT_PLACEHOLDER =
  "Example: change the background to a beach at sunset" as const
export const GENERATE_PROMPT_LABEL = "Describe your image" as const
export const GENERATE_PROMPT_TITLE = "Write a detailed description of what you want to generate" as const
export const GENERATE_PROMPT_TOOLTIP = "Describe your idea — an object, a location, a colour." as const
export const GENERATE_PROMPT_PLACEHOLDER =
  "Example: Kangaroo carrying a corgi in cartoon style" as const

// Loading copy, advancing rather than a single frozen line. A 10-60 second paid job
// behind an unlabelled scrim tells the user nothing about whether it is still alive.
export const LOADING_UPLOADING = "Uploading your image…" as const
export const LOADING_EDITING = "Editing… this can take up to a minute" as const
export const LOADING_GENERATING = "Generating… this can take up to a minute" as const
export const LOADING_PLACING = "Placing results…" as const

// Shown after a run finishes, in place of a panel that is byte-identical to before.
// Without it the prompt and an enabled button sit there exactly as they did, which
// is a duplicate-charge trap: nothing distinguishes "not run yet" from "just ran".
export const editRunSummary = (count: number) =>
  `Placed ${count} ${count === 1 ? "candidate" : "candidates"} beside your layer. Edit the instruction to try again.`
export const generateRunSummary = (count: number) =>
  `Added ${count} ${count === 1 ? "image" : "images"} to the canvas. Change the prompt to generate more.`
export const INSUFFICIENT_CREDITS = "Insufficient credits" as const
export const OFFLINE_WARNING = "You seem to be offline. Please check your connection." as const

// Tabs
// REMOVE_BG_TAB, UPSCALE_TAB and TEXT_TO_IMAGE_TAB used to live here. They restated
// the TabType values as separate string literals, so the tab name existed twice and
// TEXT_TO_IMAGE_TAB had already drifted to "Generate Image" while TabType said
// "Generate image". Navbar renders TabType directly now — the enum is the label.

// btn Texts
export const REMOVE_BG_BTN_TEXT = "Remove Background" as const 
export const REMOVE_BG_NO_CREDITS_BTN_TEXT = "Add Credits & Remove Background" as const 
export const UPSCALE_BTN_TEXT = "Upscale" as const 
export const UPSCALE_NO_CREDITS_BTN_TEXT = "Add credits & Upscale" as const 
export const GENERATE_IMAGE_BTN_TEXT = "Create image" as const
export const GENERATE_IMAGE_NO_CREDITS_BTN_TEXT = "Add credits & Create image" as const
// The button label is the second place a user learns which endpoint their credits are
// about to go to. "Create image" for a request that edits the layer they selected
// would be the panel telling them the wrong thing at the moment of spending.
export const EDIT_IMAGE_BTN_TEXT = "Edit image" as const
export const EDIT_IMAGE_NO_CREDITS_BTN_TEXT = "Add credits & Edit image" as const
export const CONTINUE_BTN_TEXT = "Continue" as const 
export const CHANGE_KEY_BTN_TEXT = "Change API Key" as const 
export const BUY_MORE_BTN_TEXT = "Buy more credits" as const 
export const GET_NEW_KEY_BTN_TEXT = "Set new API key" as const 
export const SUBMIT_KEY_BTN_TEXT = "Submit" as const 
export const ADD_CREDITS_BTN_TEXT = "Add Credits" as const 
