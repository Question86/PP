// Ergo Explorer API client and transaction verification
import type { PaymentIntent, ExplorerTransaction, VerificationResult } from '../types/v2';
import { ERGO_EXPLORER_API } from './config_v2';
import { computeCommitment } from './payments';
import { bytesToHex } from './crypto';

export interface VerificationOptions {
  requireCommitment?: boolean; // If true, R4 must exist and match
}

// =====================================================
// EXPLORER API CLIENT
// =====================================================

/**
 * Fetch transaction details from Explorer API
 */
export async function getTransaction(
  txId: string
): Promise<ExplorerTransaction | null> {
  try {
    const response = await fetch(
      `${ERGO_EXPLORER_API}/api/v1/transactions/${txId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Transaction not found
      }
      throw new Error(`Explorer API error: ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeTransaction(data);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return null;
  }
}

/**
 * Wait for transaction to appear on Explorer
 * Polls every 2 seconds up to maxAttempts
 */
export async function waitForTransaction(
  txId: string,
  maxAttempts: number = 30
): Promise<ExplorerTransaction | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = await getTransaction(txId);
    if (tx) return tx;

    // Wait 2 seconds before retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return null; // Timeout
}

// =====================================================
// PAYMENT VERIFICATION
// =====================================================

/**
 * Verify that a transaction matches the expected payment intent
 * Checks platform output and all creator outputs
 * UTXO-SAFE: Sums all outputs per address (handles multiple outputs to same address)
 * 
 * Options:
 * - requireCommitment: If true, R4 register must exist and match commitment (strict mode)
 */
export async function verifyPayment(
  txId: string,
  paymentIntent: PaymentIntent,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const result: VerificationResult = {
    valid: false,
    platformOutputValid: false,
    creatorOutputsValid: [],
    registersValid: false,
    errors: [],
  };

  // Fetch transaction
  const tx = await getTransaction(txId);
  if (!tx) {
    result.errors.push('Transaction not found on Explorer');
    return result;
  }

  // Check confirmations (REQUIRED - must have at least 1 for valid=true)
  if (tx.confirmationsCount < 1) {
    result.errors.push('Transaction not yet confirmed');
    return result;
  }

  // Build address -> total amount map (UTXO-safe: sum all outputs per address)
  const addressSums = new Map<string, bigint>();
  for (const output of tx.outputs) {
    const addr = output.address.toLowerCase();
    const current = addressSums.get(addr) || 0n;
    addressSums.set(addr, current + BigInt(output.value));
  }

  // Verify platform output sum
  const platformAddr = paymentIntent.platformOutput.address.toLowerCase();
  const platformSum = addressSums.get(platformAddr) || 0n;
  const expectedPlatformAmount = BigInt(paymentIntent.platformOutput.amount);

  if (platformSum >= expectedPlatformAmount) {
    result.platformOutputValid = true;
  } else {
    result.errors.push(
      `Platform output sum insufficient: expected ${expectedPlatformAmount}, got ${platformSum}`
    );
  }

  // Verify creator output sums
  for (const expectedCreator of paymentIntent.creatorOutputs) {
    const creatorAddr = expectedCreator.address.toLowerCase();
    const creatorSum = addressSums.get(creatorAddr) || 0n;
    const expectedAmount = BigInt(expectedCreator.amount);

    if (creatorSum >= expectedAmount) {
      result.creatorOutputsValid.push(true);
    } else {
      result.errors.push(
        `Creator output sum insufficient for ${expectedCreator.address}: expected ${expectedAmount}, got ${creatorSum}`
      );
      result.creatorOutputsValid.push(false);
    }
  }

  // Check R4 register for commitment hash
  const platformOutput = tx.outputs.find(
    (output) => output.address.toLowerCase() === platformAddr
  );
  
  // Compute expected commitment
  const expectedCommitment = paymentIntent.commitmentHex || computeCommitment(paymentIntent);
  
  if (options.requireCommitment) {
    // STRICT MODE: R4 must exist and match
    if (!platformOutput?.additionalRegisters?.R4) {
      result.errors.push('Platform output missing R4 register (strict mode)');
      result.registersValid = false;
    } else {
      const actualR4 = platformOutput.additionalRegisters.R4;
      // Decode R4: remove SConstant prefix "04" and SColl prefix "0e20" (32 bytes)
      const r4Hex = actualR4.startsWith('0e20') ? actualR4.slice(4) : actualR4;
      
      if (r4Hex.toLowerCase() === expectedCommitment.toLowerCase()) {
        result.registersValid = true;
      } else {
        result.errors.push(
          `R4 commitment mismatch: expected ${expectedCommitment}, got ${r4Hex}`
        );
        result.registersValid = false;
      }
    }
  } else {
    // NON-STRICT MODE: R4 is optional, but validate if present
    if (platformOutput?.additionalRegisters?.R4) {
      const actualR4 = platformOutput.additionalRegisters.R4;
      const r4Hex = actualR4.startsWith('0e20') ? actualR4.slice(4) : actualR4;
      
      if (r4Hex.toLowerCase() === expectedCommitment.toLowerCase()) {
        result.registersValid = true;
      } else {
        // Mismatch in non-strict mode: warn but don't fail
        result.registersValid = false;
      }
    } else {
      // No R4 in non-strict mode: valid but no register verification
      result.registersValid = false;
    }
  }

  // Overall validation: platform sum valid + all creator sums valid + no errors
  result.valid =
    result.platformOutputValid &&
    result.creatorOutputsValid.every((v) => v) &&
    result.errors.length === 0;

  return result;
}

