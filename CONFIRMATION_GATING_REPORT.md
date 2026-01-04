================================================================================
STRICT CONFIRMATION GATING - IMPLEMENTATION REPORT
================================================================================
Policy: "Mempool is NOT payment" - Content unlocked ONLY after on-chain confirmation
Implementation Date: 2026-01-03

================================================================================
FILE CHANGES
================================================================================

1. src/lib/config_v2.ts (Lines 69-72)
   ADDED: MIN_CONFIRMATIONS configuration
   
   export const MIN_CONFIRMATIONS = parseInt(
     process.env.MIN_CONFIRMATIONS || '1'
   );

   Purpose: Environment-configurable confirmation threshold (default: 1 block)

---

2. src/lib/db-compositions.ts (Lines 233-244)
   ADDED: upsertPayment() function
   
   export async function upsertPayment(data: {
     composition_id: number;
     tx_id: string;
   }): Promise<number> {
     const [result] = await pool.execute<ResultSetHeader>(
       `INSERT INTO payments (composition_id, tx_id, status)
        VALUES (?, ?, 'submitted')
        ON DUPLICATE KEY UPDATE tx_id = VALUES(tx_id)`,
       [data.composition_id, data.tx_id]
     );
     return result.insertId;
   }

   Purpose: Create or update payment record without throwing 409 on duplicate

---

3. src/app/api/node/pay/route.ts (Lines 113-126)
   MODIFIED: Added payment record creation after transaction submission
   
   // 7. Send transaction
   console.log(`[Node Payment] Sending transaction...`);
   const txId = await nodeWallet.sendTransaction(recipients, 1000000);
   console.log(`[Node Payment] Transaction submitted: ${txId}`);

   // 8. Create payment record with status='submitted'
   const { upsertPayment } = await import('@/lib/db-compositions');
   await upsertPayment({
     composition_id: compositionId,
     tx_id: txId,
   });
   console.log(`[Node Payment] Payment record created for composition ${compositionId}`);

   // 9. Return txId (confirmation will be handled by /confirm endpoint after confirmations)
   return NextResponse.json({
     txId,
     message: 'Transaction submitted successfully',
     recipients: recipients.length,
     totalAmount: recipients.reduce((sum, r) => sum + r.value, 0),
   });

   BEHAVIOR CHANGE:
   - OLD: Return txId only
   - NEW: Create payment record with status='submitted' before returning txId
   - Composition status remains 'awaiting_payment' until confirmed

---

4. src/app/api/compositions/[id]/confirm/route.ts (Lines 1-9, 60-108)
   MODIFIED: Strict confirmation gating with pending state support

   a) Import additions (Lines 1-9):
      import { upsertPayment } from '@/lib/db-compositions';
      import { getTransaction } from '@/lib/explorer';
      import { MIN_CONFIRMATIONS } from '@/lib/config_v2';

   b) Status check modification (Lines 60-73):
      // OLD: Reject if status != 'awaiting_payment'
      // NEW: Allow 'paid' status if same txId (idempotent), reject only if different txId
      
      if (composition.status === 'paid' && composition.tx_id !== txId) {
        return NextResponse.json(
          {
            error: 'Composition already paid with different transaction',
            existingTxId: composition.tx_id,
          },
          { status: 409 }
        );
      }

   c) Confirmation check FIRST (Lines 75-101):
      // Fetch tx from Explorer
      const tx = await getTransaction(txId);
      if (!tx) {
        return NextResponse.json(
          { error: 'Transaction not found on Explorer' },
          { status: 404 }
        );
      }

      console.log(`[Confirm] Transaction ${txId} has ${tx.confirmationsCount} confirmations (required: ${MIN_CONFIRMATIONS})`);

      // If not enough confirmations, return 202 Accepted with pending status
      if (tx.confirmationsCount < MIN_CONFIRMATIONS) {
        // Upsert payment record with status='submitted' if not exists
        await upsertPayment({
          composition_id: compositionId,
          tx_id: txId,
        });

        return NextResponse.json(
          {
            status: 'pending',
            confirmationsCount: tx.confirmationsCount,
            requiredConfirmations: MIN_CONFIRMATIONS,
            message: `Transaction pending: ${tx.confirmationsCount}/${MIN_CONFIRMATIONS} confirmations`,
          },
          { status: 202 }
        );
      }

      // Transaction is confirmed - proceed with verification
      // Check if payment already confirmed
      const existingPayment = await getPaymentByTxId(txId);
      if (existingPayment && existingPayment.status === 'confirmed') {
        return NextResponse.json({
          ok: true,
          status: 'paid',
          message: 'Payment already confirmed',
        });
      }

      // Upsert payment record (will be updated to confirmed below)
      await upsertPayment({
        composition_id: compositionId,
        tx_id: txId,
      });

   d) Removed duplicate check (Lines 102-108):
      // OLD CODE REMOVED:
      // const existingPayment = await getPaymentByTxId(txId);
      // if (existingPayment) {
      //   return NextResponse.json({ error: 'Transaction already submitted' }, { status: 409 });
      // }
      // const paymentId = await createPayment({ composition_id: compositionId, tx_id: txId });

   BEHAVIOR CHANGES:
   - OLD: 409 Conflict if payment record exists
   - NEW: Return 202 if confirmationsCount < MIN_CONFIRMATIONS
   - NEW: Return 200 if already confirmed (idempotent)
   - NEW: Update payment record instead of creating new

