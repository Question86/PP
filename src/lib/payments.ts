// V2 Payment Transaction Builder
// Builds multi-output split payment transactions with aggregation

import {
  TransactionBuilder,
  OutputBuilder,
  SConstant,
  SColl,
  SByte,
  SInt,
} from '@fleet-sdk/core';
import type { Box, UnsignedTransaction } from '@fleet-sdk/common';
import type { PaymentIntent, ErgoUTXO } from '../types/v2';
import { ERGO } from './config_v2';

// =====================================================
// TYPES
// =====================================================

interface BuildPaymentTxParams {
  paymentIntent: PaymentIntent;
  userAddress: string;
  utxos: ErgoUTXO[];
}

interface BuildResult {
  unsignedTx: UnsignedTransaction;
  totalInputValue: bigint;
  totalOutputValue: bigint;
  fee: bigint;
  changeValue: bigint;
}

// =====================================================
// MAIN BUILDER FUNCTION
// =====================================================

/**
 * Build a split payment transaction for composition payment
 * Creates aggregated outputs per creator to minimize tx size
 */
export async function buildPaymentTransaction(
  params: BuildPaymentTxParams
): Promise<BuildResult> {
  const { paymentIntent, userAddress, utxos } = params;

  // Calculate total required
  const requiredAmount = BigInt(paymentIntent.totalRequired);
  const fee = BigInt(ERGO.RECOMMENDED_MIN_FEE_VALUE);
  const totalNeeded = requiredAmount + fee;

  // Select UTXOs (greedy algorithm)
  const selectedUtxos = selectUtxos(utxos, totalNeeded);
  const totalInputValue = selectedUtxos.reduce(
    (sum, utxo) => sum + BigInt(utxo.value),
    0n
  );

  if (totalInputValue < totalNeeded) {
    throw new Error(
      `Insufficient funds: need ${totalNeeded}, have ${totalInputValue}`
    );
  }

  // Calculate change
  const changeValue = totalInputValue - requiredAmount - fee;

  // Get current blockchain height
  const currentHeight = await getCurrentHeight();

  // Build transaction
  const txBuilder = new TransactionBuilder(currentHeight);

  // Add inputs
  for (const utxo of selectedUtxos) {
    txBuilder.from(convertToFleetBox(utxo));
  }

  // Output 1: Platform Fee
  txBuilder.to(
    new OutputBuilder(
      BigInt(paymentIntent.platformOutput.amount),
      paymentIntent.platformOutput.address
    ).addTokens([]
    ).setAdditionalRegisters({
      R4: encodeCompositionId(paymentIntent.compositionId),
    })
  );

  // Outputs 2..N: Creator Payouts (Aggregated)
  for (const creatorOutput of paymentIntent.creatorOutputs) {
    txBuilder.to(
      new OutputBuilder(
        BigInt(creatorOutput.amount),
        creatorOutput.address
      ).setAdditionalRegisters({
        R4: encodeCompositionId(paymentIntent.compositionId),
        R5: encodeSnippetVersionIds(creatorOutput.snippetVersionIds),
      })
    );
  }

  // Output N+1: Change back to user
  if (changeValue > 0) {
    txBuilder.to(
      new OutputBuilder(changeValue, userAddress)
    );
  }

  // Configure fee
  txBuilder.payFee(fee);

  // Send change to user
  txBuilder.sendChangeTo(userAddress);

  // Build unsigned transaction
  const unsignedTx = txBuilder.build().toEIP12Object();

  return {
    unsignedTx,
    totalInputValue,
    totalOutputValue: requiredAmount,
    fee,
    changeValue,
  };
}

// =====================================================
// UTXO SELECTION
// =====================================================

/**
 * Greedy UTXO selection algorithm
 * Selects smallest UTXOs first until required amount is met
 */
