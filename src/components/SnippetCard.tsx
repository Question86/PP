'use client';

import Link from 'next/link';
import type { SnippetCategory } from '@/lib/config_v2';
import { formatErg } from '@/lib/config_v2';

interface SnippetCardProps {
  snippet: {
    id: number;
    title: string;
    summary: string | null;
    category: SnippetCategory;
    price: string; // nanoERG as string
    usageCount?: number;
  };
  onClick?: () => void;
  showActions?: boolean;
}

const categoryColors: Record<SnippetCategory, string> = {
  guardrail: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  format: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  eval: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  tooling: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  context: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export function SnippetCard({ snippet, onClick, showActions = false }: SnippetCardProps) {
  const priceErg = formatErg(BigInt(snippet.price));

  return (
    <div
      className="card hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold">{snippet.title}</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            categoryColors[snippet.category]
          }`}
        >
          {snippet.category}
        </span>
      </div>

      {snippet.summary && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {snippet.summary}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-400">Price: </span>
          <span className="font-semibold">{priceErg}</span>
        </div>

        {snippet.usageCount !== undefined && (
          <div className="text-xs text-gray-500">
            {snippet.usageCount} uses
          </div>
        )}
      </div>

      {showActions && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/creator/snippets/${snippet.id}`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage →
          </Link>
        </div>
      )}
    </div>
  );
}
