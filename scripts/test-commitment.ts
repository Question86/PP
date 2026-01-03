#!/usr/bin/env tsx
/**
 * Test script for R4 commitment hash computation
 * Tests deterministic commitment generation and verification
 */

import { buildCommitmentString, computeCommitment } from '../src/lib/payments';
import { blake2b256 } from '../src/lib/crypto';
import type { PaymentIntent } from '../src/types/v2';

// Test PaymentIntent (matches testnet composition)
const testPaymentIntent: PaymentIntent = {
  compositionId: 6,
  platformOutput: {
    address: '3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ',
    amount: '5000000',
  },
  creatorOutputs: [
    {
      address: '3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz',
      amount: '25000000',
      snippetCount: 2,
      snippetVersionIds: [1, 2],
    },
    {
      address: '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB',
      amount: '20000000',
      snippetCount: 1,
      snippetVersionIds: [3],
    },
  ],
  memo: '6',
  totalRequired: '50000000',
  estimatedFee: '1000000',
  protocolVersion: 1,
};

console.log('=== R4 COMMITMENT HASH TEST ===\n');

// Test 1: Build canonical string
console.log('Test 1: Canonical String');
const canonical = buildCommitmentString(testPaymentIntent);
console.log('Canonical:', canonical);
console.log('Length:', canonical.length);
console.log();

// Test 2: Compute commitment
console.log('Test 2: Commitment Hash');
const commitment = computeCommitment(testPaymentIntent);
console.log('Commitment (hex):', commitment);
console.log('Length (bytes):', commitment.length / 2);
console.log();

// Test 3: Determinism (compute twice)
console.log('Test 3: Determinism Check');
const commitment2 = computeCommitment(testPaymentIntent);
console.log('Commitment 1:', commitment);
console.log('Commitment 2:', commitment2);
console.log('Match:', commitment === commitment2 ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 4: Different order (should produce same result due to sorting)
console.log('Test 4: Sort Order Invariance');
const reorderedIntent: PaymentIntent = {
  ...testPaymentIntent,
  creatorOutputs: [
    testPaymentIntent.creatorOutputs[1], // Swap order
    testPaymentIntent.creatorOutputs[0],
  ],
};
const commitment3 = computeCommitment(reorderedIntent);
console.log('Original Order:', commitment);
console.log('Reordered:     ', commitment3);
console.log('Match:', commitment === commitment3 ? '✓ PASS (sorting working)' : '✗ FAIL');
console.log();

// Test 5: Blake2b-256 sanity check
console.log('Test 5: Blake2b-256 Sanity');
const testString = 'test';
const hash = blake2b256(testString);
console.log('Input:', testString);
console.log('Blake2b-256:', hash);
console.log('Length:', hash.length, 'chars (should be 64 = 32 bytes hex)');
console.log();

// Test 6: Show expected R4 register encoding
console.log('Test 6: R4 Register Encoding');
console.log('Commitment hash:', commitment);
console.log('Expected R4 (with prefix): 0e20' + commitment);
console.log('(0e = SColl, 20 = 32 bytes)');
console.log();

console.log('=== ALL TESTS COMPLETE ===');