function selectUtxos(utxos: ErgoUTXO[], requiredAmount: bigint): ErgoUTXO[] {
  // Sort by value ascending (smallest first)
  const sortedUtxos = [...utxos].sort((a, b) => {
    const aVal = BigInt(a.value);
    const bVal = BigInt(b.value);
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  const selected: ErgoUTXO[] = [];
  let total = 0n;

  for (const utxo of sortedUtxos) {
    selected.push(utxo);
    total += BigInt(utxo.value);

    if (total >= requiredAmount) {
      break;
    }
  }

  return selected;
}

// =====================================================
// REGISTER ENCODING
// =====================================================

/**
 * Encode composition ID as bytes for R4 register
 */
function encodeCompositionId(compositionId: number): string {
  const bytes = Buffer.from(compositionId.toString(), 'utf-8');
  return SConstant(SColl(SByte, Array.from(bytes))).toHex();
}

/**
 * Encode snippet version IDs as int array for R5 register
 */
function encodeSnippetVersionIds(ids: number[]): string {
  // For simplicity, encode as comma-separated string in bytes
  // Production: Use proper array encoding
  const str = ids.join(',');
  const bytes = Buffer.from(str, 'utf-8');
  return SConstant(SColl(SByte, Array.from(bytes))).toHex();
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Convert ErgoUTXO to Fleet SDK Box format
 */
function convertToFleetBox(utxo: ErgoUTXO): Box<bigint> {
  return {
    boxId: utxo.boxId,
    value: BigInt(utxo.value),
    ergoTree: utxo.ergoTree,
    assets: utxo.assets.map((asset) => ({
      tokenId: asset.tokenId,
      amount: BigInt(asset.amount),
    })),
    creationHeight: utxo.creationHeight,
    additionalRegisters: utxo.additionalRegisters,
    transactionId: utxo.transactionId,
    index: utxo.index,
  };
}

/**
 * Get current blockchain height from Explorer API
 */
async function getCurrentHeight(): Promise<number> {
  try {
    const explorerUrl =
      process.env.NEXT_PUBLIC_ERGO_EXPLORER_API ||
      'https://api-testnet.ergoplatform.com';
    const response = await fetch(`${explorerUrl}/api/v1/blocks?limit=1`);

    if (!response.ok) {
      throw new Error('Failed to fetch current height');
    }

    const data = await response.json();
    return data.items[0]?.height || 0;
  } catch (error) {
    console.error('Error fetching current height:', error);
    // Fallback to a reasonable height (testnet current ~500k)
    return 500000;
  }
}

// =====================================================
// AGGREGATION HELPER
// =====================================================

/**
 * Aggregate composition items by creator address
 * This reduces the number of outputs in the transaction
 */
export function aggregatePayoutsByCreator(
  items: Array<{
    creator_payout_address: string;
    price_nanoerg: string;
    snippet_version_id: number;
  }>
): Array<{
  address: string;
  amount: string;
  snippetCount: number;
  snippetVersionIds: number[];
}> {
  const aggregated = new Map<
    string,
    {
      amount: bigint;
      snippetCount: number;
      snippetVersionIds: number[];
    }
  >();

  for (const item of items) {
    const existing = aggregated.get(item.creator_payout_address) || {
      amount: 0n,
      snippetCount: 0,
      snippetVersionIds: [],
    };

    aggregated.set(item.creator_payout_address, {
      amount: existing.amount + BigInt(item.price_nanoerg),
      snippetCount: existing.snippetCount + 1,
      snippetVersionIds: [
        ...existing.snippetVersionIds,
        item.snippet_version_id,
      ],
    });
  }

  return Array.from(aggregated.entries()).map(([address, data]) => ({
    address,
    amount: data.amount.toString(),
    snippetCount: data.snippetCount,
    snippetVersionIds: data.snippetVersionIds,
  }));
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validate payment intent before building transaction
 */
export function validatePaymentIntent(
  intent: PaymentIntent
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check platform output
  if (!intent.platformOutput.address || intent.platformOutput.address.length < 10) {
    errors.push('Invalid platform address');
  }
  if (BigInt(intent.platformOutput.amount) <= 0) {
    errors.push('Platform amount must be positive');
  }

  // Check creator outputs
  if (intent.creatorOutputs.length === 0) {
    errors.push('At least one creator output required');
  }

  for (const output of intent.creatorOutputs) {
    if (!output.address || output.address.length < 10) {
      errors.push(`Invalid creator address: ${output.address}`);
    }
    if (BigInt(output.amount) <= 0) {
      errors.push(`Creator amount must be positive: ${output.address}`);
    }
  }

  // Check total calculation
  const calculatedTotal =
    BigInt(intent.platformOutput.amount) +
    intent.creatorOutputs.reduce(
      (sum, output) => sum + BigInt(output.amount),
      0n
    );

  if (calculatedTotal.toString() !== intent.totalRequired) {
    errors.push('Total required does not match sum of outputs');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
