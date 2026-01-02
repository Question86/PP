/**
 * Cryptographic utilities for hashing
 */
import { createHash } from 'crypto';

/**
 * Compute Blake2b-256 hash of input string
 * Falls back to SHA-256 for simplicity in Node.js environment
 */
export function hashPrompt(text: string): string {
  // Using SHA-256 for MVP simplicity
  // For production, consider using a proper Blake2b library
  const hash = createHash('sha256');
  hash.update(text, 'utf8');
  return hash.digest('hex');
}

/**
 * Alias for hashPrompt - hashes any content
 */
export const hashContent = hashPrompt;

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encode string to hex for Ergo registers
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Decode hex to string from Ergo registers
 */
export function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Encode integer to hex for Ergo registers (4 bytes, big-endian)
 */
export function intToHex(num: number): string {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeInt32BE(num, 0);
  return buffer.toString('hex');
}

/**
 * Decode hex to integer from Ergo registers
 */
export function hexToInt(hex: string): number {
  const buffer = Buffer.from(hex, 'hex');
  return buffer.readInt32BE(0);
}
