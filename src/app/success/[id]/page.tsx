'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface CompositionContent {
  compositionId: number;
  status: string;
  txId: string | null;
  content: string;
  items: Array<{
    snippetTitle: string;
    content: string;
    creatorName: string;
  }>;
}

export default function SuccessPage() {
  const params = useParams();
  const router = useRouter();
  const compositionId = parseInt(params.id as string);

  const [data, setData] = useState<CompositionContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (compositionId) {
      fetchContent();
    }
  }, [compositionId]);

  const fetchContent = async () => {
    try {
      const response = await fetch(`/api/compositions/${compositionId}/content`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch content');
      }

      const content = await response.json();
      setData(content);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (data?.content) {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (data?.content) {
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `composition-${compositionId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={() => router.push('/browse')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Success Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Payment Confirmed!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your prompt snippets are ready
        </p>
      </div>

      {/* Transaction Info */}
      {data.txId && (
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Transaction ID:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-white dark:bg-gray-900 px-3 py-2 rounded border dark:border-gray-700">
              {data.txId}
            </code>
            <a
              href={`https://testnet.ergoplatform.com/en/transactions/${data.txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
            >
              View on Explorer →
            </a>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={handleCopy}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          {copied ? '✓ Copied!' : '📋 Copy All Content'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          ⬇️ Download as File
        </button>
      </div>

      {/* Complete Content */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Complete Prompt</h2>
        <div className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-6">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {data.content}
          </pre>
        </div>
      </div>

      {/* Individual Snippets */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Individual Snippets</h2>
        <div className="space-y-4">
          {data.items.map((item, index) => (
            <div
              key={index}
              className="border dark:border-gray-700 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{item.snippetTitle}</h3>
                  <p className="text-sm text-gray-500">by {item.creatorName}</p>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(item.content);
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Copy
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {item.content}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="border-t pt-6 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">What's Next?</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/browse')}
            className="p-4 border dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
          >
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold mb-1">Browse More Snippets</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Discover more prompt components
            </p>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="p-4 border dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold mb-1">View Dashboard</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See your purchases and earnings
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
