'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { formatErg } from '@/lib/config_v2';

interface CreatorData {
  creator: {
    id: number;
    display_name: string;
    owner_address: string;
    payout_address: string;
  };
  snippets: Array<{
    id: number;
    title: string;
    status: string;
    category: string;
  }>;
  earnings: {
    total_earned_nanoerg: string;
    total_earned_erg: string;
    confirmed_payments: number;
    pending_payments: number;
  };
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [data, setData] = useState<CreatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (wallet.isConnected) {
      loadDashboard();
    }
  }, [wallet.isConnected, wallet.address]);

  const loadDashboard = async () => {
    try {
      const response = await fetch(`/api/creators/me?ownerAddress=${wallet.address}`);

      if (response.status === 404) {
        // Creator not registered yet
        router.push('/creator/register');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Connect Wallet</h2>
          <p className="mb-4">Please connect your wallet to access the creator dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 text-red-600">Error</h2>
          <p className="mb-4">{error}</p>
          <button onClick={loadDashboard} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Creator Not Found</h2>
          <p className="mb-4">You need to register as a creator first.</p>
          <button
            onClick={() => router.push('/creator/register')}
            className="btn btn-primary"
          >
            Register Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Creator Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back, {data.creator.display_name}
        </p>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.earnings.total_earned_erg} ERG
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Confirmed Payments</div>
          <div className="text-2xl font-bold">{data.earnings.confirmed_payments}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending Payments</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {data.earnings.pending_payments}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Snippets</div>
          <div className="text-2xl font-bold">{data.snippets.length}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => router.push('/creator/snippets/create')}
          className="btn btn-primary"
        >
          + Create New Snippet
        </button>
        <button onClick={loadDashboard} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      {/* Snippets List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Your Snippets</h2>
        {data.snippets.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No snippets yet. Create your first one!
          </p>
        ) : (
          <div className="space-y-4">
            {data.snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => router.push(`/creator/snippets/${snippet.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{snippet.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {snippet.category}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      snippet.status === 'published'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : snippet.status === 'draft'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {snippet.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="mt-8 card">
        <h2 className="text-xl font-bold mb-4">Account Information</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Creator ID:</span>
            <span className="ml-2 font-mono">{data.creator.id}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Owner Address:</span>
            <span className="ml-2 font-mono text-xs break-all">
              {data.creator.owner_address}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Payout Address:</span>
            <span className="ml-2 font-mono text-xs break-all">
              {data.creator.payout_address}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