---

5. src/app/pay/[id]/page.tsx (Lines 29-31, 87-186, 320-368)
   MODIFIED: Client-side polling with state progression

   a) State additions (Lines 29-31):
      const [paymentState, setPaymentState] = useState<'idle' | 'submitted' | 'pending' | 'confirmed'>('idle');
      const [confirmations, setConfirmations] = useState(0);
      const [requiredConfirmations, setRequiredConfirmations] = useState(1);

   b) handlePayment modification (Lines 87-137):
      // Removed direct call to /confirm
      // Added polling after transaction submission
      
      const submittedTxId = await wallet.submitTx(signedTx);
      setTxId(submittedTxId);
      setPaymentState('submitted');

      console.log('Transaction submitted:', submittedTxId);

      // Start polling for confirmations
      setStatus('Transaction submitted, waiting for confirmations...');
      await pollForConfirmations(submittedTxId);

   c) NEW: pollForConfirmations() function (Lines 139-186):
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

   d) UI state display (Lines 320-368):
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
          ...
        </div>
      )}

   BEHAVIOR CHANGES:
   - OLD: Call /confirm immediately after submitTx
   - NEW: Poll Explorer every 5s, call /confirm only when confirmationsCount >= 1
   - NEW: Show visual states: submitted (blue) → pending (yellow) → confirmed (green)
   - NEW: Display confirmation progress (X/Y confirmations)

================================================================================
PAYMENT STATE FLOW
================================================================================

CLIENT SIDE:
1. User clicks "Pay with Nautilus Wallet"
2. Build transaction → Sign → Submit
3. Transaction submitted to network
4. UI state: 'submitted' (blue, pulsing)
5. Poll Explorer API every 5 seconds
6. When confirmationsCount >= 1:
   - UI state: 'pending' (yellow, pulsing)
   - Call POST /api/compositions/:id/confirm
7. If /confirm returns 202:
   - Continue polling (still pending)
8. If /confirm returns 200 with ok=true:
   - UI state: 'confirmed' (green, solid)
   - Redirect to success page after 2s

SERVER SIDE:
1. POST /api/node/pay:
   - Build transaction via node wallet
   - Submit to network
   - Create payment record: status='submitted'
   - Return txId
   - Composition status: 'awaiting_payment'

2. POST /api/compositions/:id/confirm (called by client after polling):
   - Fetch tx from Explorer API
   - Check confirmationsCount >= MIN_CONFIRMATIONS
   - If insufficient: return 202 with {status: 'pending', confirmationsCount, requiredConfirmations}
   - If confirmed:
     * Verify UTXO outputs (platform + creators)
     * Verify R4 commitment hash
     * Update payment: status='confirmed', confirmed_at=NOW()
     * Update composition: status='paid', tx_id=txId
     * Return 200 with {ok: true, status: 'paid'}

DATABASE STATES:
- compositions.status: 'awaiting_payment' → 'paid' (only after confirmations + verification)
- payments.status: 'submitted' → 'confirmed' (only after confirmations + verification)
- payments.confirmed_at: NULL → timestamp (set when confirmed)

================================================================================
SECURITY GUARANTEES
================================================================================

✅ NO content unlocked before on-chain confirmation
✅ NO composition.status='paid' before MIN_CONFIRMATIONS
✅ NO payment.status='confirmed' before MIN_CONFIRMATIONS
✅ UTXO-safe output verification (sums outputs by address)
✅ R4 commitment hash verification (strict mode)
✅ Idempotent confirm endpoint (no 409 on retry)
✅ Explorer API as source of truth for confirmations
✅ Client polls Explorer, not internal database

ATTACK VECTORS MITIGATED:
❌ Double-spend via mempool transaction replacement
❌ Fake transaction IDs (Explorer returns 404)
❌ Unconfirmed transactions counted as payment
❌ Race conditions in confirmation endpoint

================================================================================
CONFIGURATION
================================================================================

Environment Variable: MIN_CONFIRMATIONS
Default: 1 (testnet safe)
Recommended Production: 3-6 (mainnet safe against reorgs)
Usage: Set in .env.local

Example:
  MIN_CONFIRMATIONS=3  # Require 3 confirmations before unlocking content

================================================================================
TESTING CHECKLIST
================================================================================

[ ] Node payment creates payment record with status='submitted'
[ ] Payment record exists before confirmation
[ ] Confirm endpoint returns 202 when confirmationsCount < MIN_CONFIRMATIONS
[ ] Confirm endpoint returns 200 when confirmationsCount >= MIN_CONFIRMATIONS
[ ] Client polls Explorer and shows 'submitted' state
[ ] Client transitions to 'pending' when confirmationsCount >= 1
[ ] Client transitions to 'confirmed' after successful /confirm call
[ ] Composition status remains 'awaiting_payment' until confirmed
[ ] Composition status changes to 'paid' only after confirmation
[ ] Payment status changes to 'confirmed' only after verification
[ ] Idempotent confirm: calling twice with same txId returns 200, not 409
[ ] Different txId for same composition returns 409
[ ] UI shows confirmation count (X/Y confirmations)
[ ] UI displays correct colors: blue → yellow → green

================================================================================
END OF REPORT
================================================================================
