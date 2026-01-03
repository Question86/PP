'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/hooks/useWallet';

interface Snippet {
  id: number;
  title: string;
  summary: string | null;
  category: string;
  price_nanoerg: number;
  creator_name: string;
}

export default function BrowsePage() {
  const router = useRouter();
  const wallet = useWallet();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedSnippets, setSelectedSnippets] = useState<Set<number>>(new Set());
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available snippets
  useEffect(() => {
    fetchSnippets();
  }, []);

  const fetchSnippets = async () => {
    try {
      const response = await fetch('/api/snippets');
      if (!response.ok) throw new Error('Failed to fetch snippets');
      const data = await response.json();
      setSnippets(data.snippets || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleSnippet = (snippetId: number) => {
    const newSelected = new Set(selectedSnippets);
    if (newSelected.has(snippetId)) {
      newSelected.delete(snippetId);
    } else {
      newSelected.add(snippetId);
    }
    setSelectedSnippets(newSelected);
  };

  const handleCreateComposition = async () => {
    if (!wallet.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (selectedSnippets.size === 0) {
      setError('Please select at least one snippet');
      return;
    }

    if (!userPrompt.trim()) {
      setError('Please enter your prompt');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Step 1: Create request
      const requestResponse = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet.address,
          userPrompt: userPrompt.trim(),
        }),
      });

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json();
        throw new Error(errorData.error || 'Failed to create request');
      }

      const { requestId } = await requestResponse.json();

      // Step 2: Propose composition
      const proposeResponse = await fetch('/api/compositions/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!proposeResponse.ok) {
        const errorData = await proposeResponse.json();
        throw new Error(errorData.error || 'Failed to create composition');
      }

      const { compositionId } = await proposeResponse.json();

      // Navigate to payment page
      router.push(`/pay/${compositionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create composition');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    return Array.from(selectedSnippets).reduce((total, id) => {
      const snippet = snippets.find(s => s.id === id);
      return total + (snippet?.price_nanoerg || 0);
    }, 0);
  };

  const totalNanoErg = calculateTotal();
  const platformFee = 5_000_000; // 0.005 ERG
  const grandTotal = totalNanoErg + platformFee;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">PromptPage Marketplace</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Build your perfect AI prompt from modular snippets
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8">
        <WalletConnect />
      </div>

      {/* Prompt Input */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">
          Your Prompt / Use Case
        </label>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Describe what you want to create with AI..."
          className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          rows={3}
          disabled={isLoading}
        />
        <p className="text-sm text-gray-500 mt-1">
          The system will recommend snippets based on your prompt
        </p>
      </div>

      {/* Snippets Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Available Snippets</h2>
        
        {snippets.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500">No snippets available yet</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedSnippets.has(snippet.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-blue-300'
                }`}
                onClick={() => toggleSnippet(snippet.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{snippet.title}</h3>
                  <input
                    type="checkbox"
                    checked={selectedSnippets.has(snippet.id)}
                    onChange={() => toggleSnippet(snippet.id)}
                    className="mt-1"
                  />
                </div>
                
                {snippet.summary && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {snippet.summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {snippet.category}
                  </span>
                  <span className="font-mono font-semibold">
                    {(snippet.price_nanoerg / 1_000_000_000).toFixed(3)} ERG
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  by {snippet.creator_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Summary */}
      {selectedSnippets.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-800 shadow-lg">
          <div className="container mx-auto px-4 py-4 max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedSnippets.size} snippet{selectedSnippets.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-lg font-semibold">
                  Total: {(grandTotal / 1_000_000_000).toFixed(3)} ERG
                  <span className="text-sm text-gray-500 ml-2">
                    (inc. 0.005 ERG platform fee)
                  </span>
                </p>
              </div>

              <button
                onClick={handleCreateComposition}
                disabled={isLoading || !wallet.isConnected}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating...' : 'Continue to Payment'}
              </button>
            </div>

            {error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
