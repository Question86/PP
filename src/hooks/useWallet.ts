'use client';

import { useState, useEffect, useCallback } from 'react';
import { walletConnector } from '@/lib/wallet-v2';
import type { ErgoUTXO } from '@/types/v2';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    isLoading: false,
    error: null,
  });

  // Check if Nautilus is available
  const isAvailable = useCallback(() => {
    return walletConnector.isNautilusAvailable();
  }, []);

  // Connect to wallet
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!isAvailable()) {
        throw new Error('Nautilus wallet not installed');
      }

      const connected = await walletConnector.connect();
      if (!connected) {
        throw new Error('Failed to connect to wallet');
      }

      const address = await walletConnector.getChangeAddress();
      const balance = await walletConnector.getBalance();

      setState({
        isConnected: true,
        address,
        balance,
        isLoading: false,
        error: null,
      });

      return address;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Connection failed',
      }));
      throw error;
    }
  }, [isAvailable]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    walletConnector.disconnect();
    setState({
      isConnected: false,
      address: null,
      balance: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Get UTXOs
  const getUtxos = useCallback(async (
    amount?: string,
    tokenId?: string
  ): Promise<ErgoUTXO[]> => {
    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }
    return await walletConnector.getUtxos(amount, tokenId);
  }, [state.isConnected]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!state.isConnected) return;

    try {
      const balance = await walletConnector.getBalance();
      setState(prev => ({ ...prev, balance }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [state.isConnected]);

  // Check connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!isAvailable()) return;

      try {
        const connected = await walletConnector.isConnected();
        if (connected) {
          const address = await walletConnector.getChangeAddress();
          const balance = await walletConnector.getBalance();

          setState({
            isConnected: true,
            address,
            balance,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    };

    checkConnection();
  }, [isAvailable]);

  return {
    ...state,
    isAvailable: isAvailable(),
    connect,
    disconnect,
    getUtxos,
    refreshBalance,
    signTx: walletConnector.signTx.bind(walletConnector),
    submitTx: walletConnector.submitTx.bind(walletConnector),
  };
}
