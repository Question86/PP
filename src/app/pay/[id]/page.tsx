'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/hooks/useWallet';
import { buildPaymentTransaction } from '@/lib/payments';
import type { PaymentIntent } from '@/types/v2';

interface CompositionItem {
  snippetTitle: string;
  snippetSummary: string | null;
  creatorName: string;
  priceNanoerg: string;
  category: string;
}

interface CompositionData {
  compositionId: number;
  items: CompositionItem[];
  totals: {
    snippetsTotal: string;
    platformFee: string;
    grandTotal: string;
  };
  status: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const compositionId = parseInt(params.id as string);
  const wallet = useWallet();

  const [composition, setComposition] = useState<CompositionData | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState('');
  const [paymentState, setPaymentState] = useState<'idle' | 'submitted' | 'pending' | 'confirmed'>('idle');
  const [confirmations, setConfirmations] = useState(0);
  const [requiredConfirmations, setRequiredConfirmations] = useState(1);

  useEffect(() => {
    if (compositionId) {
      fetchComposition();
    }
  }, [compositionId]);

  const fetchComposition = async () => {
    try {
      // Fetch composition details (you'll need to create this endpoint)
      const response = await fetch(`/api/compositions/${compositionId}`);
      if (!response.ok) throw new Error('Composition not found');
      const data = await response.json();
      setComposition(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLockComposition = async () => {
    if (!wallet.address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const response = await fetch(`/api/compositions/${compositionId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: wallet.address }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to lock composition');
      }

      const data = await response.json();
      setPaymentIntent(data.paymentIntent);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePayment = async () => {
    if (!wallet.address || !paymentIntent) {
      setError('Missing wallet or payment intent');
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatus('Fetching wallet UTXOs...');

    try {
      // Get UTXOs
      const utxos = await wallet.getUtxos();
      if (utxos.length === 0) {
        throw new Error('No UTXOs available in wallet');
      }

      // Build transaction
      setStatus('Building transaction with R4 commitment...');
      const buildResult = await buildPaymentTransaction({
        paymentIntent,
        userAddress: wallet.address,
        utxos,
      });

      console.log('Transaction built:', {
        inputs: buildResult.unsignedTx.inputs.length,
        outputs: buildResult.unsignedTx.outputs.length,
        fee: buildResult.fee.toString(),
        commitment: paymentIntent.commitmentHex,
      });

      // Sign transaction
      setStatus('Waiting for signature (check Nautilus popup)...');
      const signedTx = await wallet.signTx(buildResult.unsignedTx);

      // Submit transaction
      setStatus('Submitting to blockchain...');
      const submittedTxId = await wallet.submitTx(signedTx);
      setTxId(submittedTxId);
      setPaymentState('submitted');

      console.log('Transaction submitted:', submittedTxId);

      // Start polling for confirmations
      setStatus('Transaction submitted, waiting for confirmations...');
      await pollForConfirmations(submittedTxId);

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setStatus('');
      setPaymentState('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollForConfirmations = async (txId: string) => {
    const POLL_INTERVAL = 5000; // 5 seconds
    const MAX_ATTEMPTS = 120; // 10 minutes
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // Fetch transaction from Explorer
        const response = await fetch(
          `https://api-testnet.ergoplatform.com/api/v1/transactions/${txId}`
        );

        if (response.ok) {
          const tx = await response.json();
          const currentConfirmations = tx.confirmationsCount || 0;
          setConfirmations(currentConfirmations);

          console.log(`Polling: ${currentConfirmations} confirmations`);

          // Check if we have enough confirmations
          if (currentConfirmations >= 1) {
            setPaymentState('pending');
            setStatus(`Transaction has ${currentConfirmations} confirmation(s), verifying...`);

            // Call confirm endpoint
            const confirmResponse = await fetch(
              `/api/compositions/${compositionId}/confirm`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  txId: txId,
                  userAddress: wallet.address
                }),
              }
            );

            const confirmData = await confirmResponse.json();

            if (confirmResponse.status === 202) {
              // Still pending, continue polling
              setPaymentState('pending');
              setStatus(confirmData.message || 'Waiting for confirmations...');
              setRequiredConfirmations(confirmData.requiredConfirmations || 1);
            } else if (confirmResponse.ok && confirmData.ok) {
              // Payment confirmed!
              setPaymentState('confirmed');
              setStatus('Payment confirmed! Redirecting...');
              setTimeout(() => {
                router.push(`/success/${compositionId}`);
              }, 2000);
              return; // Exit polling
            } else {
              throw new Error(confirmData.error || 'Payment verification failed');
            }
          } else {
            // No confirmations yet
            setPaymentState('submitted');
            setStatus(`Transaction submitted (${currentConfirmations} confirmations)...`);
          }
        }
      } catch (err: any) {
        console.error('Polling error:', err);
        // Continue polling even on errors
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    // Timeout
    setError('Transaction confirmation timeout. Please check the transaction manually.');
    setPaymentState('submitted');
  };

  if (!composition) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading composition...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Composition #{compositionId}
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8">
        <WalletConnect />
      </div>

      {/* Composition Summary */}
      <div className="mb-8 border rounded-lg p-6 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">Your Snippets</h2>
        <div className="space-y-3">
          {composition.items.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between py-3 border-b last:border-b-0 dark:border-gray-700"
            >
              <div className="flex-1">
                <h3 className="font-medium">{item.snippetTitle}</h3>
                {item.snippetSummary && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {item.snippetSummary}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {item.category}
                  </span>
                  <span className="text-gray-500">by {item.creatorName}</span>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="font-mono font-semibold">
                  {(parseInt(item.priceNanoerg) / 1_000_000_000).toFixed(3)} ERG
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 pt-4 border-t dark:border-gray-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Snippets Total:</span>
            <span className="font-mono">
              {(parseInt(composition.totals.snippetsTotal) / 1_000_000_000).toFixed(3)} ERG
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Platform Fee:</span>
            <span className="font-mono">
              {(parseInt(composition.totals.platformFee) / 1_000_000_000).toFixed(3)} ERG
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t dark:border-gray-700">
            <span>Grand Total:</span>
            <span className="font-mono">
              {(parseInt(composition.totals.grandTotal) / 1_000_000_000).toFixed(3)} ERG
            </span>
          </div>
        </div>
      </div>

      {/* Payment Intent Display */}
      {paymentIntent && (
        <div className="mb-8 border rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400">✓</span>
            Payment Intent Locked
          </h3>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Protocol:</span>{' '}
              v{paymentIntent.protocolVersion}
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Commitment:</span>{' '}
              <span className="text-xs break-all">{paymentIntent.commitmentHex}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Outputs:</span>{' '}
              {paymentIntent.creatorOutputs.length + 1} (platform + {paymentIntent.creatorOutputs.length} creator{paymentIntent.creatorOutputs.length !== 1 ? 's' : ''})
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-4">
        {!paymentIntent ? (
          <button
            onClick={handleLockComposition}
            disabled={!wallet.isConnected}
            className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
          >
            {wallet.isConnected ? 'Lock & Generate Payment Intent' : 'Connect Wallet to Continue'}
          </button>
        ) : (
          <button
            onClick={handlePayment}
            disabled={isProcessing || !wallet.isConnected}
            className="w-full px-6 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
          >
            {isProcessing ? status : 'Pay with Nautilus Wallet'}
          </button>
        )}

        {status && !isProcessing && (
          <div className="text-center text-sm text-green-600 dark:text-green-400">
            {status}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            <p className="font-semibold mb-1">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {txId && (
          <div className={`p-4 border rounded-lg ${
            paymentState === 'confirmed' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : paymentState === 'pending'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  paymentState === 'confirmed' 
                    ? 'bg-green-500'
                    : paymentState === 'pending'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-blue-500 animate-pulse'
                }`} />
                <p className={`font-semibold ${
                  paymentState === 'confirmed' 
                    ? 'text-green-800 dark:text-green-200'
                    : paymentState === 'pending'
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}>
                  {paymentState === 'confirmed' && 'Payment Confirmed ✓'}
                  {paymentState === 'pending' && `Confirming Payment (${confirmations}/${requiredConfirmations} confirmations)`}
                  {paymentState === 'submitted' && 'Transaction Submitted'}
                </p>
              </div>
            </div>
            <p className={`text-sm font-mono break-all ${
              paymentState === 'confirmed' 
                ? 'text-green-700 dark:text-green-300'
                : paymentState === 'pending'
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {txId}
            </p>
            <a
              href={`https://testnet.ergoplatform.com/en/transactions/${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 underline mt-2 inline-block"
            >
              View on Explorer →
            </a>
            {paymentState === 'submitted' && (
              <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                Waiting for transaction to appear in a block...
              </p>
            )}
            {paymentState === 'pending' && (
              <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                Verifying payment outputs and commitment hash...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
        <p className="font-semibold mb-2">How it works:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Lock" to generate payment intent with R4 commitment hash</li>
          <li>Click "Pay" to build transaction with commitment in platform output</li>
          <li>Nautilus wallet will show transaction details - review carefully</li>
          <li>Sign the transaction in Nautilus</li>
          <li>Transaction submitted to Ergo testnet</li>
          <li>Backend verifies R4 commitment matches expected hash</li>
          <li>Upon confirmation, you'll receive access to the snippet content</li>
        </ol>
      </div>
    </div>
  );
}
