'use client';

import { useState, useEffect } from 'react';
import { walletConnector } from '@/lib/wallet-v2';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      if (!walletConnector.isNautilusAvailable()) {
        setError('Nautilus wallet not detected');
        return;
      }

      const connected = await walletConnector.isConnected();
      if (connected) {
        const addr = await walletConnector.getChangeAddress();
        setAddress(addr);
        setIsConnected(true);
        onConnect?.(addr);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (!walletConnector.isNautilusAvailable()) {
        setError('Nautilus wallet is not installed');
        return;
      }

      const connected = await walletConnector.connect();
      if (connected) {
        const addr = await walletConnector.getChangeAddress();
        setAddress(addr);
        setIsConnected(true);
        onConnect?.(addr);
      } else {
        setError('Failed to connect to wallet');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    walletConnector.disconnect();
    setIsConnected(false);
    setAddress('');
    onDisconnect?.();
  };

  if (!walletConnector.isNautilusAvailable()) {
    return (
      <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-200 mb-2">
          Nautilus wallet not detected
        </p>
        <a
          href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline text-sm"
        >
          Install Nautilus Extension →
        </a>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Connected Address
            </p>
            <p className="font-mono text-sm">
              {address.substring(0, 12)}...{address.substring(address.length - 8)}
            </p>
          </div>
          <button onClick={handleDisconnect} className="btn btn-secondary">
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="btn btn-primary w-full"
      >
        {isLoading ? 'Connecting...' : 'Connect Nautilus Wallet'}
      </button>
    </div>
  );
}
