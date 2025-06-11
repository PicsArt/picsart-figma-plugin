export const PROMPT_EXAMPLES = [
  "A futuristic cityscape with towering skyscrapers, flying cars, and neon lights. The streets are bustling with people, and the buildings are sleek and metallic.",
  
  "An illustration of a hot air balloon in the center of a vibrant, crowded lantern festival, with vividly colored lanterns and banners decorating the scene.",
  
  "A whimsical scene of a fairy tale kingdom, with a grand castle, a moat, and a drawbridge. The landscape is lush, with a sparkling river and a magical forest. In the distance, you can see a mountain range with snow-capped peaks.",
  
  "A cozy cabin in the woods, with a roaring fire in the stone fireplace, and a few board games on a wooden table. The windows are foggy, and you can hear the sound of rain tapping on the roof.",
  
  "A lively city street at night, with tall buildings lit up with neon lights, bustling crowds, and street vendors selling delicious food. You can see a city skyline in the distance, and a sense of excitement and energy permeates the air.",
  
  "A serene winter scene with a snow-covered cabin, surrounded by tall pine trees, and a frozen lake. The sky is a pale blue, and the air is crisp and cold. Smoke rises from the chimney, and you can imagine the warmth and comfort inside.",
  
  "An otherworldly scene of an alien planet with purple and green skies, with strange rock formations and flora. In the distance, you can see a futuristic city with towering buildings, hovering vehicles, and neon lights.",
  
  "A magical, otherworldly forest with pastel-colored trees, glowing mushrooms, and a cast of fantastical creatures.",
  
  "An abstract, dreamlike scene with a watercolor background, featuring swirls of vibrant colors, soft edges, and an overall sense of creativity and imagination."
] as const;

export const getNextPromptExample = (currentIndex: number): { prompt: string; nextIndex: number } => {
  const nextIndex = (currentIndex + 1) % PROMPT_EXAMPLES.length;
  return {
    prompt: PROMPT_EXAMPLES[nextIndex],
    nextIndex
  };
}; 