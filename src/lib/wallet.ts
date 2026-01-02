/**
 * Nautilus wallet connector for browser
 */
'use client';

import { NautilusConnector, ErgoUTXO } from '@/types';

class WalletConnector {
  private nautilus: NautilusConnector | null = null;

  /**
   * Check if Nautilus wallet is installed
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined' && 
           !!window.ergoConnector?.nautilus;
  }

  /**
   * Connect to Nautilus wallet
   */
  async connect(): Promise<boolean> {
    if (!this.isInstalled()) {
      throw new Error('Nautilus wallet is not installed');
    }

    try {
      this.nautilus = window.ergoConnector!.nautilus!;
      const connected = await this.nautilus.connect();
      return connected;
    } catch (error) {
      console.error('Failed to connect to Nautilus:', error);
      throw error;
    }
  }

  /**
   * Check if wallet is connected
   */
  async isConnected(): Promise<boolean> {
    if (!this.nautilus) {
      return false;
    }

    try {
      return await this.nautilus.isConnected();
    } catch (error) {
      console.error('Failed to check connection status:', error);
      return false;
    }
  }

  /**
   * Get user's change address
   */
  async getChangeAddress(): Promise<string> {
    this.ensureConnected();
    return await this.nautilus!.getChangeAddress();
  }

  /**
   * Get user's UTXOs
   */
  async getUtxos(amount?: string): Promise<ErgoUTXO[]> {
    this.ensureConnected();
    return await this.nautilus!.getUtxos(amount ? { amount } : undefined);
  }

  /**
   * Get wallet balance in nanoERG
   */
  async getBalance(): Promise<string> {
    this.ensureConnected();
    return await this.nautilus!.getBalance();
  }

  /**
   * Get network context
   */
  async getContext() {
    this.ensureConnected();
    return await this.nautilus!.getContext();
  }

  /**
   * Sign a transaction
   */
  async signTx(tx: any): Promise<string> {
    this.ensureConnected();
    return await this.nautilus!.signTx(tx);
  }

  /**
   * Submit a signed transaction
   */
  async submitTx(signedTx: string): Promise<string> {
    this.ensureConnected();
    return await this.nautilus!.submitTx(signedTx);
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.nautilus = null;
  }

  private ensureConnected(): void {
    if (!this.nautilus) {
      throw new Error('Wallet is not connected');
    }
  }
}

// Singleton instance
export const walletConnector = new WalletConnector();
