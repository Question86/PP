'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';

export default function CreatorRegisterPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [displayName, setDisplayName] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!wallet.isConnected) {
      setError('Please connect wallet first');
      return;
    }

    if (!displayName.trim()) {
      setError('Display name required');
      return;
    }

    // Use wallet address if payout address not specified
    const finalPayoutAddress = payoutAddress.trim() || wallet.address;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: wallet.address,
          payoutAddress: finalPayoutAddress,
          displayName: displayName.trim(),
          bio: bio.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Already registered
          alert('You are already registered as a creator!');
          router.push('/creator/dashboard');
          return;
        }
        throw new Error(data.error || 'Registration failed');
      }

      alert(`Creator registered successfully! ID: ${data.creatorId}`);
      router.push('/creator/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Creator Registration</h1>

        {!wallet.isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
            <p className="text-yellow-800 dark:text-yellow-200">
              Connect your wallet to register as a creator
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Display Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name or Studio"
              className="input w-full"
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Owner Address (Wallet)</label>
            <input
              type="text"
              value={wallet.address || 'Not connected'}
              disabled
              className="input w-full bg-gray-100 dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This wallet controls your creator account
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Payout Address (optional)
            </label>
            <input
              type="text"
              value={payoutAddress}
              onChange={(e) => setPayoutAddress(e.target.value)}
              placeholder={wallet.address || '9f...'}
              className="input w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Earnings will be sent here. Leave empty to use your wallet address.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell users about your expertise..."
              className="input w-full"
              rows={4}
              maxLength={1000}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={isLoading || !wallet.isConnected || !displayName.trim()}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Registering...' : 'Register as Creator'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="btn btn-secondary w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
