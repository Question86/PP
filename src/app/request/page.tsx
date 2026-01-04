'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { WalletConnect } from '@/components/WalletConnect';

interface Recommendation {
  snippetId: number;
  versionId: number;
  title: string;
  summary: string | null;
  category: string;
  tags: string | null;
  priceNanoerg: string;
  creatorDisplayName: string;
  creatorPayoutAddress: string;
  score: number;
  reason: string;
}

interface Selection {
  versionId: number;
  creatorPayoutAddress: string;
  priceNanoerg: string;
}

export default function RequestPage() {
  const router = useRouter();
  const wallet = useWallet();

  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selections, setSelections] = useState<Map<number, Selection>>(new Map());
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const handleGetRecommendations = async () => {
    if (userPrompt.trim().length < 10) {
      setError('Please enter at least 10 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    setRecommendations([]);
    setSelections(new Map());

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt, limit: 20 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const data = await response.json();
      setRecommendations(data.suggestions);
      setKeywords(data.keywords || []);
      console.log('Recommendations:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (rec: Recommendation) => {
    const newSelections = new Map(selections);
    
    if (newSelections.has(rec.versionId)) {
      newSelections.delete(rec.versionId);
    } else {
      newSelections.set(rec.versionId, {
        versionId: rec.versionId,
        creatorPayoutAddress: rec.creatorPayoutAddress,
        priceNanoerg: rec.priceNanoerg,
      });
    }
    
    setSelections(newSelections);
  };

  const calculateTotal = (): bigint => {
    let total = 0n;
    selections.forEach(sel => {
      total += BigInt(sel.priceNanoerg);
    });
    return total;
  };

  const handleProceedToPayment = async () => {
    if (!wallet.address) {
      setError('Please connect your wallet');
      return;
    }

    if (selections.size === 0) {
      setError('Please select at least one snippet');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Create request
      const requestResponse = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet.address,
          userPrompt,
        }),
      });

      if (!requestResponse.ok) {
        throw new Error('Failed to create request');
      }

      const requestData = await requestResponse.json();
      const requestId = requestData.requestId;

      // 2. Create composition
      const items = Array.from(selections.values()).map((sel, index) => ({
        snippetVersionId: sel.versionId,
        creatorPayoutAddress: sel.creatorPayoutAddress,
        priceNanoerg: sel.priceNanoerg,
        position: index,
      }));

      const composeResponse = await fetch('/api/compositions/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          userAddress: wallet.address,
          items,
        }),
      });

      if (!composeResponse.ok) {
        const errorData = await composeResponse.json();
        throw new Error(errorData.error || 'Failed to create composition');
      }

      const composeData = await composeResponse.json();
      const compositionId = composeData.compositionId;

      // 3. Lock composition
      const lockResponse = await fetch(`/api/compositions/${compositionId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: wallet.address }),
      });

      if (!lockResponse.ok) {
        throw new Error('Failed to lock composition');
      }

      // 4. Redirect to payment page
      router.push(`/pay/${compositionId}`);

    } catch (err: any) {
      console.error('Proceed error:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const buildMasterPrompt = (): string => {
    if (selections.size === 0) return userPrompt;

    const selectedSnippets = recommendations.filter(rec => 
      selections.has(rec.versionId)
    );

    const snippetSection = selectedSnippets
      .map((rec, index) => `### Snippet ${index + 1}: ${rec.title}\n[Content will be injected after payment]`)
      .join('\n\n');

    return `${snippetSection}\n\n---\n\n### User Request:\n${userPrompt}`;
  };

  const totalNanoerg = calculateTotal();
  const totalErg = Number(totalNanoerg) / 1_000_000_000;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Request Prompt Snippets</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Describe what you need, select recommended snippets, and build your custom prompt
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8">
        <WalletConnect />
      </div>

      {/* User Prompt Input */}
      <div className="mb-8 border rounded-lg p-6 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">1. Describe Your Need</h2>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Example: I need a professional customer support prompt that handles escalations, maintains formal tone, and outputs JSON..."
          className="w-full h-32 px-4 py-3 border rounded-lg dark:border-gray-600 dark:bg-gray-800 resize-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {userPrompt.length} characters (minimum 10)
          </p>
          <button
            onClick={handleGetRecommendations}
            disabled={isLoading || userPrompt.trim().length < 10}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Searching...' : 'Get Recommendations'}
          </button>
        </div>
      </div>

      {/* Keywords Display */}
      {keywords.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-semibold mb-2">Detected Keywords:</p>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, idx) => (
              <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full text-sm">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <p className="font-semibold mb-1">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Recommendations Display */}
      {recommendations.length > 0 && (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              2. Select Snippets ({recommendations.length} recommendations)
            </h2>
            <div className="space-y-3">
              {recommendations.map((rec) => {
                const isSelected = selections.has(rec.versionId);
                return (
                  <div
                    key={rec.versionId}
                    onClick={() => toggleSelection(rec)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-5 h-5"
                          />
                          <h3 className="font-semibold text-lg">{rec.title}</h3>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                            {rec.category}
                          </span>
                          <span className="text-sm text-gray-500">
                            Score: {rec.score.toFixed(1)} ({rec.reason})
                          </span>
                        </div>
                        {rec.summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ml-8">
                            {rec.summary}
                          </p>
                        )}
                        {rec.tags && (
                          <div className="flex flex-wrap gap-1 ml-8">
                            {rec.tags.split(',').map((tag, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2 ml-8">
                          by {rec.creatorDisplayName}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-mono font-semibold">
                          {(parseInt(rec.priceNanoerg) / 1_000_000_000).toFixed(3)} ERG
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master Prompt Preview */}
          {selections.size > 0 && (
            <div className="mb-8 border rounded-lg p-6 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4">3. Master Prompt Preview</h2>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                {buildMasterPrompt()}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Snippet content will be injected after successful payment
              </p>
            </div>
          )}

          {/* Total and Proceed */}
          {selections.size > 0 && (
            <div className="border rounded-lg p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selected Snippets</p>
                  <p className="text-2xl font-bold">{selections.size}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Price</p>
                  <p className="text-2xl font-bold font-mono">{totalErg.toFixed(3)} ERG</p>
                  <p className="text-xs text-gray-500">(+ 0.005 ERG platform fee)</p>
                </div>
              </div>
              <button
                onClick={handleProceedToPayment}
                disabled={isLoading || !wallet.isConnected}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
              >
                {isLoading ? 'Processing...' : wallet.isConnected ? 'Proceed to Payment' : 'Connect Wallet to Continue'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && recommendations.length === 0 && userPrompt.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No recommendations yet. Click "Get Recommendations" to search.</p>
        </div>
      )}
    </div>
  );
}
