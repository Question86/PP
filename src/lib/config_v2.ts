// PromptPage V2 Configuration
// Centralized configuration for modular snippet marketplace

// =====================================================
// ERGO BLOCKCHAIN CONSTANTS
// =====================================================

export const ERGO = {
  NANOERG_TO_ERG: 1_000_000_000,
  MIN_BOX_VALUE: 1_000_000, // 0.001 ERG
  RECOMMENDED_MIN_FEE_VALUE: 1_000_000, // 0.001 ERG
} as const;

// =====================================================
// V2 MARKETPLACE CONFIGURATION
// =====================================================

export const LIMITS = {
  MAX_SNIPPETS_PER_COMPOSITION: Number(
    process.env.MAX_SNIPPETS_PER_COMPOSITION || 20
  ),
  MAX_OUTPUTS_PER_TX: 100,
  MAX_PROMPT_LENGTH: Number(process.env.MAX_PROMPT_LENGTH || 10_000),
  MAX_SNIPPET_CONTENT: Number(process.env.MAX_SNIPPET_CONTENT_LENGTH || 50_000),
  MAX_SNIPPET_TITLE: 255,
  MAX_DISPLAY_NAME: 255,
} as const;

export const CATEGORIES = [
  'guardrail',
  'format',
  'tone',
  'eval',
  'tooling',
  'context',
  'other',
] as const;

export type SnippetCategory = (typeof CATEGORIES)[number];

// =====================================================
// PLATFORM CONFIGURATION
// =====================================================

export const PLATFORM_ERGO_ADDRESS =
  process.env.PLATFORM_ERGO_ADDRESS || '';

export const PLATFORM_FEE_NANOERG = BigInt(
  process.env.PLATFORM_FEE_NANOERG || 5_000_000 // 0.005 ERG default
);

export const MIN_OUTPUT_VALUE_NANOERG = BigInt(
  process.env.MIN_OUTPUT_VALUE_NANOERG || ERGO.MIN_BOX_VALUE
);

// =====================================================
// NETWORK CONFIGURATION
// =====================================================

export const ERGO_NETWORK = (process.env.ERGO_NETWORK || 'testnet') as
  | 'testnet'
  | 'mainnet';

export const ERGO_EXPLORER_API =
  process.env.ERGO_EXPLORER_API ||
  (ERGO_NETWORK === 'testnet'
    ? 'https://api-testnet.ergoplatform.com'
    : 'https://api.ergoplatform.com');

// =====================================================
// APPLICATION SETTINGS
// =====================================================

export const APP_BASE_URL =
  process.env.APP_BASE_URL || 'http://localhost:3000';

export const NODE_ENV = process.env.NODE_ENV || 'development';

// =====================================================
// VALIDATION
// =====================================================

export function validateConfig() {
  const errors: string[] = [];

  if (!PLATFORM_ERGO_ADDRESS) {
    errors.push('PLATFORM_ERGO_ADDRESS is required');
  }

  if (PLATFORM_ERGO_ADDRESS && PLATFORM_ERGO_ADDRESS.length < 10) {
    errors.push('PLATFORM_ERGO_ADDRESS appears invalid');
  }

  if (PLATFORM_FEE_NANOERG < 0) {
    errors.push('PLATFORM_FEE_NANOERG must be non-negative');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.join('\n')}`
    );
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function nanoergToErg(nanoerg: bigint): number {
  return Number(nanoerg) / ERGO.NANOERG_TO_ERG;
}

export function ergToNanoerg(erg: number): bigint {
  return BigInt(Math.floor(erg * ERGO.NANOERG_TO_ERG));
}

export function formatErg(nanoerg: bigint): string {
  return `${nanoergToErg(nanoerg).toFixed(3)} ERG`;
}

export function isValidCategory(category: string): category is SnippetCategory {
  return CATEGORIES.includes(category as SnippetCategory);
}
