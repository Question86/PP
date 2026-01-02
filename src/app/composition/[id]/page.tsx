'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompositionSummary } from '@/components/CompositionSummary';
import { PayButton } from '@/components/PayButton';
import type { CompositionWithItems } from '@/lib/db-compositions';
import type { PaymentIntent } from '@/types/v2';

export default function CompositionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [composition, setComposition] = useState<CompositionWithItems | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [txId, setTxId] = useState<string>('');

  useEffect(() => {
    loadComposition();
  }, [params.id]);

  const loadComposition = async () => {
    try {
      const response = await fetch(`/api/compositions/${params.id}`);
      if (!response.ok) {
        throw new Error('Failed to load composition');
      }
      const data = await response.json();
      setComposition(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!composition) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/compositions/${params.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: composition.user_address }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to lock composition');
      }

      const data = await response.json();
      setPaymentIntent(data.paymentIntent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (txId: string) => {
    setTxId(txId);
    loadComposition(); // Reload to get updated status
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <p>Loading composition...</p>
      </div>
    );
  }

  if (error || !composition) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="card max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p>{error || 'Composition not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Composition #{composition.id}</h1>

        <div className="grid gap-6">
          <CompositionSummary
            composition={{
              id: composition.id,
              items: composition.items.map((item) => ({
                snippetTitle: item.snippet_title,
                snippetSummary: item.snippet_summary,
                creatorName: item.creator_name,
                priceNanoerg: item.price_nanoerg,
                category: item.snippet_category as any,
              })),
              totals: {
                snippetsTotal: (
                  BigInt(composition.total_price_nanoerg) -
                  BigInt(composition.platform_fee_nanoerg)
                ).toString(),
                platformFee: composition.platform_fee_nanoerg,
                grandTotal: composition.total_price_nanoerg,
              },
            }}
            onProceedToPayment={
              composition.status === 'proposed' ? handleProceedToPayment : undefined
            }
          />

          {composition.status === 'awaiting_payment' && paymentIntent && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Payment</h2>
              <PayButton
                compositionId={composition.id}
                paymentIntent={paymentIntent}
                userAddress={composition.user_address}
                onSuccess={handlePaymentSuccess}
                onError={(err) => setError(err)}
              />
            </div>
          )}

          {composition.status === 'paid' && (
            <div className="card bg-green-50 dark:bg-green-900/20">
              <h2 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                ✅ Payment Confirmed
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transaction ID: <span className="font-mono">{composition.tx_id}</span>
              </p>
            </div>
          )}

          {error && (
            <div className="card bg-red-50 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
