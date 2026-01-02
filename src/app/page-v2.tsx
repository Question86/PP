'use client';

import { useState } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { CompositionSummary } from '@/components/CompositionSummary';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [userAddress, setUserAddress] = useState<string>('');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConnect = (address: string) => {
    setUserAddress(address);
  };

  const handleSubmit = async () => {
    if (!userPrompt.trim() || !userAddress) {
      setError('Please connect wallet and enter your prompt');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create request
      const requestResponse = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, userPrompt }),
      });

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json();
        throw new Error(errorData.error || 'Failed to create request');
      }

      const { requestId } = await requestResponse.json();

      // Propose composition
      const proposeResponse = await fetch('/api/compositions/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!proposeResponse.ok) {
        const errorData = await proposeResponse.json();
        throw new Error(errorData.error || 'Failed to propose composition');
      }

      const { compositionId } = await proposeResponse.json();

      // Redirect to composition page
      router.push(`/composition/${compositionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">PromptPage</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Modular Prompt Engineering Marketplace
          </p>
        </header>

        <div className="space-y-6">
          <WalletConnect onConnect={handleConnect} />

          {userAddress && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">Describe Your Goal</h2>

              <label className="label">
                What do you want to achieve with your prompt?
              </label>
              <textarea
                className="input min-h-[200px]"
                placeholder="Example: I need a customer support chatbot that stays professional, outputs JSON, and handles escalations gracefully..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                disabled={isLoading}
              />

              <p className="text-sm text-gray-500 mt-2">
                {userPrompt.length} / 10,000 characters
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isLoading || !userPrompt.trim()}
                className="btn btn-primary w-full mt-6"
              >
                {isLoading ? 'Processing...' : 'Get Suggestions →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