// =====================================================
// SIMPLIFIED VERIFICATION (MVP)
// =====================================================

/**
 * Simplified verification for MVP
 * Just checks that outputs exist with correct amounts
 * Doesn't require register verification
 */
export async function verifyPaymentSimple(
  txId: string,
  expectedOutputs: Array<{ address: string; minAmount: bigint }>
): Promise<boolean> {
  const tx = await getTransaction(txId);
  if (!tx) return false;

  for (const expected of expectedOutputs) {
    const output = tx.outputs.find(
      (o) => o.address.toLowerCase() === expected.address.toLowerCase()
    );

    if (!output) return false;

    if (BigInt(output.value) < expected.minAmount) return false;
  }

  return true;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize Explorer API transaction response
 */
function normalizeTransaction(data: any): ExplorerTransaction {
  return {
    id: data.id,
    inputs: (data.inputs || []).map((input: any) => ({
      boxId: input.boxId,
      value: input.value,
      address: input.address,
    })),
    outputs: (data.outputs || []).map((output: any) => ({
      boxId: output.boxId,
      value: output.value,
      address: output.address,
      additionalRegisters: output.additionalRegisters || {},
    })),
    inclusionHeight: data.inclusionHeight || 0,
    confirmationsCount: data.confirmationsCount || 0,
  };
}

/**
 * Decode composition ID from R4 register
 * R4 contains UTF-8 encoded composition ID
 */
function decodeR4Register(r4Hex: string): string {
  try {
    // Remove SConstant prefix if present (usually "0e" for bytes)
    let hex = r4Hex;
    if (hex.startsWith('0e')) {
      hex = hex.substring(2);
    }

    // Parse length prefix (first byte or two)
    let offset = 0;
    let length = parseInt(hex.substring(offset, offset + 2), 16);
    offset += 2;

    if (length > 127) {
      // Multi-byte length encoding
      const lengthBytes = length - 128;
      length = parseInt(hex.substring(offset, offset + lengthBytes * 2), 16);
      offset += lengthBytes * 2;
    }

    // Extract data bytes
    const dataHex = hex.substring(offset, offset + length * 2);
    const bytes = Buffer.from(dataHex, 'hex');
    return bytes.toString('utf-8');
  } catch (error) {
    console.error('Error decoding R4 register:', error);
    return '';
  }
}

/**
 * Decode snippet version IDs from R5 register
 */
function decodeR5Register(r5Hex: string): number[] {
  try {
    const str = decodeR4Register(r5Hex); // Same decoding logic
    return str.split(',').map((id) => parseInt(id));
  } catch (error) {
    console.error('Error decoding R5 register:', error);
    return [];
  }
}

// =====================================================
// TRANSACTION STATUS HELPERS
// =====================================================

/**
 * Check if transaction has been confirmed
 */
export async function isTransactionConfirmed(
  txId: string,
  minConfirmations: number = 1
): Promise<boolean> {
  const tx = await getTransaction(txId);
  if (!tx) return false;
  return tx.confirmationsCount >= minConfirmations;
}

/**
 * Get transaction confirmation count
 */
export async function getConfirmationCount(txId: string): Promise<number> {
  const tx = await getTransaction(txId);
  return tx?.confirmationsCount || 0;
}

// =====================================================
// ADDRESS UTILITIES
// =====================================================

/**
 * Get transaction history for an address
 * Useful for creator earnings history
 */
export async function getAddressTransactions(
  address: string,
  offset: number = 0,
  limit: number = 50
): Promise<ExplorerTransaction[]> {
  try {
    const response = await fetch(
      `${ERGO_EXPLORER_API}/api/v1/addresses/${address}/transactions?offset=${offset}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.items || []).map(normalizeTransaction);
  } catch (error) {
    console.error('Error fetching address transactions:', error);
    return [];
  }
}

/**
 * Get balance for an address
 */
export async function getAddressBalance(
  address: string
): Promise<{ nanoErg: bigint; tokens: Array<{ tokenId: string; amount: bigint }> }> {
  try {
    const response = await fetch(
      `${ERGO_EXPLORER_API}/api/v1/addresses/${address}/balance/total`
    );

    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      nanoErg: BigInt(data.nanoErgs || 0),
      tokens: (data.tokens || []).map((token: any) => ({
        tokenId: token.tokenId,
        amount: BigInt(token.amount),
      })),
    };
  } catch (error) {
    console.error('Error fetching address balance:', error);
    return { nanoErg: 0n, tokens: [] };
  }
}
