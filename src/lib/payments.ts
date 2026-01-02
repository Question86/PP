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
import type { Box } from '@fleet-sdk/common';
import type { PaymentIntent, ErgoUTXO, UnsignedTransaction } from '../types/v2';
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

  // Validate PaymentIntent totals match
  const platformAmount = BigInt(paymentIntent.platformOutput.amount);
  const creatorsTotal = paymentIntent.creatorOutputs.reduce(
    (sum, output) => sum + BigInt(output.amount),
    0n
  );
  const calculatedTotal = platformAmount + creatorsTotal;
  const declaredTotal = BigInt(paymentIntent.totalRequired);

  if (calculatedTotal !== declaredTotal) {
    throw new Error(
      `PaymentIntent mismatch: platform(${platformAmount}) + creators(${creatorsTotal}) = ${calculatedTotal}, but totalRequired=${declaredTotal}`
    );
  }

  // Calculate total required
  const requiredAmount = declaredTotal;
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

  // Calculate estimated change (actual change handled by TransactionBuilder)
  const estimatedChange = totalInputValue - requiredAmount - fee;

  // CRITICAL: Validate all output amounts >= MIN_BOX_VALUE
  const minBoxValue = BigInt(ERGO.MIN_BOX_VALUE);
  
  if (platformAmount < minBoxValue) {
    throw new Error(
      `Platform output (${platformAmount}) below minimum box value (${minBoxValue})`
    );
  }

  for (const creatorOutput of paymentIntent.creatorOutputs) {
    const amount = BigInt(creatorOutput.amount);
    if (amount < minBoxValue) {
      throw new Error(
        `Creator output to ${creatorOutput.address} (${amount}) below minimum box value (${minBoxValue})`
      );
    }
  }

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
      platformAmount,
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

  // Configure fee and change handling
  txBuilder.payFee(fee);
  txBuilder.sendChangeTo(userAddress);

  // Build unsigned transaction
  const unsignedTx = txBuilder.build().toEIP12Object();

  return {
    unsignedTx,
    totalInputValue,
    totalOutputValue: requiredAmount,
    fee,
    changeValue: estimatedChange,
  };
}

// =====================================================
// UTXO SELECTION
// =====================================================

/**
 * Greedy UTXO selection algorithm
 * Selects smallest ERG-only UTXOs first to avoid burning tokens
 */
function selectUtxos(utxos: ErgoUTXO[], requiredAmount: bigint): ErgoUTXO[] {
  // Filter to ERG-only boxes (no tokens) to prevent accidental token burn
  const ergOnlyUtxos = utxos.filter(utxo => !utxo.assets || utxo.assets.length === 0);
  
  if (ergOnlyUtxos.length === 0) {
    throw new Error(
      'No ERG-only UTXOs available. Token preservation not yet implemented.'
    );
  }

  // Sort by value ascending (smallest first)
  const sortedUtxos = [...ergOnlyUtxos].sort((a, b) => {
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
function encodeCompositionId(compositionId: number) {
  const bytes = Buffer.from(compositionId.toString(), 'utf-8');
  return SConstant(SColl(SByte, Array.from(bytes)));
}

/**
 * Encode snippet version IDs as int array for R5 register
 */
function encodeSnippetVersionIds(ids: number[]) {
  // For simplicity, encode as comma-separated string in bytes
  // Production: Use proper array encoding
  const str = ids.join(',');
  const bytes = Buffer.from(str, 'utf-8');
  return SConstant(SColl(SByte, Array.from(bytes)));
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
  const minBoxValue = BigInt(ERGO.MIN_BOX_VALUE);

  // Check platform output
  if (!intent.platformOutput.address || intent.platformOutput.address.length < 10) {
    errors.push('Invalid platform address');
  }
  const platformAmount = BigInt(intent.platformOutput.amount);
  if (platformAmount <= 0) {
    errors.push('Platform amount must be positive');
  }
  if (platformAmount < minBoxValue) {
    errors.push(`Platform amount (${platformAmount}) below minimum box value (${minBoxValue})`);
  }

  // Check creator outputs
  if (intent.creatorOutputs.length === 0) {
    errors.push('At least one creator output required');
  }

  for (const output of intent.creatorOutputs) {
    if (!output.address || output.address.length < 10) {
      errors.push(`Invalid creator address: ${output.address}`);
    }
    const amount = BigInt(output.amount);
    if (amount <= 0) {
      errors.push(`Creator amount must be positive: ${output.address}`);
    }
    if (amount < minBoxValue) {
      errors.push(`Creator amount to ${output.address} (${amount}) below minimum box value (${minBoxValue})`);
    }
  }

  // Check for duplicate creator addresses (should be aggregated)
  const addressSet = new Set<string>();
  for (const output of intent.creatorOutputs) {
    const addr = output.address.toLowerCase();
    if (addressSet.has(addr)) {
      errors.push(`Duplicate creator address found: ${output.address}. Creator outputs must be aggregated.`);
    }
    addressSet.add(addr);
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
