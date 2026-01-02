'use client';

import { useState } from 'react';
import { walletConnector } from '@/lib/wallet-v2';
import { buildPaymentTransaction, validatePaymentIntent } from '@/lib/payments';
import type { PaymentIntent } from '@/types/v2';

interface PayButtonProps {
  compositionId: number;
  paymentIntent: PaymentIntent;
  userAddress: string;
  onSuccess?: (txId: string) => void;
  onError?: (error: string) => void;
}

export function PayButton({
  compositionId,
  paymentIntent,
  userAddress,
  onSuccess,
  onError,
}: PayButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handlePay = async () => {
    setIsProcessing(true);
    setStatus('Validating payment intent...');

    try {
      // Validate payment intent
      const validation = validatePaymentIntent(paymentIntent);
      if (!validation.valid) {
        throw new Error(`Invalid payment intent: ${validation.errors.join(', ')}`);
      }

      // Get UTXOs
      setStatus('Fetching wallet UTXOs...');
      const utxos = await walletConnector.getUtxos();

      if (utxos.length === 0) {
        throw new Error('No UTXOs available in wallet');
      }

      // Build transaction
      setStatus('Building transaction...');
      const buildResult = await buildPaymentTransaction({
        paymentIntent,
        userAddress,
        utxos,
      });

      // Sign transaction
      setStatus('Waiting for signature...');
      const signedTx = await walletConnector.signTx(buildResult.unsignedTx);

      // Submit transaction
      setStatus('Submitting to blockchain...');
      const txId = await walletConnector.submitTx(signedTx);

      // Confirm with backend
      setStatus('Confirming payment...');
      const confirmResponse = await fetch(
        `/api/compositions/${compositionId}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId }),
        }
      );

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Payment confirmation failed');
      }

      setStatus('Payment successful!');
      onSuccess?.(txId);
    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err.message || 'Payment failed';
      setStatus('');
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={isProcessing}
        className="btn btn-primary w-full"
      >
        {isProcessing ? status : 'Pay with Nautilus'}
      </button>

      {status && !isProcessing && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {status}
        </p>
      )}
    </div>
  );
}
