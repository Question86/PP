/**
 * Configuration and constants for Ergo blockchain operations
 */

// Ergo constants
export const NANOERG_TO_ERG = 1_000_000_000;
export const MIN_BOX_VALUE = 0.001 * NANOERG_TO_ERG; // 0.001 ERG minimum
export const TX_FEE = 0.001 * NANOERG_TO_ERG; // Standard transaction fee
export const NFT_BOX_VALUE = 0.002 * NANOERG_TO_ERG; // Minimum for NFT output box

// Service fee configuration
export const SERVICE_FEE_ERG = parseFloat(process.env.SERVICE_FEE_ERG || '0.05');
export const SERVICE_FEE_NANOERG = SERVICE_FEE_ERG * NANOERG_TO_ERG;

// Platform configuration
export const PLATFORM_ERGO_ADDRESS = process.env.PLATFORM_ERGO_ADDRESS || '';
export const ERGO_NETWORK = (process.env.ERGO_NETWORK || 'testnet') as 'mainnet' | 'testnet';

// Application configuration
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';
export const ERGO_EXPLORER_API = process.env.NEXT_PUBLIC_ERGO_EXPLORER_API || 'https://api-testnet.ergoplatform.com';

// Prompt constraints
export const MAX_PROMPT_LENGTH = 10_000;
export const MIN_PROMPT_LENGTH = 10;

// NFT metadata
export const NFT_DECIMALS = 0;
export const NFT_SUPPLY = '1';
export const NFT_NAME_PREFIX = 'PromptPage NFT #';
export const NFT_DESCRIPTION = 'Proof of prompt ownership on PromptPage';

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL || '';

// Validation
export function validateConfig() {
  const errors: string[] = [];

  if (!DATABASE_URL) {
    errors.push('DATABASE_URL is not configured');
  }

  if (!PLATFORM_ERGO_ADDRESS) {
    errors.push('PLATFORM_ERGO_ADDRESS is not configured');
  }

  if (SERVICE_FEE_ERG <= 0) {
    errors.push('SERVICE_FEE_ERG must be greater than 0');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
