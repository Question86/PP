'use client';

import { formatErg } from '@/lib/config_v2';
import type { CompositionItemResponse } from '@/types/v2';

interface CompositionSummaryProps {
  composition: {
    id: number;
    items: CompositionItemResponse[];
    totals: {
      snippetsTotal: string;
      platformFee: string;
      grandTotal: string;
    };
  };
  onProceedToPayment?: () => void;
}

export function CompositionSummary({
  composition,
  onProceedToPayment,
}: CompositionSummaryProps) {
  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Suggested Composition</h2>

      <div className="space-y-3 mb-6">
        {composition.items.map((item, index) => (
          <div
            key={index}
            className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{item.snippetTitle}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  by {item.creatorName}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {formatErg(BigInt(item.priceNanoerg))}
                </p>
                <span className="text-xs text-gray-500">{item.category}</span>
              </div>
            </div>

            {item.snippetSummary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {item.snippetSummary}
              </p>
            )}

            {item.rationale && (
              <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                💡 {item.rationale}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Snippets ({composition.items.length})
          </span>
          <span>{formatErg(BigInt(composition.totals.snippetsTotal))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
          <span>{formatErg(BigInt(composition.totals.platformFee))}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
          <span>Total</span>
          <span>{formatErg(BigInt(composition.totals.grandTotal))}</span>
        </div>
      </div>

      {onProceedToPayment && (
        <button
          onClick={onProceedToPayment}
          className="btn btn-primary w-full mt-6"
        >
          Proceed to Payment →
        </button>
      )}
    </div>
  );
}
