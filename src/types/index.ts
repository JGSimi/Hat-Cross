// === Chat Models ===

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  source: 'chat' | 'screenAnalysis' | 'clipboard';
  thinking?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  data: string | null;      // base64 for images
  content: string | null;    // text for files
  isImage: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DraftEntry {
  text: string;
  updatedAt: number;
}

// === Clipboard History ===

export interface ClipboardEntry {
  id: string;
  originalText: string;
  response: string;
  timestamp: number;
  provider: string;
  model: string;
  images?: string[]; // base64 images captured from clipboard
  isPinned?: boolean;
}

// === AI Models ===

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  textContent: string;
  images?: string[]; // base64
}

export interface StreamChunk {
  streamId: number;
  text: string;
  isFinished: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  contentType: 'text' | 'thinking';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// === Providers ===
//
// BYOK was removed on 2026-04-16 — all inference now goes through the Hat
// proxy Worker with Firebase-backed credits. The old CloudProvider /
// ProviderConfig / PROVIDER_DEFAULTS exports are gone; anything still
// importing them should migrate to the Hat credits flow.

// === Theme ===

export type AppTheme =
  // Free tier (0) — 5 temas base, bem distintos
  | 'noir' | 'minimal' | 'ocean' | 'sunset' | 'forest'
  // Spark tier (500) — temas aconchegantes
  | 'cappuccino' | 'lavender' | 'cherry' | 'rosegold'
  // Glow tier (2k) — IDE / tech clássicos
  | 'matrix' | 'dracula' | 'nord' | 'monokai' | 'synthwave' | 'terminal'
  // Ember tier (5k) — restante do catálogo original
  | 'midnight' | 'obsidian' | 'aurora' | 'sakura' | 'ice' | 'solarized' | 'tokyo' | 'gruvbox' | 'cyberpunk'
  // Flame tier (10k) — nature
  | 'forest-dawn' | 'ocean-depths' | 'desert-mirage' | 'tundra-whisper' | 'volcano-ash'
  | 'meadow-breeze' | 'glacier-blue' | 'savanna-gold' | 'rainforest-canopy' | 'monsoon-grey'
  // Radiant tier (25k) — urban + start of emotion
  | 'tokyo-neon' | 'brooklyn-brick' | 'parisian-rose' | 'moscow-slate' | 'cairo-amber'
  | 'istanbul-turquoise' | 'havana-sunset' | 'mumbai-spice' | 'lisbon-azulejo' | 'berlin-concrete'
  | 'euphoria' | 'melancolia'
  // Brilliant tier (50k) — emotion + start of art
  | 'serenidade' | 'paixao' | 'misterio' | 'nostalgia' | 'excitacao' | 'calmaria' | 'deslumbre' | 'coragem'
  | 'bauhaus' | 'art-deco' | 'barroco' | 'minimalista-soft' | 'cubista' | 'impressionista'
  // Stellar tier (100k) — art + time
  | 'expressionista' | 'surrealista' | 'pop-art' | 'brutalista'
  | 'outono-folhas' | 'inverno-manha' | 'verao-praia' | 'primavera-flor' | 'hora-dourada'
  | 'hora-azul' | 'crepusculo' | 'aurora-cedo' | 'meia-noite-oleo' | 'meio-dia-alto'
  | 'marmore'
  // Cosmic tier (200k) — material + start of taste
  | 'veludo' | 'cobre' | 'porcelana' | 'couro' | 'seda' | 'linho' | 'aco' | 'folha-ouro' | 'pedra-obsidiana'
  | 'matcha' | 'espresso' | 'laranja-sangue' | 'lavanda-mel' | 'chocolate-amargo' | 'gelato-menta'
  // Nebula tier (400k) — taste + fantasy
  | 'adega-vinho' | 'torta-cereja' | 'caramelo' | 'toffee'
  | 'escama-dragao' | 'clareira-fada' | 'fogo-fenix' | 'lagoa-sereia'
  | 'nevoa-unicornio' | 'torre-mago' | 'bosque-elfo' | 'ouro-goblin'
  // Galactic tier (700k) — fantasy + tech
  | 'pocao-bruxa' | 'armadura-cavaleiro'
  | 'holograma' | 'data-stream' | 'neural-net' | 'quantum-flux' | 'plasma-core'
  | 'circuito' | 'laser-grid' | 'vapor-wave' | 'glitch-core' | 'binario'
  // Mythic tier (1M) — retro
  | 'miami-80s' | 'grunge-90s' | 'disco-70s' | 'mod-60s' | 'diner-50s'
  | 'y2k-bubble' | 'vhs-tape' | 'arcade-coin' | 'vinil' | 'polaroid-fade'
  // Exclusive (1M) — single animated theme
  | 'prisma-eterno';

export type ThemeTier =
  | 'free'
  | 'spark'
  | 'glow'
  | 'ember'
  | 'flame'
  | 'radiant'
  | 'brilliant'
  | 'stellar'
  | 'cosmic'
  | 'nebula'
  | 'galactic'
  | 'mythic'
  | 'exclusive';

export type ThemeCategory =
  | 'basic'
  | 'tech'
  | 'nature'
  | 'urban'
  | 'emotion'
  | 'art'
  | 'time'
  | 'material'
  | 'taste'
  | 'fantasy'
  | 'retro'
  | 'legendary';

export interface ThemeTierInfo {
  tier: ThemeTier;
  label: string;
  unlockAt: number;
  // emoji/icon glyph for the tier header
  glyph: string;
  // tagline mostrado abaixo do label
  tagline: string;
}

export const TIER_MILESTONES: readonly ThemeTierInfo[] = [
  { tier: 'free',      label: 'Free',       unlockAt: 0,        glyph: '◎', tagline: 'Temas base para começar' },
  { tier: 'spark',     label: 'Faísca',     unlockAt: 500,      glyph: '✧', tagline: 'Primeiros brilhos' },
  { tier: 'glow',      label: 'Brilho',     unlockAt: 2_000,    glyph: '✦', tagline: 'Clássicos de IDE' },
  { tier: 'ember',     label: 'Brasa',      unlockAt: 5_000,    glyph: '❂', tagline: 'Palheta estendida' },
  { tier: 'flame',     label: 'Chama',      unlockAt: 10_000,   glyph: '🜂', tagline: 'Natureza viva' },
  { tier: 'radiant',   label: 'Radiante',   unlockAt: 25_000,   glyph: '❖', tagline: 'Cidades & emoções' },
  { tier: 'brilliant', label: 'Brilhante',  unlockAt: 50_000,   glyph: '✺', tagline: 'Almas & movimentos' },
  { tier: 'stellar',   label: 'Estelar',    unlockAt: 100_000,  glyph: '★', tagline: 'Arte & tempo' },
  { tier: 'cosmic',    label: 'Cósmico',    unlockAt: 200_000,  glyph: '✴', tagline: 'Materiais nobres' },
  { tier: 'nebula',    label: 'Nebulosa',   unlockAt: 400_000,  glyph: '✶', tagline: 'Sabores & fantasia' },
  { tier: 'galactic',  label: 'Galáctico',  unlockAt: 700_000,  glyph: '✹', tagline: 'Futurismo profundo' },
  { tier: 'mythic',    label: 'Mítico',     unlockAt: 1_000_000, glyph: '✷', tagline: 'Nostalgia pura' },
  { tier: 'exclusive', label: 'Exclusivo',  unlockAt: 1_000_000, glyph: '❈', tagline: 'Uma só peça' },
];

export interface ThemePreset {
  name: AppTheme;
  label: string;
  primary: string;
  hover: string;
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  tier: ThemeTier;
  unlockAt: number;
  category: ThemeCategory;
  exclusive?: true;
}

export const THEME_PRESETS: ThemePreset[] = [
  // ========================================================================
  // FREE TIER — 5 temas base, livremente disponíveis
  // ========================================================================
  { name: 'noir', label: 'Noir', primary: '#FFFFFF', hover: '#E0E0E0',
    bgPrimary: '#000000', bgSecondary: '#080808', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', textMuted: '#666666',
    tier: 'free', unlockAt: 0, category: 'basic' },
  { name: 'minimal', label: 'Minimal', primary: '#666666', hover: '#888888',
    bgPrimary: '#111111', bgSecondary: '#161616', textPrimary: '#D4D4D4', textSecondary: '#999999', textMuted: '#555555',
    tier: 'free', unlockAt: 0, category: 'basic' },
  { name: 'ocean', label: 'Oceano', primary: '#0EA5E9', hover: '#38BDF8',
    bgPrimary: '#0B1622', bgSecondary: '#0F1C2A', textPrimary: '#E0F2FE', textSecondary: '#7DD3FC', textMuted: '#3A7AA8',
    tier: 'free', unlockAt: 0, category: 'basic' },
  { name: 'sunset', label: 'Pôr do Sol', primary: '#F97316', hover: '#FB923C',
    bgPrimary: '#1A0E08', bgSecondary: '#1E1210', textPrimary: '#FEF3C7', textSecondary: '#FDBA74', textMuted: '#9A6A3A',
    tier: 'free', unlockAt: 0, category: 'basic' },
  { name: 'forest', label: 'Floresta', primary: '#16A34A', hover: '#22C55E',
    bgPrimary: '#0A140C', bgSecondary: '#0E1A10', textPrimary: '#DCFCE7', textSecondary: '#86EFAC', textMuted: '#3A7A4A',
    tier: 'free', unlockAt: 0, category: 'basic' },

  // ========================================================================
  // SPARK — 500 créditos gastos (temas aconchegantes)
  // ========================================================================
  { name: 'cappuccino', label: 'Cappuccino', primary: '#C4956A', hover: '#D4A574',
    bgPrimary: '#1C1410', bgSecondary: '#211914', textPrimary: '#E8DDD4', textSecondary: '#C4B5A5', textMuted: '#8A7A6A',
    tier: 'spark', unlockAt: 500, category: 'taste' },
  { name: 'lavender', label: 'Lavanda', primary: '#A78BFA', hover: '#C4B5FD',
    bgPrimary: '#110E18', bgSecondary: '#16121E', textPrimary: '#EDE9FE', textSecondary: '#C4B5FD', textMuted: '#6A5A8A',
    tier: 'spark', unlockAt: 500, category: 'nature' },
  { name: 'cherry', label: 'Cereja', primary: '#E11D48', hover: '#FB7185',
    bgPrimary: '#180A10', bgSecondary: '#1E0E14', textPrimary: '#FFE4E6', textSecondary: '#FDA4AF', textMuted: '#8A3A4A',
    tier: 'spark', unlockAt: 500, category: 'taste' },
  { name: 'rosegold', label: 'Rose Gold', primary: '#E8B4B8', hover: '#F4C2C7',
    bgPrimary: '#1A1014', bgSecondary: '#1F151A', textPrimary: '#F5E6E8', textSecondary: '#D9A7AB', textMuted: '#8A6F74',
    tier: 'spark', unlockAt: 500, category: 'material' },

  // ========================================================================
  // GLOW — 2.000 créditos (IDE clássicos)
  // ========================================================================
  { name: 'matrix', label: 'Matrix', primary: '#00FF41', hover: '#4AFF7A',
    bgPrimary: '#000000', bgSecondary: '#040A04', textPrimary: '#D0FFD0', textSecondary: '#8ACC8A', textMuted: '#3E6B3E',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },
  { name: 'dracula', label: 'Drácula', primary: '#BD93F9', hover: '#CAA8FA',
    bgPrimary: '#282A36', bgSecondary: '#2E303E', textPrimary: '#F8F8F2', textSecondary: '#BFBFB7', textMuted: '#6272A4',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },
  { name: 'nord', label: 'Nord', primary: '#88C0D0', hover: '#A5D0DE',
    bgPrimary: '#2E3440', bgSecondary: '#3B4252', textPrimary: '#ECEFF4', textSecondary: '#D8DEE9', textMuted: '#4C566A',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },
  { name: 'monokai', label: 'Monokai', primary: '#F92672', hover: '#FD5C94',
    bgPrimary: '#272822', bgSecondary: '#2E2F28', textPrimary: '#F8F8F2', textSecondary: '#CFCFC2', textMuted: '#75715E',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },
  { name: 'synthwave', label: 'Synthwave', primary: '#FF3AC4', hover: '#FF6FD1',
    bgPrimary: '#1A0B2E', bgSecondary: '#21103A', textPrimary: '#F0E7FF', textSecondary: '#B8A3E0', textMuted: '#6D5BA8',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },
  { name: 'terminal', label: 'Terminal', primary: '#FFB000', hover: '#FFC73B',
    bgPrimary: '#0C0A00', bgSecondary: '#120F02', textPrimary: '#FFD470', textSecondary: '#CC8800', textMuted: '#5C3E00',
    tier: 'glow', unlockAt: 2_000, category: 'tech' },

  // ========================================================================
  // EMBER — 5.000 créditos (palheta estendida, restante do catálogo original)
  // ========================================================================
  { name: 'midnight', label: 'Meia-noite', primary: '#5E8BFF', hover: '#7FA3FF',
    bgPrimary: '#050816', bgSecondary: '#0A0F24', textPrimary: '#E0E8FF', textSecondary: '#8B9CCE', textMuted: '#4A5580',
    tier: 'ember', unlockAt: 5_000, category: 'time' },
  { name: 'obsidian', label: 'Obsidiana', primary: '#FF6B35', hover: '#FF8A5E',
    bgPrimary: '#0A0A0A', bgSecondary: '#151515', textPrimary: '#E8E8E8', textSecondary: '#A0A0A0', textMuted: '#555555',
    tier: 'ember', unlockAt: 5_000, category: 'material' },
  { name: 'aurora', label: 'Aurora', primary: '#5EEAD4', hover: '#86F1DE',
    bgPrimary: '#051322', bgSecondary: '#081A2E', textPrimary: '#D0F5FC', textSecondary: '#86E7F3', textMuted: '#355E7A',
    tier: 'ember', unlockAt: 5_000, category: 'nature' },
  { name: 'sakura', label: 'Sakura', primary: '#F9A8D4', hover: '#FBBAE0',
    bgPrimary: '#14090F', bgSecondary: '#1A0E15', textPrimary: '#FDEAF4', textSecondary: '#E2A4BE', textMuted: '#7A4D65',
    tier: 'ember', unlockAt: 5_000, category: 'nature' },
  { name: 'ice', label: 'Gelo', primary: '#93D5F5', hover: '#B5E3F8',
    bgPrimary: '#0A1320', bgSecondary: '#0F1C2D', textPrimary: '#EAF6FD', textSecondary: '#9EC9DE', textMuted: '#4A6B80',
    tier: 'ember', unlockAt: 5_000, category: 'nature' },
  { name: 'solarized', label: 'Solarized', primary: '#2AA198', hover: '#3FB5AC',
    bgPrimary: '#002B36', bgSecondary: '#073642', textPrimary: '#FDF6E3', textSecondary: '#93A1A1', textMuted: '#586E75',
    tier: 'ember', unlockAt: 5_000, category: 'tech' },
  { name: 'tokyo', label: 'Tokyo Night', primary: '#BB9AF7', hover: '#C9AFFB',
    bgPrimary: '#1A1B26', bgSecondary: '#24283B', textPrimary: '#C0CAF5', textSecondary: '#A9B1D6', textMuted: '#565F89',
    tier: 'ember', unlockAt: 5_000, category: 'tech' },
  { name: 'gruvbox', label: 'Gruvbox', primary: '#FE8019', hover: '#FABD2F',
    bgPrimary: '#1D2021', bgSecondary: '#282828', textPrimary: '#EBDBB2', textSecondary: '#BDAE93', textMuted: '#7C6F64',
    tier: 'ember', unlockAt: 5_000, category: 'tech' },
  { name: 'cyberpunk', label: 'Cyberpunk', primary: '#FF2D6A', hover: '#FF5A8A',
    bgPrimary: '#0A0A12', bgSecondary: '#0E0E1A', textPrimary: '#E0F0FF', textSecondary: '#80C8FF', textMuted: '#4A6A8A',
    tier: 'ember', unlockAt: 5_000, category: 'tech' },

  // ========================================================================
  // FLAME — 10.000 créditos (nature)
  // ========================================================================
  { name: 'forest-dawn', label: 'Alvorada', primary: '#4A8F6F', hover: '#66A88A',
    bgPrimary: '#0A1812', bgSecondary: '#0F1F19', textPrimary: '#D8F0E0', textSecondary: '#86C5A5', textMuted: '#3E5E52',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'ocean-depths', label: 'Abissal', primary: '#0891B2', hover: '#22B5D6',
    bgPrimary: '#030A18', bgSecondary: '#061224', textPrimary: '#CFFAFE', textSecondary: '#7BCEDF', textMuted: '#2A556A',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'desert-mirage', label: 'Miragem', primary: '#D97706', hover: '#F59E0B',
    bgPrimary: '#1A1408', bgSecondary: '#1F1A0E', textPrimary: '#FEF3C7', textSecondary: '#FBBF24', textMuted: '#8A6A2E',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'tundra-whisper', label: 'Sussurro da Tundra', primary: '#64748B', hover: '#94A3B8',
    bgPrimary: '#0F1418', bgSecondary: '#141A20', textPrimary: '#E2E8F0', textSecondary: '#A4B1C2', textMuted: '#485868',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'volcano-ash', label: 'Cinza Vulcânica', primary: '#EA580C', hover: '#FB7C2C',
    bgPrimary: '#100909', bgSecondary: '#18100F', textPrimary: '#FED7AA', textSecondary: '#F59E0B', textMuted: '#7A3A20',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'meadow-breeze', label: 'Brisa de Campo', primary: '#84CC16', hover: '#A3E635',
    bgPrimary: '#0D1608', bgSecondary: '#131D0E', textPrimary: '#ECFCCB', textSecondary: '#BEF264', textMuted: '#4F6A2A',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'glacier-blue', label: 'Azul Glaciar', primary: '#38BDF8', hover: '#7DD3FC',
    bgPrimary: '#081420', bgSecondary: '#0D1C2A', textPrimary: '#BAE6FD', textSecondary: '#7DD3FC', textMuted: '#3A6A8A',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'savanna-gold', label: 'Savana', primary: '#CA8A04', hover: '#EAB308',
    bgPrimary: '#1A140A', bgSecondary: '#1E1810', textPrimary: '#FEF08A', textSecondary: '#FACC15', textMuted: '#8A6A1A',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'rainforest-canopy', label: 'Copa da Floresta', primary: '#059669', hover: '#10B981',
    bgPrimary: '#051410', bgSecondary: '#0A1C16', textPrimary: '#A7F3D0', textSecondary: '#6EE7B7', textMuted: '#2A6A4E',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },
  { name: 'monsoon-grey', label: 'Monções', primary: '#475569', hover: '#64748B',
    bgPrimary: '#0D1014', bgSecondary: '#13171E', textPrimary: '#CBD5E1', textSecondary: '#94A3B8', textMuted: '#3A4A5A',
    tier: 'flame', unlockAt: 10_000, category: 'nature' },

  // ========================================================================
  // RADIANT — 25.000 créditos (urban + emotion start)
  // ========================================================================
  { name: 'tokyo-neon', label: 'Tóquio Neon', primary: '#EC4899', hover: '#F472B6',
    bgPrimary: '#0A0610', bgSecondary: '#120A18', textPrimary: '#FCE7F3', textSecondary: '#F9A8D4', textMuted: '#7A3A5A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'brooklyn-brick', label: 'Brooklyn Tijolo', primary: '#B45309', hover: '#D97706',
    bgPrimary: '#180E08', bgSecondary: '#1E1410', textPrimary: '#FEF3C7', textSecondary: '#FBBF24', textMuted: '#7A4A1A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'parisian-rose', label: 'Rosa Parisiense', primary: '#F472B6', hover: '#F9A8D4',
    bgPrimary: '#1A0F14', bgSecondary: '#1F141A', textPrimary: '#FDF2F8', textSecondary: '#FBCFE8', textMuted: '#8A5A6E',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'moscow-slate', label: 'Ardósia Moscovita', primary: '#DC2626', hover: '#EF4444',
    bgPrimary: '#0E1014', bgSecondary: '#13161C', textPrimary: '#F1F5F9', textSecondary: '#CBD5E1', textMuted: '#4A5058',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'cairo-amber', label: 'Âmbar do Cairo', primary: '#F59E0B', hover: '#FBBF24',
    bgPrimary: '#180F04', bgSecondary: '#1E1408', textPrimary: '#FEF3C7', textSecondary: '#FCD34D', textMuted: '#8A5A1A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'istanbul-turquoise', label: 'Turquesa de Istambul', primary: '#14B8A6', hover: '#2DD4BF',
    bgPrimary: '#031412', bgSecondary: '#081C18', textPrimary: '#CCFBF1', textSecondary: '#5EEAD4', textMuted: '#2A6A5A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'havana-sunset', label: 'Havana Crepúsculo', primary: '#F97316', hover: '#FB923C',
    bgPrimary: '#180A05', bgSecondary: '#1E100A', textPrimary: '#FFEDD5', textSecondary: '#FDBA74', textMuted: '#8A5520',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'mumbai-spice', label: 'Especiaria de Bombaim', primary: '#E11D48', hover: '#F43F5E',
    bgPrimary: '#180A0A', bgSecondary: '#1E1010', textPrimary: '#FEE2E2', textSecondary: '#FECACA', textMuted: '#8A3A3A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'lisbon-azulejo', label: 'Azulejo Lisboeta', primary: '#3B82F6', hover: '#60A5FA',
    bgPrimary: '#050A18', bgSecondary: '#0A1020', textPrimary: '#DBEAFE', textSecondary: '#93C5FD', textMuted: '#3A5A8A',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'berlin-concrete', label: 'Concreto Berlinense', primary: '#6B7280', hover: '#9CA3AF',
    bgPrimary: '#111114', bgSecondary: '#16161A', textPrimary: '#E5E7EB', textSecondary: '#9CA3AF', textMuted: '#4B5563',
    tier: 'radiant', unlockAt: 25_000, category: 'urban' },
  { name: 'euphoria', label: 'Euforia', primary: '#FB7185', hover: '#F472B6',
    bgPrimary: '#120609', bgSecondary: '#180A0E', textPrimary: '#FCE7F3', textSecondary: '#FDA4AF', textMuted: '#8A3A4A',
    tier: 'radiant', unlockAt: 25_000, category: 'emotion' },
  { name: 'melancolia', label: 'Melancolia', primary: '#64748B', hover: '#94A3B8',
    bgPrimary: '#0B1018', bgSecondary: '#10151E', textPrimary: '#CBD5E1', textSecondary: '#94A3B8', textMuted: '#3A4858',
    tier: 'radiant', unlockAt: 25_000, category: 'emotion' },

  // ========================================================================
  // BRILLIANT — 50.000 créditos (emotion rest + art start)
  // ========================================================================
  { name: 'serenidade', label: 'Serenidade', primary: '#86EFAC', hover: '#BBF7D0',
    bgPrimary: '#081810', bgSecondary: '#0D1E16', textPrimary: '#DCFCE7', textSecondary: '#BBF7D0', textMuted: '#3E6A4E',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'paixao', label: 'Paixão', primary: '#DC2626', hover: '#EF4444',
    bgPrimary: '#140505', bgSecondary: '#1C0A0A', textPrimary: '#FEE2E2', textSecondary: '#FCA5A5', textMuted: '#7A2020',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'misterio', label: 'Mistério', primary: '#8B5CF6', hover: '#A78BFA',
    bgPrimary: '#0A0418', bgSecondary: '#100A20', textPrimary: '#E9D5FF', textSecondary: '#C4B5FD', textMuted: '#4A3A7A',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'nostalgia', label: 'Nostalgia', primary: '#D97706', hover: '#F59E0B',
    bgPrimary: '#140E08', bgSecondary: '#1C1610', textPrimary: '#FEF3C7', textSecondary: '#FDBA74', textMuted: '#7A5520',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'excitacao', label: 'Excitação', primary: '#EF4444', hover: '#F87171',
    bgPrimary: '#140808', bgSecondary: '#1C0E0E', textPrimary: '#FECACA', textSecondary: '#FCA5A5', textMuted: '#8A3030',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'calmaria', label: 'Calmaria', primary: '#67E8F9', hover: '#A5F3FC',
    bgPrimary: '#081418', bgSecondary: '#0D1A20', textPrimary: '#CFFAFE', textSecondary: '#A5F3FC', textMuted: '#3A6878',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'deslumbre', label: 'Deslumbre', primary: '#FBBF24', hover: '#FCD34D',
    bgPrimary: '#140A00', bgSecondary: '#1C1205', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#8A6510',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'coragem', label: 'Coragem', primary: '#B91C1C', hover: '#DC2626',
    bgPrimary: '#0A0404', bgSecondary: '#14080A', textPrimary: '#FCA5A5', textSecondary: '#F87171', textMuted: '#6A1A1A',
    tier: 'brilliant', unlockAt: 50_000, category: 'emotion' },
  { name: 'bauhaus', label: 'Bauhaus', primary: '#EF4444', hover: '#F87171',
    bgPrimary: '#0F0F0F', bgSecondary: '#141414', textPrimary: '#F8FAFC', textSecondary: '#CBD5E1', textMuted: '#4A4A4A',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },
  { name: 'art-deco', label: 'Art Déco', primary: '#CA8A04', hover: '#EAB308',
    bgPrimary: '#0A0805', bgSecondary: '#120F0A', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#7A5A1A',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },
  { name: 'barroco', label: 'Barroco', primary: '#FBBF24', hover: '#FCD34D',
    bgPrimary: '#0A0804', bgSecondary: '#100D08', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#7A5810',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },
  { name: 'minimalista-soft', label: 'Minimalista Suave', primary: '#D4D4D4', hover: '#E5E5E5',
    bgPrimary: '#141414', bgSecondary: '#1A1A1A', textPrimary: '#F5F5F5', textSecondary: '#D4D4D4', textMuted: '#707070',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },
  { name: 'cubista', label: 'Cubista', primary: '#C2410C', hover: '#EA580C',
    bgPrimary: '#100805', bgSecondary: '#180E0A', textPrimary: '#FED7AA', textSecondary: '#FDBA74', textMuted: '#6A3010',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },
  { name: 'impressionista', label: 'Impressionista', primary: '#93C5FD', hover: '#BFDBFE',
    bgPrimary: '#0F1218', bgSecondary: '#141820', textPrimary: '#DBEAFE', textSecondary: '#BFDBFE', textMuted: '#4A6A8A',
    tier: 'brilliant', unlockAt: 50_000, category: 'art' },

  // ========================================================================
  // STELLAR — 100.000 créditos (art rest + time + 1 material)
  // ========================================================================
  { name: 'expressionista', label: 'Expressionista', primary: '#FACC15', hover: '#FDE047',
    bgPrimary: '#14110A', bgSecondary: '#1A1610', textPrimary: '#FEF08A', textSecondary: '#FDE047', textMuted: '#8A6A10',
    tier: 'stellar', unlockAt: 100_000, category: 'art' },
  { name: 'surrealista', label: 'Surrealista', primary: '#A855F7', hover: '#C084FC',
    bgPrimary: '#0A0514', bgSecondary: '#120A1C', textPrimary: '#E9D5FF', textSecondary: '#D8B4FE', textMuted: '#553A7A',
    tier: 'stellar', unlockAt: 100_000, category: 'art' },
  { name: 'pop-art', label: 'Pop Art', primary: '#F43F5E', hover: '#FB7185',
    bgPrimary: '#0F0C10', bgSecondary: '#161218', textPrimary: '#FCE7F3', textSecondary: '#FDA4AF', textMuted: '#7A3A4A',
    tier: 'stellar', unlockAt: 100_000, category: 'art' },
  { name: 'brutalista', label: 'Brutalista', primary: '#78716C', hover: '#A8A29E',
    bgPrimary: '#0C0C0C', bgSecondary: '#141414', textPrimary: '#E7E5E4', textSecondary: '#A8A29E', textMuted: '#525252',
    tier: 'stellar', unlockAt: 100_000, category: 'art' },
  { name: 'outono-folhas', label: 'Folhas de Outono', primary: '#EA580C', hover: '#F97316',
    bgPrimary: '#120805', bgSecondary: '#180E0A', textPrimary: '#FED7AA', textSecondary: '#FDBA74', textMuted: '#7A3A1A',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'inverno-manha', label: 'Manhã de Inverno', primary: '#93C5FD', hover: '#BFDBFE',
    bgPrimary: '#0A0F14', bgSecondary: '#10151A', textPrimary: '#DBEAFE', textSecondary: '#BFDBFE', textMuted: '#4A5A70',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'verao-praia', label: 'Verão na Praia', primary: '#FBBF24', hover: '#FCD34D',
    bgPrimary: '#18140A', bgSecondary: '#1E1A10', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#8A7020',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'primavera-flor', label: 'Primavera em Flor', primary: '#F472B6', hover: '#F9A8D4',
    bgPrimary: '#14090E', bgSecondary: '#1A0F14', textPrimary: '#FCE7F3', textSecondary: '#FBCFE8', textMuted: '#8A4565',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'hora-dourada', label: 'Hora Dourada', primary: '#F59E0B', hover: '#FBBF24',
    bgPrimary: '#181005', bgSecondary: '#1E1608', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#8A5A0A',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'hora-azul', label: 'Hora Azul', primary: '#6366F1', hover: '#818CF8',
    bgPrimary: '#080A14', bgSecondary: '#0E101A', textPrimary: '#E0E7FF', textSecondary: '#A5B4FC', textMuted: '#3A408A',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'crepusculo', label: 'Crepúsculo', primary: '#8B5CF6', hover: '#A78BFA',
    bgPrimary: '#0A0814', bgSecondary: '#120F1E', textPrimary: '#E9D5FF', textSecondary: '#C4B5FD', textMuted: '#4A3A7A',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'aurora-cedo', label: 'Aurora Precoce', primary: '#FB7185', hover: '#F472B6',
    bgPrimary: '#100810', bgSecondary: '#160E18', textPrimary: '#FFE4E6', textSecondary: '#FDA4AF', textMuted: '#8A4565',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'meia-noite-oleo', label: 'Óleo de Meia-noite', primary: '#4338CA', hover: '#6366F1',
    bgPrimary: '#030308', bgSecondary: '#080814', textPrimary: '#C7D2FE', textSecondary: '#A5B4FC', textMuted: '#2A2A6A',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'meio-dia-alto', label: 'Meio-dia Alto', primary: '#FCD34D', hover: '#FDE047',
    bgPrimary: '#140F05', bgSecondary: '#1A140A', textPrimary: '#FEF08A', textSecondary: '#FDE68A', textMuted: '#8A6A10',
    tier: 'stellar', unlockAt: 100_000, category: 'time' },
  { name: 'marmore', label: 'Mármore', primary: '#9CA3AF', hover: '#D1D5DB',
    bgPrimary: '#0C0D0F', bgSecondary: '#13151A', textPrimary: '#F3F4F6', textSecondary: '#D1D5DB', textMuted: '#4B5563',
    tier: 'stellar', unlockAt: 100_000, category: 'material' },

  // ========================================================================
  // COSMIC — 200.000 créditos (material rest + taste start)
  // ========================================================================
  { name: 'veludo', label: 'Veludo', primary: '#991B1B', hover: '#B91C1C',
    bgPrimary: '#0A0303', bgSecondary: '#120707', textPrimary: '#FEE2E2', textSecondary: '#FCA5A5', textMuted: '#6A1A1A',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'cobre', label: 'Cobre', primary: '#B45309', hover: '#D97706',
    bgPrimary: '#14080A', bgSecondary: '#1A0E10', textPrimary: '#FDBA74', textSecondary: '#FB923C', textMuted: '#7A3A20',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'porcelana', label: 'Porcelana', primary: '#E5E5DC', hover: '#F5F5DC',
    bgPrimary: '#14120D', bgSecondary: '#1A1812', textPrimary: '#FAFAF0', textSecondary: '#E5E5DC', textMuted: '#7A746A',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'couro', label: 'Couro', primary: '#B45309', hover: '#D97706',
    bgPrimary: '#10080A', bgSecondary: '#160E10', textPrimary: '#FED7AA', textSecondary: '#FDBA74', textMuted: '#6A3A20',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'seda', label: 'Seda', primary: '#E5E5E5', hover: '#F5F5F5',
    bgPrimary: '#0F0F12', bgSecondary: '#141418', textPrimary: '#FAFAFA', textSecondary: '#E5E5E5', textMuted: '#707080',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'linho', label: 'Linho', primary: '#A8A29E', hover: '#D6D3D1',
    bgPrimary: '#14120D', bgSecondary: '#1A1812', textPrimary: '#F5F5F4', textSecondary: '#D6D3D1', textMuted: '#6A645E',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'aco', label: 'Aço', primary: '#64748B', hover: '#94A3B8',
    bgPrimary: '#0A0D12', bgSecondary: '#101418', textPrimary: '#E2E8F0', textSecondary: '#CBD5E1', textMuted: '#3A4858',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'folha-ouro', label: 'Folha de Ouro', primary: '#EAB308', hover: '#FACC15',
    bgPrimary: '#14120A', bgSecondary: '#1A1810', textPrimary: '#FEF08A', textSecondary: '#FDE047', textMuted: '#8A7010',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'pedra-obsidiana', label: 'Pedra Obsidiana', primary: '#6D28D9', hover: '#7C3AED',
    bgPrimary: '#0A0510', bgSecondary: '#120A1A', textPrimary: '#E9D5FF', textSecondary: '#C4B5FD', textMuted: '#3A2A6A',
    tier: 'cosmic', unlockAt: 200_000, category: 'material' },
  { name: 'matcha', label: 'Matcha', primary: '#65A30D', hover: '#84CC16',
    bgPrimary: '#0A140A', bgSecondary: '#101A10', textPrimary: '#D9F99D', textSecondary: '#BEF264', textMuted: '#3A6A20',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },
  { name: 'espresso', label: 'Espresso', primary: '#78350F', hover: '#92400E',
    bgPrimary: '#0A0604', bgSecondary: '#100A08', textPrimary: '#FED7AA', textSecondary: '#FDBA74', textMuted: '#5A2A10',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },
  { name: 'laranja-sangue', label: 'Laranja Sangue', primary: '#DC2626', hover: '#EF4444',
    bgPrimary: '#140A04', bgSecondary: '#1A100A', textPrimary: '#FECACA', textSecondary: '#FCA5A5', textMuted: '#7A2A1A',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },
  { name: 'lavanda-mel', label: 'Lavanda & Mel', primary: '#C084FC', hover: '#D8B4FE',
    bgPrimary: '#0F0A18', bgSecondary: '#14101E', textPrimary: '#F5D0FE', textSecondary: '#D8B4FE', textMuted: '#6A4A8A',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },
  { name: 'chocolate-amargo', label: 'Chocolate Amargo', primary: '#713F12', hover: '#854D0E',
    bgPrimary: '#0A0604', bgSecondary: '#100A08', textPrimary: '#FED7AA', textSecondary: '#FBBF24', textMuted: '#5A3010',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },
  { name: 'gelato-menta', label: 'Gelato de Menta', primary: '#34D399', hover: '#6EE7B7',
    bgPrimary: '#0A1410', bgSecondary: '#101A16', textPrimary: '#A7F3D0', textSecondary: '#6EE7B7', textMuted: '#2A6A4E',
    tier: 'cosmic', unlockAt: 200_000, category: 'taste' },

  // ========================================================================
  // NEBULA — 400.000 créditos (taste rest + fantasy start)
  // ========================================================================
  { name: 'adega-vinho', label: 'Adega Bordô', primary: '#881337', hover: '#9F1239',
    bgPrimary: '#0A0509', bgSecondary: '#100A10', textPrimary: '#FECDD3', textSecondary: '#FDA4AF', textMuted: '#5A2030',
    tier: 'nebula', unlockAt: 400_000, category: 'taste' },
  { name: 'torta-cereja', label: 'Torta de Cereja', primary: '#E11D48', hover: '#F43F5E',
    bgPrimary: '#14060A', bgSecondary: '#1A0A10', textPrimary: '#FEE2E2', textSecondary: '#FDA4AF', textMuted: '#7A2A3A',
    tier: 'nebula', unlockAt: 400_000, category: 'taste' },
  { name: 'caramelo', label: 'Caramelo', primary: '#D97706', hover: '#F59E0B',
    bgPrimary: '#120A04', bgSecondary: '#181008', textPrimary: '#FED7AA', textSecondary: '#FBBF24', textMuted: '#7A4A1A',
    tier: 'nebula', unlockAt: 400_000, category: 'taste' },
  { name: 'toffee', label: 'Toffee', primary: '#A16207', hover: '#CA8A04',
    bgPrimary: '#140D05', bgSecondary: '#1A130A', textPrimary: '#FDE68A', textSecondary: '#FCD34D', textMuted: '#7A5815',
    tier: 'nebula', unlockAt: 400_000, category: 'taste' },
  { name: 'escama-dragao', label: 'Escama de Dragão', primary: '#059669', hover: '#10B981',
    bgPrimary: '#0A1410', bgSecondary: '#101A16', textPrimary: '#A7F3D0', textSecondary: '#6EE7B7', textMuted: '#2A6A4A',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'clareira-fada', label: 'Clareira da Fada', primary: '#86EFAC', hover: '#BBF7D0',
    bgPrimary: '#08140C', bgSecondary: '#0E1A12', textPrimary: '#BBF7D0', textSecondary: '#86EFAC', textMuted: '#3A6A4A',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'fogo-fenix', label: 'Fogo de Fênix', primary: '#F97316', hover: '#FB923C',
    bgPrimary: '#140605', bgSecondary: '#1A0A08', textPrimary: '#FED7AA', textSecondary: '#FDBA74', textMuted: '#8A3A15',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'lagoa-sereia', label: 'Lagoa da Sereia', primary: '#06B6D4', hover: '#22D3EE',
    bgPrimary: '#031418', bgSecondary: '#081A20', textPrimary: '#CFFAFE', textSecondary: '#67E8F9', textMuted: '#2A6878',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'nevoa-unicornio', label: 'Névoa do Unicórnio', primary: '#F472B6', hover: '#F9A8D4',
    bgPrimary: '#0F0914', bgSecondary: '#14101A', textPrimary: '#FCE7F3', textSecondary: '#FBCFE8', textMuted: '#6A4565',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'torre-mago', label: 'Torre do Mago', primary: '#7C3AED', hover: '#8B5CF6',
    bgPrimary: '#050318', bgSecondary: '#0A081E', textPrimary: '#DDD6FE', textSecondary: '#C4B5FD', textMuted: '#3A2A7A',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'bosque-elfo', label: 'Bosque Élfico', primary: '#16A34A', hover: '#22C55E',
    bgPrimary: '#0A1410', bgSecondary: '#101A14', textPrimary: '#BBF7D0', textSecondary: '#86EFAC', textMuted: '#2A6A3A',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },
  { name: 'ouro-goblin', label: 'Ouro de Goblin', primary: '#CA8A04', hover: '#EAB308',
    bgPrimary: '#120E0A', bgSecondary: '#181510', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#7A5A1A',
    tier: 'nebula', unlockAt: 400_000, category: 'fantasy' },

  // ========================================================================
  // GALACTIC — 700.000 créditos (fantasy rest + tech)
  // ========================================================================
  { name: 'pocao-bruxa', label: 'Poção da Bruxa', primary: '#84CC16', hover: '#A3E635',
    bgPrimary: '#0A1405', bgSecondary: '#101A0A', textPrimary: '#D9F99D', textSecondary: '#BEF264', textMuted: '#3A6A1A',
    tier: 'galactic', unlockAt: 700_000, category: 'fantasy' },
  { name: 'armadura-cavaleiro', label: 'Armadura do Cavaleiro', primary: '#94A3B8', hover: '#CBD5E1',
    bgPrimary: '#0D1014', bgSecondary: '#13171C', textPrimary: '#F1F5F9', textSecondary: '#CBD5E1', textMuted: '#4A5868',
    tier: 'galactic', unlockAt: 700_000, category: 'fantasy' },
  { name: 'holograma', label: 'Holograma', primary: '#06B6D4', hover: '#22D3EE',
    bgPrimary: '#040A14', bgSecondary: '#08101C', textPrimary: '#CFFAFE', textSecondary: '#A5F3FC', textMuted: '#2A5868',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'data-stream', label: 'Fluxo de Dados', primary: '#22C55E', hover: '#4ADE80',
    bgPrimary: '#050D08', bgSecondary: '#0A140E', textPrimary: '#BBF7D0', textSecondary: '#86EFAC', textMuted: '#2A5A3A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'neural-net', label: 'Rede Neural', primary: '#3B82F6', hover: '#60A5FA',
    bgPrimary: '#04081A', bgSecondary: '#080E20', textPrimary: '#BFDBFE', textSecondary: '#93C5FD', textMuted: '#2A3A7A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'quantum-flux', label: 'Fluxo Quântico', primary: '#A855F7', hover: '#C084FC',
    bgPrimary: '#060418', bgSecondary: '#0A081E', textPrimary: '#E9D5FF', textSecondary: '#D8B4FE', textMuted: '#3A2A6A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'plasma-core', label: 'Núcleo de Plasma', primary: '#EC4899', hover: '#F472B6',
    bgPrimary: '#120410', bgSecondary: '#180A18', textPrimary: '#FBCFE8', textSecondary: '#F9A8D4', textMuted: '#7A3A5A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'circuito', label: 'Circuito', primary: '#84CC16', hover: '#A3E635',
    bgPrimary: '#04100A', bgSecondary: '#0A1810', textPrimary: '#D9F99D', textSecondary: '#BEF264', textMuted: '#2A5A2A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'laser-grid', label: 'Grade Laser', primary: '#EF4444', hover: '#F87171',
    bgPrimary: '#060508', bgSecondary: '#0A0810', textPrimary: '#FECACA', textSecondary: '#FCA5A5', textMuted: '#6A2020',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'vapor-wave', label: 'Vaporwave', primary: '#F0ABFC', hover: '#F5D0FE',
    bgPrimary: '#0A081A', bgSecondary: '#100E20', textPrimary: '#FAE8FF', textSecondary: '#F5D0FE', textMuted: '#5A3A7A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'glitch-core', label: 'Glitch Core', primary: '#FB7185', hover: '#F9A8D4',
    bgPrimary: '#080814', bgSecondary: '#0E0E1C', textPrimary: '#FCE7F3', textSecondary: '#FDA4AF', textMuted: '#3A3A6A',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },
  { name: 'binario', label: 'Binário', primary: '#FAFAFA', hover: '#E5E5E5',
    bgPrimary: '#050505', bgSecondary: '#0A0A0A', textPrimary: '#F5F5F5', textSecondary: '#A3A3A3', textMuted: '#525252',
    tier: 'galactic', unlockAt: 700_000, category: 'tech' },

  // ========================================================================
  // MYTHIC — 1.000.000 créditos (retro)
  // ========================================================================
  { name: 'miami-80s', label: 'Miami 80s', primary: '#FB7185', hover: '#F472B6',
    bgPrimary: '#0F0618', bgSecondary: '#140A1E', textPrimary: '#FCE7F3', textSecondary: '#FDA4AF', textMuted: '#7A3A5A',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'grunge-90s', label: 'Grunge 90s', primary: '#7E22CE', hover: '#9333EA',
    bgPrimary: '#0A0714', bgSecondary: '#120A1C', textPrimary: '#E9D5FF', textSecondary: '#C4B5FD', textMuted: '#3A2A5A',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'disco-70s', label: 'Disco 70s', primary: '#FBBF24', hover: '#FCD34D',
    bgPrimary: '#120A00', bgSecondary: '#1A1208', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#8A6515',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'mod-60s', label: 'Mod 60s', primary: '#DC2626', hover: '#EF4444',
    bgPrimary: '#0A0605', bgSecondary: '#120A0A', textPrimary: '#FECACA', textSecondary: '#FCA5A5', textMuted: '#6A2525',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'diner-50s', label: 'Diner 50s', primary: '#5EEAD4', hover: '#7DD3FC',
    bgPrimary: '#0A1414', bgSecondary: '#0E1A1A', textPrimary: '#CCFBF1', textSecondary: '#5EEAD4', textMuted: '#2A6868',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'y2k-bubble', label: 'Y2K Bubble', primary: '#60A5FA', hover: '#93C5FD',
    bgPrimary: '#08081A', bgSecondary: '#0E0E20', textPrimary: '#BFDBFE', textSecondary: '#93C5FD', textMuted: '#3A4A8A',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'vhs-tape', label: 'Fita VHS', primary: '#E879F9', hover: '#F0ABFC',
    bgPrimary: '#0A040A', bgSecondary: '#120810', textPrimary: '#F5D0FE', textSecondary: '#F0ABFC', textMuted: '#6A3065',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'arcade-coin', label: 'Ficha de Arcade', primary: '#FBBF24', hover: '#FCD34D',
    bgPrimary: '#080418', bgSecondary: '#0E0A1E', textPrimary: '#FEF3C7', textSecondary: '#FDE68A', textMuted: '#6A551A',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'vinil', label: 'Vinil', primary: '#A16207', hover: '#CA8A04',
    bgPrimary: '#0A0703', bgSecondary: '#100C08', textPrimary: '#FDE68A', textSecondary: '#FCD34D', textMuted: '#5A4020',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },
  { name: 'polaroid-fade', label: 'Polaroid Desbotada', primary: '#F5DEB3', hover: '#FFEAC2',
    bgPrimary: '#120F0A', bgSecondary: '#181510', textPrimary: '#FAF0C8', textSecondary: '#F5DEB3', textMuted: '#7A6A55',
    tier: 'mythic', unlockAt: 1_000_000, category: 'retro' },

  // ========================================================================
  // EXCLUSIVE — 1.000.000 créditos (tema único animado)
  // ========================================================================
  { name: 'prisma-eterno', label: 'Prisma Eterno', primary: '#B892FF', hover: '#D4BFFF',
    bgPrimary: '#0A0618', bgSecondary: '#120A24', textPrimary: '#F5F3FF', textSecondary: '#DDD6FE', textMuted: '#6A5A9A',
    tier: 'exclusive', unlockAt: 1_000_000, category: 'legendary', exclusive: true },
];

export const VALID_THEMES: AppTheme[] = THEME_PRESETS.map((t) => t.name);

export const FREE_THEMES: readonly AppTheme[] = THEME_PRESETS
  .filter((t) => t.tier === 'free')
  .map((t) => t.name);

// === Settings ===

export interface PopoverSettings {
  width: number;
  height: number;
  stealthMode: boolean;
  stealthHoverOpacity: number;
  disguiseMode: boolean;
  disguiseWidget: 'clock';
}

export interface ShortcutSettings {
  clipboard: string;
  floatingChat: string;
  adjustFlashPosition: string;
  emergencyQuit: string;
}

export interface ClipboardSettings {
  enabled: boolean;
  copyResponseToClipboard: boolean;
  maxResponseLength: number;
  appendMode: boolean; // append response below original text
  soundOnComplete: boolean;
  captureImages: boolean; // also read images from clipboard
  flash: FlashSettings;
}

export type FlashTimingMode = 'instant' | 'fade' | 'typewriter';

export interface FlashPosition {
  x: number;
  y: number;
  monitorLabel?: string;
}

export interface FlashTiming {
  mode: FlashTimingMode;
  fadeInMs: number;
  fadeOutMs: number;
  holdMs: number | null; // null = automatic (~200 WPM reading speed)
}

export interface FlashAppearance {
  color: string; // hex; '' falls back to var(--color-accent)
  opacity: number; // 0-100
  fontSizePx: number;
  textShadow: boolean;
}

export interface FlashSettings {
  enabled: boolean;
  previewLength: number; // 50-1000
  position: FlashPosition;
  timing: FlashTiming;
  appearance: FlashAppearance;
}

export interface NotificationSettings {
  enabled: boolean;
  showProcessingNotification: boolean;
  showResponseNotification: boolean;
  showErrorNotification: boolean;
  showChatResponseNotification: boolean;
  showUpdateNotification: boolean;
  showClipboardEmptyNotification: boolean;
}

export interface ChatLimits {
  maxContextMessages: number;    // Max messages sent as context to AI (prevents context overflow)
  maxConversations: number;      // Max conversations stored in history
  maxMessagesPerConversation: number; // Max messages stored per conversation
  autoNewChatOnLimit: boolean;   // Auto-create new chat when context limit reached
}

export interface AppSettings {
  autoLaunch: boolean;
  theme: AppTheme;
  language: AppLanguage;
  popover: PopoverSettings;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  shortcuts: ShortcutSettings;
  tokenStats: TokenUsage;
  clipboard: ClipboardSettings;
  notifications: NotificationSettings;
  chatLimits: ChatLimits;
  onboardingCompleted: boolean;
}

import type { AppLanguage } from '../i18n/defaults';
import { detectInitialLanguage, DEFAULT_SYSTEM_PROMPTS } from '../i18n/defaults';
export type { AppLanguage };

const INITIAL_LANGUAGE = detectInitialLanguage();

export const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  theme: 'noir',
  language: INITIAL_LANGUAGE,
  popover: {
    width: 380,
    height: 480,
    stealthMode: false,
    stealthHoverOpacity: 0.4,
    disguiseMode: true,
    disguiseWidget: 'clock',
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPTS[INITIAL_LANGUAGE],
  temperature: 0.7,
  maxTokens: 4096,
  shortcuts: {
    clipboard: 'CommandOrControl+Shift+X',
    floatingChat: 'CommandOrControl+Shift+C',
    adjustFlashPosition: 'CommandOrControl+Shift+F',
    emergencyQuit: 'CommandOrControl+Shift+Q',
  },
  tokenStats: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
  clipboard: {
    enabled: true,
    copyResponseToClipboard: true,
    maxResponseLength: 4096,
    appendMode: false,
    soundOnComplete: true,
    captureImages: true,
    flash: {
      enabled: false,
      previewLength: 200,
      position: { x: 40, y: 40 },
      timing: {
        mode: 'fade',
        fadeInMs: 300,
        fadeOutMs: 500,
        holdMs: null,
      },
      appearance: {
        color: '',
        opacity: 35,
        fontSizePx: 14,
        textShadow: true,
      },
    },
  },
  notifications: {
    enabled: true,
    showProcessingNotification: true,
    showResponseNotification: true,
    showErrorNotification: true,
    showChatResponseNotification: true,
    showUpdateNotification: true,
    showClipboardEmptyNotification: true,
  },
  chatLimits: {
    maxContextMessages: 40,
    maxConversations: 50,
    maxMessagesPerConversation: 200,
    autoNewChatOnLimit: true,
  },
  onboardingCompleted: false,
};
