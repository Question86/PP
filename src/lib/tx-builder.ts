/**
 * Ergo transaction builder using Fleet SDK
 */
'use client';

import {
  OutputBuilder,
  TransactionBuilder,
  RECOMMENDED_MIN_FEE_VALUE,
  SConstant,
  SColl,
  SByte,
  SInt,
} from '@fleet-sdk/core';
import { hexToBytes } from '@fleet-sdk/common';
import { 
  ErgoUTXO, 
  MintTransactionInputs 
} from '@/types';
import {
  NFT_BOX_VALUE,
  SERVICE_FEE_NANOERG,
  PLATFORM_ERGO_ADDRESS,
  NFT_DECIMALS,
  NFT_NAME_PREFIX,
  NFT_DESCRIPTION,
  MIN_BOX_VALUE,
} from './config';

/**
 * Build an unsigned Ergo transaction that:
 * 1. Mints a unique NFT
 * 2. Sends NFT to user with prompt metadata in registers
 * 3. Pays service fee to platform
 * 4. Returns change to user
 */
export async function buildMintTransaction(
  inputs: MintTransactionInputs,
  creationHeight: number
): Promise<any> {
  const {
    promptId,
    promptHashHex,
    urlPath,
    userAddress,
    utxos,
  } = inputs;

  // Select UTXOs for funding (simple greedy selection)
  const requiredAmount = BigInt(NFT_BOX_VALUE + SERVICE_FEE_NANOERG + RECOMMENDED_MIN_FEE_VALUE);
  const selectedUtxos: ErgoUTXO[] = [];
  let totalAmount = BigInt(0);

  for (const utxo of utxos) {
    selectedUtxos.push(utxo);
    totalAmount += BigInt(utxo.value);
    
    if (totalAmount >= requiredAmount) {
      break;
    }
  }

  if (totalAmount < requiredAmount) {
    throw new Error(
      `Insufficient funds. Required: ${requiredAmount.toString()} nanoERG, Available: ${totalAmount.toString()} nanoERG`
    );
  }

  // The first input's box ID will determine the NFT token ID
  const firstInputBoxId = selectedUtxos[0].boxId;
  const tokenId = firstInputBoxId; // Token ID = first input box ID

  // Build transaction
  const txBuilder = new TransactionBuilder(creationHeight);

  // Add inputs
  for (const utxo of selectedUtxos) {
    txBuilder.from(utxo);
  }

  // Output 1: NFT to user with metadata in registers
  const nftOutput = new OutputBuilder(
    NFT_BOX_VALUE.toString(),
    userAddress
  );

  // Mint the NFT token
  nftOutput.mintToken({
    amount: '1',
    name: `${NFT_NAME_PREFIX}${promptId}`,
    decimals: NFT_DECIMALS,
    description: NFT_DESCRIPTION,
  });

  // Set registers with prompt metadata
  // R4: prompt hash (bytes)
  const promptHashBytes = hexToBytes(promptHashHex);
  nftOutput.setAdditionalRegisters({
    R4: SConstant(SColl(SByte, Array.from(promptHashBytes))),
    R5: SConstant(SInt(promptId)),
    R6: SConstant(SColl(SByte, Array.from(Buffer.from(urlPath, 'utf8')))),
  });

  txBuilder.to(nftOutput);

  // Output 2: Service fee to platform
  const feeOutput = new OutputBuilder(
    SERVICE_FEE_NANOERG.toString(),
    PLATFORM_ERGO_ADDRESS
  );
  txBuilder.to(feeOutput);

  // Configure transaction fee and change address
  txBuilder.sendChangeTo(userAddress);
  txBuilder.payFee(RECOMMENDED_MIN_FEE_VALUE.toString());

  // Build unsigned transaction
  const unsignedTx = txBuilder.build();

  return unsignedTx.toEIP12Object();
}

/**
 * Helper to encode string to bytes for registers
 */
export function encodeString(str: string): number[] {
  return Array.from(Buffer.from(str, 'utf8'));
}

/**
 * Helper to encode integer for registers
 */
export function encodeInt(num: number): string {
  return num.toString();
}

/**
 * Get creation height from explorer API
 */
export async function getCurrentHeight(explorerUrl: string): Promise<number> {
  try {
    const response = await fetch(`${explorerUrl}/api/v1/blocks?limit=1`);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items[0].height;
    }
    
    throw new Error('Could not fetch current height');
  } catch (error) {
    console.error('Error fetching current height:', error);
    // Return a reasonable default for testnet
    return 1000000;
  }
}
