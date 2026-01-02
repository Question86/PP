/**
 * Type definitions for the application
 */

export type PromptStatus = 'stored' | 'mint_pending' | 'minted' | 'failed';

export interface Prompt {
  id: number;
  owner_address: string;
  prompt_text: string;
  prompt_hash: string;
  status: PromptStatus;
  mint_tx_id: string | null;
  token_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePromptRequest {
  ownerAddress: string;
  promptText: string;
}

export interface CreatePromptResponse {
  promptId: number;
  promptHashHex: string;
  urlPath: string;
}

export interface ConfirmMintRequest {
  txId: string;
  tokenId?: string;
}

export interface ConfirmMintResponse {
  ok: boolean;
}

export interface MintTransactionInputs {
  promptId: number;
  promptHashHex: string;
  urlPath: string;
  userAddress: string;
  utxos: ErgoUTXO[];
}

export interface ErgoUTXO {
  boxId: string;
  value: string;
  ergoTree: string;
  assets: ErgoAsset[];
  creationHeight: number;
  additionalRegisters: Record<string, string>;
  transactionId: string;
  index: number;
}

export interface ErgoAsset {
  tokenId: string;
  amount: string;
}

export interface NautilusConnector {
  isConnected: () => Promise<boolean>;
  connect: () => Promise<boolean>;
  getContext: () => Promise<NautilusContext>;
  getUtxos: (params?: { amount?: string; paginate?: { page: number; limit: number } }) => Promise<ErgoUTXO[]>;
  getBalance: (tokenId?: string) => Promise<string>;
  getUsedAddresses: () => Promise<string[]>;
  getUnusedAddresses: () => Promise<string[]>;
  getChangeAddress: () => Promise<string>;
  signTx: (tx: any) => Promise<string>;
  submitTx: (signedTx: string) => Promise<string>;
}

export interface NautilusContext {
  network_type: 'mainnet' | 'testnet';
}

declare global {
  interface Window {
    ergoConnector?: {
      nautilus?: {
        isConnected: () => Promise<boolean>;
        connect: () => Promise<boolean>;
        getContext: () => Promise<NautilusContext>;
        getUtxos: (params?: { amount?: string; paginate?: { page: number; limit: number } }) => Promise<ErgoUTXO[]>;
        getBalance: (tokenId?: string) => Promise<string>;
        getUsedAddresses: () => Promise<string[]>;
        getUnusedAddresses: () => Promise<string[]>;
        getChangeAddress: () => Promise<string>;
        signTx: (tx: any) => Promise<string>;
        submitTx: (signedTx: string) => Promise<string>;
      };
    };
  }
}
