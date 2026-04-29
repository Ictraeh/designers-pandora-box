const AXIS_KEYS = ["warmCool", "arousal", "valence", "sophistication", "grounding", "openness"];
const W_AXIS = 0.08;
const W_TEXT = 0.025;
const MIN_SCORE_REL_TO_TOP = 0.65;
const ABS_MIN_BY_MOOD = {
  urgent: 0.58,
  calm: 0.56,
  lux: 0.55,
  festival: 0.56,
  pure: 0.58,
  clinical: 0.56,
  trust: 0.54,
  energy: 0.54,
  play: 0.52,
  earth: 0.52,
  melancholy: 0.52,
  joy: 0.53,
  romance: 0.52,
  tech: 0.53,
  cozy: 0.52,
  crisp: 0.55,
  noir: 0.54,
  nostalgia: 0.52,
  ocean: 0.52,
  forest: 0.52,
  midnight: 0.54,
  dawn: 0.52,
  wedding: 0.55,
  artisan: 0.52,
  default: 0.5,
};

const MOOD_CHIPS = [
  { id: "calm", label: "Calm", detail: "serene, still, quiet", lemmas: ["calm", "serene", "quiet"], axes: { warmCool: -0.25, arousal: 0.12, valence: 0.35, sophistication: 0.5, grounding: 0.25, openness: 0.55 } },
  { id: "trust", label: "Trust", detail: "dependable, secure, fintech", lemmas: ["trust", "dependable", "secure"], axes: { warmCool: -0.55, arousal: 0.25, valence: 0.2, sophistication: 0.55, grounding: 0.15, openness: 0.4 } },
  { id: "energy", label: "Energy", detail: "electric, vibrant, punchy", lemmas: ["energy", "vibrant", "dynamic"], axes: { warmCool: 0.35, arousal: 0.88, valence: 0.55, sophistication: 0.25, grounding: 0.1, openness: 0.65 } },
  { id: "play", label: "Playful", detail: "whimsical, fun, youthful", lemmas: ["playful", "whimsical", "fun"], axes: { warmCool: 0.1, arousal: 0.75, valence: 0.7, sophistication: 0.25, grounding: 0.2, openness: 0.75 } },
  { id: "lux", label: "Luxury", detail: "opulent, prestige, jewelry", lemmas: ["luxury", "opulent", "prestige"], axes: { warmCool: -0.1, arousal: 0.32, valence: 0.2, sophistication: 0.9, grounding: 0.15, openness: 0.25 } },
  { id: "earth", label: "Earth", detail: "organic, artisan, grounded", lemmas: ["earth", "organic", "natural"], axes: { warmCool: -0.05, arousal: 0.28, valence: 0.4, sophistication: 0.4, grounding: 0.88, openness: 0.55 } },
  { id: "melancholy", label: "Melancholy", detail: "somber, heavy, introspective", lemmas: ["melancholy", "somber", "sad"], axes: { warmCool: -0.35, arousal: 0.25, valence: -0.65, sophistication: 0.45, grounding: 0.25, openness: 0.15 } },
  { id: "joy", label: "Joy", detail: "cheerful, bright, upbeat", lemmas: ["joy", "cheerful", "bright"], axes: { warmCool: 0.25, arousal: 0.55, valence: 0.85, sophistication: 0.2, grounding: 0.2, openness: 0.8 } },
  { id: "romance", label: "Romance", detail: "intimate, love, bridal", lemmas: ["romantic", "love", "intimate"], axes: { warmCool: 0.22, arousal: 0.32, valence: 0.45, sophistication: 0.48, grounding: 0.12, openness: 0.55 } },
  { id: "clinical", label: "Clinical", detail: "sterile, precise, medical", lemmas: ["clinical", "sterile", "precise"], axes: { warmCool: -0.55, arousal: 0.15, valence: 0.18, sophistication: 0.65, grounding: 0.05, openness: 0.45 } },
  { id: "tech", label: "Tech", detail: "futuristic, digital, SaaS", lemmas: ["tech", "futuristic", "digital"], axes: { warmCool: -0.35, arousal: 0.45, valence: 0.25, sophistication: 0.55, grounding: 0.05, openness: 0.55 } },
  { id: "cozy", label: "Cozy", detail: "warm, welcoming, home", lemmas: ["cozy", "warm", "welcoming"], axes: { warmCool: 0.75, arousal: 0.35, valence: 0.4, sophistication: 0.3, grounding: 0.45, openness: 0.45 } },
  { id: "crisp", label: "Crisp cool", detail: "icy, airy, minimal cool", lemmas: ["crisp", "cool", "icy"], axes: { warmCool: -0.65, arousal: 0.28, valence: 0.05, sophistication: 0.65, grounding: 0.05, openness: 0.4 } },
  { id: "noir", label: "Noir", detail: "mystery, shadow, cinematic", lemmas: ["noir", "mysterious", "shadow"], axes: { warmCool: -0.4, arousal: 0.35, valence: -0.15, sophistication: 0.55, grounding: 0.2, openness: 0.18 } },
  { id: "nostalgia", label: "Nostalgia", detail: "vintage, retro, heritage", lemmas: ["nostalgia", "vintage", "retro"], axes: { warmCool: 0.2, arousal: 0.35, valence: 0.2, sophistication: 0.45, grounding: 0.45, openness: 0.35 } },
  { id: "pure", label: "Pure minimal", detail: "clean, simple, white space", lemmas: ["pure", "minimal", "clean"], axes: { warmCool: 0.0, arousal: 0.1, valence: 0.35, sophistication: 0.75, grounding: 0.1, openness: 0.55 } },
  { id: "urgent", label: "Urgent", detail: "sale, alert, deadline", lemmas: ["urgent", "sale", "alert"], axes: { warmCool: 0.55, arousal: 0.9, valence: 0.35, sophistication: 0.12, grounding: 0.1, openness: 0.65 } },
  { id: "ocean", label: "Ocean", detail: "coastal, aquatic, breeze", lemmas: ["ocean", "coastal", "aquatic"], axes: { warmCool: -0.5, arousal: 0.22, valence: 0.35, sophistication: 0.4, grounding: 0.25, openness: 0.55 } },
  { id: "forest", label: "Forest", detail: "deep green, hiking, canopy", lemmas: ["forest", "green", "woodland"], axes: { warmCool: -0.08, arousal: 0.35, valence: 0.45, sophistication: 0.35, grounding: 0.75, openness: 0.5 } },
  { id: "midnight", label: "Midnight", detail: "night, deep blue-black", lemmas: ["midnight", "night", "nocturnal"], axes: { warmCool: -0.45, arousal: 0.22, valence: -0.1, sophistication: 0.55, grounding: 0.15, openness: 0.15 } },
  { id: "dawn", label: "Dawn", detail: "hopeful morning, soft light", lemmas: ["dawn", "hopeful", "morning"], axes: { warmCool: 0.35, arousal: 0.28, valence: 0.45, sophistication: 0.42, grounding: 0.22, openness: 0.62 } },
  { id: "festival", label: "Festival", detail: "carnival, poster, maximal", lemmas: ["festival", "carnival", "party"], axes: { warmCool: 0.1, arousal: 0.88, valence: 0.85, sophistication: 0.18, grounding: 0.15, openness: 0.85 } },
  { id: "wedding", label: "Wedding", detail: "bridal, elegant romance", lemmas: ["wedding", "bridal", "marriage"], axes: { warmCool: 0.12, arousal: 0.28, valence: 0.65, sophistication: 0.62, grounding: 0.12, openness: 0.55 } },
  { id: "artisan", label: "Artisan", detail: "handmade, clay, craft fair", lemmas: ["artisan", "handmade", "craft"], axes: { warmCool: 0.32, arousal: 0.28, valence: 0.35, sophistication: 0.42, grounding: 0.72, openness: 0.45 } },
];

if (typeof window !== "undefined") {
  window.MOOD_CHIPS = MOOD_CHIPS;
  window.AXIS_KEYS = AXIS_KEYS;
  window.W_AXIS = W_AXIS;
  window.W_TEXT = W_TEXT;
}
