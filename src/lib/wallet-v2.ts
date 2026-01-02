// Nautilus Wallet Connector for V2 (Updated for Multi-Output Transactions)
'use client';

import type { ErgoUTXO, UnsignedTransaction, SignedTransaction } from '@/types/v2';

declare global {
  interface Window {
    ergoConnector?: {
      nautilus?: {
        connect: () => Promise<boolean>;
        isConnected: () => Promise<boolean>;
        getContext: () => Promise<any>;
      };
    };
    ergo?: any;
  }
}

export class WalletConnector {
  private static instance: WalletConnector;

  private constructor() {}

  public static getInstance(): WalletConnector {
    if (!WalletConnector.instance) {
      WalletConnector.instance = new WalletConnector();
    }
    return WalletConnector.instance;
  }

  /**
   * Check if Nautilus is installed
   */
  public isNautilusAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ergoConnector?.nautilus;
  }

  /**
   * Connect to Nautilus wallet
   */
  public async connect(): Promise<boolean> {
    if (!this.isNautilusAvailable()) {
      throw new Error('Nautilus wallet is not installed');
    }

    try {
      const connected = await window.ergoConnector!.nautilus!.connect();
      return connected;
    } catch (error) {
      console.error('Failed to connect to Nautilus:', error);
      throw error;
    }
  }

  /**
   * Check if already connected
   */
  public async isConnected(): Promise<boolean> {
    if (!this.isNautilusAvailable()) {
      return false;
    }

    try {
      return await window.ergoConnector!.nautilus!.isConnected();
    } catch (error) {
      console.error('Failed to check connection status:', error);
      return false;
    }
  }

  /**
   * Get user's Ergo address
   */
  public async getChangeAddress(): Promise<string> {
    const context = await this.getContext();
    const addresses = await context.get_change_address();
    return addresses;
  }

  /**
   * Get user's UTXOs
   */
  public async getUtxos(
    amount?: string,
    tokenId?: string
  ): Promise<ErgoUTXO[]> {
    const context = await this.getContext();
    const utxosRaw = await context.get_utxos(amount, tokenId);

    return utxosRaw.map((utxo: any) => ({
      boxId: utxo.boxId,
      value: utxo.value.toString(),
      ergoTree: utxo.ergoTree,
      assets: utxo.assets || [],
      creationHeight: utxo.creationHeight,
      additionalRegisters: utxo.additionalRegisters || {},
      transactionId: utxo.transactionId,
      index: utxo.index,
    }));
  }

  /**
   * Get wallet balance
   */
  public async getBalance(): Promise<string> {
    const context = await this.getContext();
    const balance = await context.get_balance();
    return balance;
  }

  /**
   * Sign transaction
   */
  public async signTx(unsignedTx: UnsignedTransaction): Promise<SignedTransaction> {
    const context = await this.getContext();
    const signedTx = await context.sign_tx(unsignedTx);
    return signedTx;
  }

  /**
   * Submit signed transaction
   */
  public async submitTx(signedTx: SignedTransaction): Promise<string> {
    const context = await this.getContext();
    const txId = await context.submit_tx(signedTx);
    return txId;
  }

  /**
   * Get Ergo context (internal)
   */
  private async getContext(): Promise<any> {
    if (!this.isNautilusAvailable()) {
      throw new Error('Nautilus wallet is not installed');
    }

    const connected = await this.isConnected();
    if (!connected) {
      throw new Error('Wallet is not connected');
    }

    const context = await window.ergoConnector!.nautilus!.getContext();
    return context;
  }

  /**
   * Disconnect wallet
   */
  public disconnect(): void {
    // Nautilus doesn't have explicit disconnect in current API
    // Clear any local state if needed
  }
}

// Singleton instance
export const walletConnector = WalletConnector.getInstance();
