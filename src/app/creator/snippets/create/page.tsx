'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';

const CATEGORIES = [
  { value: 'guardrail', label: 'Guardrail' },
  { value: 'format', label: 'Format' },
  { value: 'tone', label: 'Tone' },
  { value: 'eval', label: 'Evaluation' },
  { value: 'tooling', label: 'Tooling' },
  { value: 'context', label: 'Context' },
  { value: 'other', label: 'Other' },
];

export default function CreateSnippetPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('guardrail');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('0.01');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!wallet.isConnected) {
      setError('Please connect your wallet');
      return;
    }

    // Validation
    if (!title.trim()) {
      setError('Title required');
      return;
    }

    if (!content.trim()) {
      setError('Content required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Invalid price');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Step 1: Create snippet
      const snippetResponse = await fetch('/api/creators/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: wallet.address,
          title: title.trim(),
          summary: summary.trim() || undefined,
          category,
        }),
      });

      if (!snippetResponse.ok) {
        const data = await snippetResponse.json();
        throw new Error(data.error || 'Failed to create snippet');
      }

      const { snippetId } = await snippetResponse.json();

      // Step 2: Create first version
      const versionResponse = await fetch(`/api/creators/snippets/${snippetId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: wallet.address,
          content: content.trim(),
          price_nanoerg: (priceNum * 1e9).toString(),
        }),
      });

      if (!versionResponse.ok) {
        const data = await versionResponse.json();
        throw new Error(data.error || 'Failed to create version');
      }

      // Step 3: Publish snippet
      const publishResponse = await fetch(`/api/creators/snippets/${snippetId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: wallet.address,
        }),
      });

      if (!publishResponse.ok) {
        const data = await publishResponse.json();
        throw new Error(data.error || 'Failed to publish snippet');
      }

      alert('Snippet created and published successfully!');
      router.push('/creator/dashboard');
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
          <p className="mb-4">Please connect your wallet to create snippets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Create New Snippet</h1>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Professional Tone Enforcer"
              className="input w-full"
              maxLength={255}
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium mb-2">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ensures formal business communication..."
              className="input w-full"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-2">Prompt Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="You must maintain a professional, formal tone in all responses. Avoid slang, emojis, and casual language..."
              className="input w-full font-mono text-sm"
              rows={12}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This is the actual prompt text users will receive after payment
            </p>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Price (ERG) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.01"
              step="0.001"
              min="0"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Price in ERG (1 ERG = 1,000,000,000 nanoERG)
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleCreate}
              disabled={isLoading || !title.trim() || !content.trim()}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Creating...' : 'Create & Publish Snippet'}
            </button>
            <button
              onClick={() => router.push('/creator/dashboard')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
