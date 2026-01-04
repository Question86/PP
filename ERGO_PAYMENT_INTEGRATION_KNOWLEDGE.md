# Ergo Blockchain Payment Integration - AI Knowledge Base

**Purpose:** Archive AI-relevant knowledge about implementing Ergo as a value transaction layer in web applications, with focus on practical implementation patterns, common pitfalls, and architectural decisions.

**Version:** 1.0 (January 2026)  
**Audience:** AI assistants, developers building Ergo-integrated applications  
**Scope:** Payment flows, UTXO verification, transaction construction, security patterns

---

## Table of Contents

1. [Ergo Fundamentals](#ergo-fundamentals)
2. [Architecture Patterns](#architecture-patterns)
3. [Payment Implementation Guide](#payment-implementation-guide)
4. [UTXO-Safe Verification](#utxo-safe-verification)
5. [Transaction Construction](#transaction-construction)
6. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
7. [Testing Strategies](#testing-strategies)
8. [Tools & Libraries](#tools--libraries)
9. [Decision Frameworks](#decision-frameworks)
10. [Code Reference Catalog](#code-reference-catalog)

---

## 1. Ergo Fundamentals

### 1.1 UTXO Model vs Account Model

**Key Concept:** Ergo uses extended UTXO (eUTXO) model, not account balances.

```
ACCOUNT MODEL (Ethereum):
- Address has balance: 100 ERG
- Transaction: Send 10 ERG → Balance becomes 90 ERG
- State: Mutable account balance

UTXO MODEL (Ergo):
- Address owns boxes (UTXOs): [Box1: 60 ERG, Box2: 40 ERG]
- Transaction: Spend Box1 → Create [Box3: 10 ERG (recipient), Box4: 49 ERG (change)]
- State: Immutable boxes, create new ones when spending
```

**Implications for Development:**
- Cannot simply "deduct from balance" - must select input boxes
- Must handle change outputs (unspent portion returns to sender)
- Multiple outputs to same address must be SUMMED for verification
- Box selection strategy matters (UTXO consolidation vs fragmentation)

### 1.2 Address Types

```typescript
// P2PK (Pay to Public Key) - Standard wallet address
// Testnet: starts with "3W" (base58 encoded)
// Mainnet: starts with "9" (base58 encoded)
const userAddress = "3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz";

// P2S (Pay to Script) - Smart contract address
// Derived from ErgoTree (script hash)
const contractAddress = Pay2SAddress(ergoTree);
```

**Critical:** Always use `.toLowerCase()` when comparing addresses in verification logic due to case-sensitivity variations.

### 1.3 Value Units

```typescript
// Base unit: nanoERG (smallest denomination)
const nanoergsPerErg = 1_000_000_000n; // 1 ERG = 1 billion nanoERG

// Always use BigInt for value calculations to avoid precision loss
const platformFee = 5_000_000n; // 0.005 ERG
const total = platformFee + creatorAmount; // Safe with BigInt

// NEVER use floating point for ERG amounts
const wrong = 0.005 * 1000000000; // JavaScript precision issues
const correct = 5000000n; // Exact nanoERG value
```

### 1.4 Transaction Structure

```typescript
interface ErgoTransaction {
  id: string; // Transaction hash (64 hex chars)
  inputs: Array<{
    boxId: string; // UTXO being spent
    value: string; // nanoERG amount
    address: string; // Owner address
  }>;
  outputs: Array<{
    boxId: string; // New UTXO created
    value: string; // nanoERG amount
    address: string; // Recipient address
    additionalRegisters?: {
      R4?: string; // Custom data (hex-encoded)
      R5?: string;
      // R6-R9 also available
    };
  }>;
  size: number; // Transaction size in bytes
}
```

**Key Properties:**
- **Inputs** = boxes being spent (destroyed)
- **Outputs** = new boxes being created
- **Conservation:** `sum(inputs.value) = sum(outputs.value) + minerFee`
- **Registers R4-R9:** Optional metadata (32 bytes each max)

---

## 2. Architecture Patterns

### 2.1 Direct Payment Pattern (P2P)

**Use Case:** Marketplace, payments to creators, tipping

```
User A (Buyer) → Transaction → Creator B (Direct)
                           ↘ Platform (Fee)

NO ESCROW - Payments settle instantly on-chain
NO CUSTODY - Platform never holds funds
```

**Advantages:**
- Trustless (no platform custody risk)
- Instant settlement (block confirmation ~2 minutes)
- Low gas fees (~0.001 ERG typical)
- Transparent (all payments on-chain)

**Disadvantages:**
- No refunds without cooperation
- Requires upfront payment (no credit/delayed settlement)
- User must have ERG for gas fees

**Implementation Pattern:**

```typescript
// Step 1: Generate payment intent (off-chain)
const paymentIntent = {
  platformOutput: { address: platformAddr, amount: "5000000" },
  creatorOutputs: [
    { address: creator1Addr, amount: "25000000" },
    { address: creator2Addr, amount: "20000000" }
  ],
  totalRequired: 50000000
};

// Step 2: User builds & signs transaction (client-side via wallet)
const tx = await buildTransaction(paymentIntent);
const signedTx = await wallet.sign(tx);

// Step 3: Broadcast to blockchain
const txId = await wallet.submit(signedTx);

// Step 4: Verify on-chain (server-side)
const verified = await verifyPaymentOnChain(txId, paymentIntent);
if (verified) {
  unlockContent(); // Grant access
}
```

### 2.2 Payment Aggregation Pattern

**Problem:** Multiple payments to same recipient → Multiple outputs → Expensive

**Solution:** Group by recipient address, single output per address

```typescript
// BAD: Multiple outputs to same address
outputs = [
  { address: "3Ww...", amount: "10000000" }, // Creator1, Snippet 1
  { address: "3Ww...", amount: "15000000" }, // Creator1, Snippet 2 (SAME ADDRESS)
  { address: "3Wx...", amount: "20000000" }  // Creator2
];
// Result: 3 outputs, ~120 bytes overhead

// GOOD: Aggregated by address
const aggregated = aggregateByAddress(items);
outputs = [
  { address: "3Ww...", amount: "25000000" }, // Creator1 (10M + 15M)
  { address: "3Wx...", amount: "20000000" }  // Creator2
];
// Result: 2 outputs, ~80 bytes, saves ~0.0004 ERG
```

**Database Query Pattern:**

```sql
-- Aggregate payments by creator address
SELECT 
  creator_payout_address,
  SUM(price_nanoerg) as total_amount,
  COUNT(*) as snippet_count
FROM composition_items
WHERE composition_id = ?
GROUP BY creator_payout_address;
```

**TypeScript Implementation:**

```typescript
export async function getAggregatedCreatorPayouts(
  compositionId: number
): Promise<Array<{ address: string; amount: string; count: number }>> {
  const [rows] = await pool.execute(
    `SELECT creator_payout_address, SUM(price_nanoerg) as total_amount, COUNT(*) as snippet_count
     FROM composition_items WHERE composition_id = ? GROUP BY creator_payout_address`,
    [compositionId]
  );
  
  return rows.map(row => ({
    address: row.creator_payout_address,
    amount: row.total_amount.toString(),
    count: row.snippet_count
  }));
}
```

**Critical Rule:** ALWAYS aggregate before building transaction, NEVER assume 1:1 mapping between items and outputs.

### 2.3 Two-Phase Payment Pattern

**Phase 1: Lock (Off-Chain Intent)**
```typescript
POST /api/compositions/:id/lock
Body: { userAddress: string }

Response: {
  paymentIntent: {
    platformOutput: { address, amount },
    creatorOutputs: [{ address, amount, snippetCount }],
    totalRequired: bigint,
    estimatedFee: bigint
  }
}

Database: composition.status = "awaiting_payment"
```

**Phase 2: Confirm (On-Chain Verification)**
```typescript
POST /api/compositions/:id/confirm
Body: { txId: string }

Actions:
1. Fetch transaction from Explorer API
2. Verify outputs match payment intent
3. If valid: composition.status = "paid", unlock content
4. If invalid: composition.status = "failed"
```

**State Machine:**

```
proposed → (lock) → awaiting_payment → (confirm) → paid
                                     ↘ (timeout/failure) → failed
```

**Critical Insight:** Lock endpoint MUST be idempotent. Multiple calls with same compositionId should return same payment intent (deterministic address/amount calculation).

---

## 3. Payment Implementation Guide

### 3.1 Backend Payment Intent Generation

**File:** `src/app/api/compositions/[id]/lock/route.ts`

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const compositionId = parseInt(params.id);
  const { userAddress } = await request.json();
  
  // 1. Fetch composition with items
  const composition = await getCompositionById(compositionId);
  
  // 2. Aggregate payments by creator address (CRITICAL STEP)
  const aggregated = await getAggregatedCreatorPayouts(compositionId);
  
  // 3. Build payment intent
  const paymentIntent = {
    platformOutput: {
      address: PLATFORM_ERGO_ADDRESS,
      amount: PLATFORM_FEE_NANOERG.toString()
    },
    creatorOutputs: aggregated.map(row => ({
      address: row.creator_payout_address,
      amount: row.total_amount.toString(),
      snippetCount: row.snippet_count,
      snippetVersionIds: [] // Optional metadata
    })),
    totalRequired: composition.total_price_nanoerg,
    estimatedFee: "1000000" // 0.001 ERG typical
  };
  
  // 4. Update composition status
  await updateCompositionStatus(compositionId, "awaiting_payment");
  
  return NextResponse.json({ paymentIntent });
}
```

**Key Principles:**
- Deterministic: Same input → Same output
- Idempotent: Safe to call multiple times
- Atomic: Database updates in transaction
- Validated: Check composition status before locking

### 3.2 Frontend Transaction Builder (Missing - To Implement)

**File:** `src/components/PaymentModal.tsx` (create)

```typescript
import { TransactionBuilder, OutputBuilder } from '@fleet-sdk/core';
import { useWallet } from '@/hooks/useWallet';

export function PaymentModal({ paymentIntent, onSuccess }) {
  const { ergo, connected } = useWallet();
  
  const handlePayment = async () => {
    // 1. Get current blockchain height
    const height = await ergo.get_current_height();
    
    // 2. Build transaction
    const txBuilder = new TransactionBuilder(height);
    
    // Add platform output
    txBuilder.to(
      paymentIntent.platformOutput.address,
      BigInt(paymentIntent.platformOutput.amount)
    );
    
    // Add creator outputs (already aggregated)
    for (const creator of paymentIntent.creatorOutputs) {
      txBuilder.to(creator.address, BigInt(creator.amount));
    }
    
    // 3. Select inputs from user wallet
    const utxos = await ergo.get_utxos();
    txBuilder.from(utxos);
    
    // 4. Configure change and fee
    txBuilder.sendChangeTo(userAddress);
    txBuilder.payMinFee(); // ~0.001 ERG
    
    // 5. Build unsigned transaction
    const unsignedTx = txBuilder.build();
    
    // 6. Sign via wallet
    const signedTx = await ergo.sign_tx(unsignedTx);
    
    // 7. Submit to blockchain
    const txId = await ergo.submit_tx(signedTx);
    
    // 8. Confirm with backend
    await fetch(`/api/compositions/${compositionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ txId })
    });
    
    onSuccess(txId);
  };
  
  return (
    <button onClick={handlePayment}>
      Pay {paymentIntent.totalRequired / 1e9} ERG
    </button>
  );
}
```

**Dependencies:**
```json
{
  "@fleet-sdk/core": "^0.5.0",
  "@fleet-sdk/wallet": "^0.5.0"
}
```

### 3.3 Wallet Integration (Nautilus)

**File:** `src/lib/wallet-connector.ts` (create)

```typescript
declare global {
  interface Window {
    ergo?: any;
    ergo_request_read_access?: () => Promise<boolean>;
    ergo_check_read_access?: () => Promise<boolean>;
  }
}

export async function connectWallet(): Promise<ErgoWallet> {
  // Check if Nautilus is installed
  if (!window.ergo_request_read_access) {
    throw new Error('Nautilus wallet not installed');
  }
  
  // Request access
  const granted = await window.ergo_request_read_access();
  if (!granted) {
    throw new Error('Wallet access denied');
  }
  
  return {
    getAddress: () => window.ergo.get_change_address(),
    getUtxos: () => window.ergo.get_utxos(),
    signTx: (tx) => window.ergo.sign_tx(tx),
    submitTx: (tx) => window.ergo.submit_tx(tx),
    getBalance: () => window.ergo.get_balance(),
    getHeight: () => window.ergo.get_current_height()
  };
}

export interface ErgoWallet {
  getAddress: () => Promise<string>;
  getUtxos: () => Promise<any[]>;
  signTx: (unsignedTx: any) => Promise<any>;
  submitTx: (signedTx: any) => Promise<string>;
  getBalance: () => Promise<string>;
  getHeight: () => Promise<number>;
}
```

**Usage in React:**

```typescript
import { connectWallet } from '@/lib/wallet-connector';

export function useWallet() {
  const [wallet, setWallet] = useState<ErgoWallet | null>(null);
  const [connected, setConnected] = useState(false);
  
  const connect = async () => {
    try {
      const w = await connectWallet();
      setWallet(w);
      setConnected(true);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };
  
  return { wallet, connected, connect };
}
```

---

## 4. UTXO-Safe Verification

### 4.1 The UTXO Summation Problem

**Problem:** Transaction may have multiple outputs to same address.

```typescript
// Example transaction:
{
  outputs: [
    { address: "3Ww...", value: "10000000" }, // Output 1
    { address: "3Wx...", value: "20000000" }, // Output 2
    { address: "3Ww...", value: "15000000" }, // Output 3 (SAME as Output 1)
    { address: "3Wy...", value: "5000000" }   // Change output
  ]
}

// WRONG verification (checks individual outputs):
const platformOutput = tx.outputs.find(o => o.address === platformAddr);
if (platformOutput.value >= expectedAmount) { /* FAILS if split across outputs */ }

// CORRECT verification (sums all outputs per address):
const addressSums = new Map<string, bigint>();
for (const output of tx.outputs) {
  const current = addressSums.get(output.address) || 0n;
  addressSums.set(output.address, current + BigInt(output.value));
}
const platformSum = addressSums.get(platformAddr) || 0n;
if (platformSum >= expectedAmount) { /* SAFE */ }
```

### 4.2 UTXO-Safe Verification Implementation

**File:** `src/lib/explorer.ts`

```typescript
export async function verifyPayment(
  txId: string,
  paymentIntent: PaymentIntent
): Promise<VerificationResult> {
  const result: VerificationResult = {
    valid: false,
    platformOutputValid: false,
    creatorOutputsValid: [],
    registersValid: false,
    errors: []
  };
  
  // 1. Fetch transaction from Explorer
  const tx = await getTransaction(txId);
  if (!tx) {
    result.errors.push('Transaction not found on Explorer');
    return result;
  }
  
  // 2. Check confirmations (REQUIRED)
  if (tx.confirmationsCount < 1) {
    result.errors.push('Transaction not yet confirmed');
    return result;
  }
  
  // 3. Build address → total amount map (UTXO-SAFE)
  const addressSums = new Map<string, bigint>();
  for (const output of tx.outputs) {
    const addr = output.address.toLowerCase(); // Case-insensitive
    const current = addressSums.get(addr) || 0n;
    addressSums.set(addr, current + BigInt(output.value));
  }
  
  // 4. Verify platform output sum
  const platformAddr = paymentIntent.platformOutput.address.toLowerCase();
  const platformSum = addressSums.get(platformAddr) || 0n;
  const expectedPlatformAmount = BigInt(paymentIntent.platformOutput.amount);
  
  if (platformSum >= expectedPlatformAmount) {
    result.platformOutputValid = true;
  } else {
    result.errors.push(
      `Platform output sum insufficient: expected ${expectedPlatformAmount}, got ${platformSum}`
    );
  }
  
  // 5. Verify creator output sums
  for (const expectedCreator of paymentIntent.creatorOutputs) {
    const creatorAddr = expectedCreator.address.toLowerCase();
    const creatorSum = addressSums.get(creatorAddr) || 0n;
    const expectedAmount = BigInt(expectedCreator.amount);
    
    if (creatorSum >= expectedAmount) {
      result.creatorOutputsValid.push(true);
    } else {
      result.errors.push(
        `Creator output sum insufficient for ${expectedCreator.address}: expected ${expectedAmount}, got ${creatorSum}`
      );
      result.creatorOutputsValid.push(false);
    }
  }
  
  // 6. Overall validation
  result.valid =
    result.platformOutputValid &&
    result.creatorOutputsValid.every(v => v) &&
    result.errors.length === 0;
  
  return result;
}
```

**Critical Rules:**
1. **ALWAYS sum outputs per address** (multiple outputs possible)
2. **Use case-insensitive comparison** (`.toLowerCase()`)
3. **Use BigInt for all amounts** (no floating point)
4. **Check >= not ==** (allow overpayment, handle change)
5. **Require confirmations >= 1** (don't trust mempool)

### 4.3 Register Verification (Optional Metadata)

```typescript
// Check R4 register for composition ID (INFORMATIONAL ONLY)
const platformOutput = tx.outputs.find(
  output => output.address.toLowerCase() === platformAddr
);

if (platformOutput?.additionalRegisters?.R4) {
  const expectedCompositionId = paymentIntent.compositionId.toString();
  const actualCompositionId = decodeR4Register(
    platformOutput.additionalRegisters.R4
  );
  
  if (actualCompositionId === expectedCompositionId) {
    result.registersValid = true;
  }
}

// CRITICAL: Register check does NOT affect result.valid
// Payment is valid based on amounts alone
// Registers are audit trail only
```

**Register Encoding (SConstant):**

```typescript
import { SConstant, SInt } from '@fleet-sdk/serializer';

// Encode composition ID into R4
const r4Value = SConstant(SInt, compositionId);
const r4Hex = r4Value.toHex(); // e.g., "040c" for ID=6

// Decode R4 back to composition ID
function decodeR4Register(r4Hex: string): string {
  const constant = SConstant.fromHex(r4Hex);
  return constant.data.toString();
}
```

---

## 5. Transaction Construction

### 5.1 Output Builder Pattern

```typescript
import { OutputBuilder, TransactionBuilder } from '@fleet-sdk/core';

// Create outputs
const platformOutput = new OutputBuilder(
  PLATFORM_FEE_NANOERG,
  PLATFORM_ERGO_ADDRESS
);

// Add register (optional)
platformOutput.setAdditionalRegisters({
  R4: SConstant(SInt, compositionId)
});

// Build transaction
const tx = new TransactionBuilder(height)
  .from(inputBoxes) // User's UTXOs
  .to(platformOutput)
  .to(creator1Address, creator1Amount)
  .to(creator2Address, creator2Amount)
  .sendChangeTo(userAddress) // Return unspent ERG
  .payMinFee() // ~0.001 ERG
  .build();
```

### 5.2 Input Box Selection

**Problem:** Must select enough input boxes to cover outputs + fee.

```typescript
export function selectInputBoxes(
  availableBoxes: Box[],
  targetAmount: bigint
): Box[] {
  // Sort by value (descending) for efficiency
  const sorted = availableBoxes.sort((a, b) => 
    Number(BigInt(b.value) - BigInt(a.value))
  );
  
  const selected: Box[] = [];
  let total = 0n;
  
  for (const box of sorted) {
    selected.push(box);
    total += BigInt(box.value);
    
    // Include buffer for fee
    if (total >= targetAmount + 1_000_000n) {
      return selected;
    }
  }
  
  throw new Error('Insufficient funds');
}
```

**Strategies:**
- **Largest-first:** Minimize number of inputs (fewer bytes, lower fee)
- **Smallest-first:** Consolidate dust UTXOs
- **Age-based:** Spend oldest UTXOs first (UTXO set hygiene)

### 5.3 Fee Calculation

```typescript
// Typical testnet/mainnet fee: 0.001 ERG (1,000,000 nanoERG)
const MIN_FEE = 1_000_000n;

// Dynamic fee based on transaction size
function calculateFee(txSizeBytes: number): bigint {
  const feePerByte = 100n; // nanoERG per byte
  const calculatedFee = BigInt(txSizeBytes) * feePerByte;
  return calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
}

// Transaction size estimation
const estimatedSize = 
  inputs.length * 150 + // ~150 bytes per input
  outputs.length * 40 + // ~40 bytes per output
  100; // Base transaction overhead
```

---

## 6. Common Pitfalls & Solutions

### 6.1 Pitfall: Forgetting Payment Aggregation

**Problem:**
```typescript
// Creates separate output for each snippet
for (const item of compositionItems) {
  outputs.push({
    address: item.creator_payout_address,
    amount: item.price_nanoerg
  });
}
// Result: 10 snippets from same creator = 10 outputs = wasted bytes
```

**Solution:**
```typescript
// Group by address FIRST
const grouped = new Map<string, bigint>();
for (const item of compositionItems) {
  const current = grouped.get(item.creator_payout_address) || 0n;
  grouped.set(item.creator_payout_address, current + BigInt(item.price_nanoerg));
}

// Then create outputs
const outputs = Array.from(grouped.entries()).map(([address, amount]) => ({
  address,
  amount: amount.toString()
}));
```

### 6.2 Pitfall: Case-Sensitive Address Comparison

**Problem:**
```typescript
// Explorer may return address with different case
const found = tx.outputs.find(o => o.address === expectedAddress);
// Returns undefined due to case mismatch
```

**Solution:**
```typescript
const found = tx.outputs.find(
  o => o.address.toLowerCase() === expectedAddress.toLowerCase()
);
```

### 6.3 Pitfall: Using Number Instead of BigInt

**Problem:**
```typescript
const total = outputs.reduce((sum, o) => sum + o.value, 0);
// Number type: loses precision beyond 2^53, incorrect for large ERG amounts
```

**Solution:**
```typescript
const total = outputs.reduce((sum, o) => sum + BigInt(o.value), 0n);
```

### 6.4 Pitfall: Not Checking Confirmations

**Problem:**
```typescript
const tx = await getTransaction(txId);
if (tx) {
  grantAccess(); // Transaction exists in mempool but not confirmed!
}
```

**Solution:**
```typescript
const tx = await getTransaction(txId);
if (tx && tx.confirmationsCount >= 1) {
  grantAccess(); // Safe: transaction confirmed in block
}
```

### 6.5 Pitfall: Hardcoded Transaction Fee

**Problem:**
```typescript
const totalRequired = snippetsTotal + platformFee + 1000000; // Hardcoded fee
// Fails if transaction is large (many inputs/outputs)
```

**Solution:**
```typescript
const baseTotal = snippetsTotal + platformFee;
const estimatedFee = calculateDynamicFee(inputCount, outputCount);
const totalRequired = baseTotal + estimatedFee;
```

### 6.6 Pitfall: Assuming 1:1 Output Mapping

**Problem:**
```typescript
// Expects exactly N outputs for N creators
if (tx.outputs.length !== expectedCreators.length) {
  return false; // WRONG: Doesn't account for change output
}
```

**Solution:**
```typescript
// Sum outputs per address, ignore output count
const addressSums = sumOutputsByAddress(tx.outputs);
for (const creator of expectedCreators) {
  const sum = addressSums.get(creator.address) || 0n;
  if (sum < BigInt(creator.amount)) {
    return false; // Check amounts, not output count
  }
}
```

---

## 7. Testing Strategies

### 7.1 Testnet Node Setup

**Install Ergo Node:**
```bash
# Download from https://github.com/ergoplatform/ergo/releases
# Extract and configure
cd ergo-testnet
java -Xmx4G -jar ergo-6.0.1.jar --testnet -c ergo.conf
```

**Configuration (`ergo.conf`):**
```hocon
ergo {
  node {
    mining = false
  }
  
  wallet {
    secretStorage {
      secretDir = ${ergo.directory}"/wallet/keystore"
    }
  }
  
  networkType = "testnet"
}

scorex {
  restApi {
    apiKeyHash = "<your_api_key_hash>"
    # API key: <your_node_api_key> (hash above)
  }
}
```

**Initialize Wallet:**
```bash
curl -X POST http://localhost:9052/wallet/init \
  -H "api_key: <your_node_api_key>" \
  -d '{"pass":"<your_wallet_password>", "mnemonicPass":""}'
```

**Get Testnet ERG:**
- Faucet: https://testnet.ergofaucet.org/
- Mining: Enable `mining = true` in config (slow on testnet)

### 7.2 Local Testing Without Blockchain

**Mock Transaction Builder:**

```typescript
export class MockTransactionBuilder {
  private outputs: Array<{ address: string; amount: bigint }> = [];
  
  to(address: string, amount: bigint) {
    this.outputs.push({ address, amount });
    return this;
  }
  
  build() {
    return {
      outputs: this.outputs.map((o, i) => ({
        boxId: `mock_box_${i}`,
        address: o.address,
        value: o.amount.toString()
      }))
    };
  }
}
```

**Mock Explorer API:**

```typescript
export class MockExplorerClient {
  private mockTransactions = new Map<string, any>();
  
  addMockTransaction(txId: string, tx: any) {
    this.mockTransactions.set(txId, tx);
  }
  
  async getTransaction(txId: string) {
    return this.mockTransactions.get(txId) || null;
  }
}
```

### 7.3 Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('Payment Aggregation', () => {
  it('should aggregate multiple snippets from same creator', async () => {
    // Setup
    const compositionItems = [
      { creator_address: 'addr1', price: '10000000' },
      { creator_address: 'addr1', price: '15000000' }, // Same creator
      { creator_address: 'addr2', price: '20000000' }
    ];
    
    // Execute
    const aggregated = aggregatePayments(compositionItems);
    
    // Verify
    expect(aggregated).toHaveLength(2); // 2 unique addresses
    expect(aggregated.find(a => a.address === 'addr1').amount).toBe('25000000');
    expect(aggregated.find(a => a.address === 'addr2').amount).toBe('20000000');
  });
  
  it('should verify UTXO-safe transaction', async () => {
    // Setup: Transaction with split outputs
    const mockTx = {
      id: 'test_tx_123',
      confirmationsCount: 1,
      outputs: [
        { address: 'addr1', value: '10000000' },
        { address: 'addr1', value: '15000000' }, // Split output (same address)
        { address: 'addr2', value: '20000000' }
      ]
    };
    
    const paymentIntent = {
      creatorOutputs: [
        { address: 'addr1', amount: '25000000' }, // Sum of 10M + 15M
        { address: 'addr2', amount: '20000000' }
      ]
    };
    
    // Execute
    const result = await verifyPayment(mockTx, paymentIntent);
    
    // Verify
    expect(result.valid).toBe(true);
    expect(result.creatorOutputsValid).toEqual([true, true]);
  });
});
```

### 7.4 End-to-End Testnet Checklist

```markdown
## E2E Testnet Validation Checklist

- [ ] Step 1: Environment Setup
  - [ ] Testnet node synced to network height
  - [ ] Wallet initialized and unlocked
  - [ ] Test addresses generated (platform + 2+ creators)
  - [ ] Testnet ERG obtained from faucet
  
- [ ] Step 2: Database Setup
  - [ ] Test creators inserted with real testnet addresses
  - [ ] Test snippets created with pricing
  - [ ] Verify foreign key relationships
  
- [ ] Step 3: API Validation
  - [ ] GET /api/creators returns test data
  - [ ] POST /api/requests creates request
  - [ ] POST /api/compositions/propose creates composition
  - [ ] POST /api/compositions/:id/lock generates payment intent
  
- [ ] Step 4: Payment Intent Verification
  - [ ] Platform output has correct address and amount
  - [ ] Creator outputs aggregated by address
  - [ ] Total matches composition price
  - [ ] No duplicate addresses in outputs
  
- [ ] Step 5: Transaction Submission
  - [ ] Build transaction from payment intent
  - [ ] Sign via wallet
  - [ ] Broadcast to testnet
  - [ ] Capture transaction ID
  
- [ ] Step 6: Confirmation
  - [ ] Wait for transaction in explorer (1+ confirmations)
  - [ ] POST /api/compositions/:id/confirm with txId
  - [ ] Verify response: valid=true, all outputs verified
  - [ ] Check database: composition.status = "paid"
  
- [ ] Step 7: On-Chain Validation
  - [ ] Query explorer API for transaction details
  - [ ] Verify platform received correct amount
  - [ ] Verify each creator received aggregated amount
  - [ ] Confirm no ERG lost (conservation law)
  
- [ ] Step 8: Edge Cases
  - [ ] Test with single creator (no aggregation needed)
  - [ ] Test with 5+ creators (multiple outputs)
  - [ ] Test overpayment (user sends extra ERG)
  - [ ] Test confirmation timeout (old transaction)
```

---

## 8. Tools & Libraries

### 8.1 Fleet SDK (TypeScript)

**Installation:**
```bash
npm install @fleet-sdk/core @fleet-sdk/wallet @fleet-sdk/serializer
```

**Transaction Building:**
```typescript
import { TransactionBuilder, OutputBuilder } from '@fleet-sdk/core';
import { SConstant, SInt, SColl, SByte } from '@fleet-sdk/serializer';

// Build output with register
const output = new OutputBuilder(amount, address)
  .setAdditionalRegisters({
    R4: SConstant(SInt, compositionId),
    R5: SConstant(SColl(SByte), hexToBytes(dataHash))
  });

// Build transaction
const tx = new TransactionBuilder(height)
  .from(inputBoxes)
  .to(output)
  .sendChangeTo(changeAddress)
  .payFee(feeAmount)
  .build();
```

**Box Selection:**
```typescript
import { BoxSelector } from '@fleet-sdk/core';

const selector = new BoxSelector(boxes);
const selected = selector.select(targetAmount + feeAmount);
```

### 8.2 Explorer API

**Endpoints:**

```typescript
// Base URLs
const MAINNET_API = 'https://api.ergoplatform.com';
const TESTNET_API = 'https://api-testnet.ergoplatform.com';

// Get transaction
GET /api/v1/transactions/{txId}

// Get address balance
GET /api/v1/addresses/{address}/balance/confirmed

// Get boxes by address
GET /api/v1/boxes/unspent/byAddress/{address}

// Get current height
GET /api/v1/blocks?limit=1
```

**Response Types:**

```typescript
interface ExplorerTransaction {
  id: string;
  blockId: string;
  inclusionHeight: number;
  timestamp: number;
  confirmationsCount: number;
  inputs: Array<{
    boxId: string;
    value: number;
    address: string;
    spendingProof: string;
  }>;
  outputs: Array<{
    boxId: string;
    transactionId: string;
    value: number;
    index: number;
    creationHeight: number;
    address: string;
    additionalRegisters: Record<string, string>; // R4-R9 hex values
  }>;
  size: number;
}
```

### 8.3 Node API

**Wallet Operations:**

```bash
# Unlock wallet
POST /wallet/unlock
Body: { "pass": "your_password" }
Headers: { "api_key": "your_api_key" }

# Get balance
GET /wallet/balances

# Get addresses
GET /wallet/addresses

# Get boxes
GET /wallet/boxes/unspent?minConfirmations=0

# Build transaction
POST /wallet/transaction/send
Body: {
  "requests": [
    { "address": "...", "value": 1000000 }
  ],
  "fee": 1000000
}
```

### 8.4 Nautilus Wallet (Browser Extension)

**dApp Connector API:**

```typescript
// Check if installed
if (window.ergo_request_read_access) {
  // Nautilus available
}

// Request access
const granted = await window.ergo_request_read_access();

// API methods
window.ergo.get_balance() // Returns "1000000000" (string)
window.ergo.get_change_address() // Returns user address
window.ergo.get_used_addresses() // Returns array of addresses
window.ergo.get_utxos(amount?, tokenId?) // Returns available boxes
window.ergo.sign_tx(unsignedTx) // Opens popup, returns signed tx
window.ergo.submit_tx(signedTx) // Broadcasts, returns txId
window.ergo.get_current_height() // Returns current block height
```

**EIP-12 Unsigned Transaction Format:**

```typescript
interface UnsignedErgoTx {
  inputs: Array<{
    boxId: string;
    extension: Record<string, any>;
  }>;
  dataInputs: Array<{
    boxId: string;
  }>;
  outputs: Array<{
    value: string; // nanoERG amount
    ergoTree: string; // Contract bytecode (base16)
    assets: Array<{
      tokenId: string;
      amount: string;
    }>;
    additionalRegisters: Record<string, string>; // R4-R9
    creationHeight: number;
  }>;
}
```

---

## 9. Decision Frameworks

### 9.1 When to Aggregate Payments

**Aggregate if:**
- Multiple items from same seller/creator
- Cost savings > complexity overhead
- Transaction size matters (mobile, low bandwidth)
- Gas optimization desired

**Don't aggregate if:**
- Each payment needs unique metadata (different R4 values)
- Audit trail requires 1:1 mapping
- Refund complexity increases significantly
- Testing/debugging aggregation logic exceeds savings

**Rule of Thumb:** Always aggregate in production marketplaces with multiple sellers.

### 9.2 Register Usage Decision Tree

```
Do you need on-chain audit trail?
├─ NO → Skip registers (Option 0: amounts only)
│       Pros: Simpler, smaller transactions
│       Cons: No on-chain proof of intent
│
└─ YES → Do you need register data for payment validity?
         ├─ NO → Optional registers (Option 2: R4 commitment, non-blocking)
         │       Pros: Audit trail + backward compatible
         │       Cons: Slightly larger transactions
         │
         └─ YES → Required registers (not recommended)
                  Pros: Strong on-chain guarantee
                  Cons: Breaks wallet compatibility, complex validation
```

**Recommendation:** Use Option 2 (optional R4 commitment) for production.

### 9.3 Confirmation Threshold Selection

```
Transaction Value | Min Confirmations | Wait Time | Risk
------------------+-------------------+-----------+--------
< 1 ERG           | 1                 | ~2 min    | Low
1-10 ERG          | 3                 | ~6 min    | Medium
10-100 ERG        | 6                 | ~12 min   | Medium
> 100 ERG         | 12                | ~24 min   | High
```

**Factors:**
- Block time: ~2 minutes average (variable)
- Finality: 6+ confirmations considered safe
- User experience: Balance security vs wait time
- Double-spend risk: Higher for 0-1 confirmations

**Production Recommendation:** 
- MVP: 1 confirmation (acceptable for < 10 ERG)
- Production: 3 confirmations (good balance)
- High-value: 6+ confirmations

---

## 10. Code Reference Catalog

### 10.1 File Structure

```
src/
├── app/api/
│   ├── requests/route.ts           # POST: Create user request
│   ├── creators/route.ts           # GET: List creators
│   └── compositions/
│       ├── propose/route.ts        # POST: Propose composition
│       └── [id]/
│           ├── lock/route.ts       # POST: Lock & generate payment intent
│           └── confirm/route.ts    # POST: Verify on-chain payment
├── lib/
│   ├── db.ts                       # Database connection pool
│   ├── db-compositions.ts          # Composition queries (with aggregation)
│   ├── explorer.ts                 # UTXO-safe verification logic
│   ├── tx-builder.ts               # Transaction construction (backend)
│   ├── payments.ts                 # Register encoding helpers
│   ├── wallet-v2.ts                # Wallet types (Fleet SDK)
│   └── config_v2.ts                # Platform config (addresses, fees)
└── types/
    └── v2.ts                       # TypeScript interfaces (PaymentIntent, etc.)
```

### 10.2 Key Functions Reference

**Payment Aggregation:**
```typescript
// File: src/lib/db-compositions.ts
export async function getAggregatedCreatorPayouts(
  compositionId: number
): Promise<Array<{ address: string; amount: string; count: number }>>
```

**UTXO Verification:**
```typescript
// File: src/lib/explorer.ts
export async function verifyPayment(
  txId: string,
  paymentIntent: PaymentIntent
): Promise<VerificationResult>
```

**Transaction Building:**
```typescript
// File: src/lib/tx-builder.ts
export function buildPaymentTransaction(
  paymentIntent: PaymentIntent,
  userBoxes: Box[],
  height: number
): UnsignedTransaction
```

**Register Encoding:**
```typescript
// File: src/lib/payments.ts
export function encodeCompositionId(id: number): string // Returns R4 hex
export function decodeR4Register(hex: string): string   // Returns ID
```

### 10.3 Database Schema Snippets

**Core Tables:**

```sql
-- Creators with payout addresses
CREATE TABLE creators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(255) NOT NULL,
  payout_address VARCHAR(255) NOT NULL, -- Ergo P2PK address
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compositions (shopping carts)
CREATE TABLE compositions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  status ENUM('proposed', 'awaiting_payment', 'paid', 'failed') DEFAULT 'proposed',
  total_price_nanoerg BIGINT NOT NULL,
  tx_id VARCHAR(64), -- Transaction hash after payment
  FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Composition items (with creator address for aggregation)
CREATE TABLE composition_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  composition_id INT NOT NULL,
  snippet_version_id INT NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  creator_payout_address VARCHAR(255) NOT NULL, -- Denormalized for aggregation
  FOREIGN KEY (composition_id) REFERENCES compositions(id),
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id)
);

-- Payment records
CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  composition_id INT NOT NULL UNIQUE,
  tx_id VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'confirmed', 'rejected') DEFAULT 'pending',
  verified_at TIMESTAMP NULL,
  FOREIGN KEY (composition_id) REFERENCES compositions(id)
);
```

**Aggregation Query:**

```sql
-- Get aggregated payouts for a composition
SELECT 
  creator_payout_address,
  SUM(price_nanoerg) as total_amount,
  COUNT(*) as snippet_count,
  GROUP_CONCAT(snippet_version_id) as snippet_ids
FROM composition_items
WHERE composition_id = ?
GROUP BY creator_payout_address;
```

---

## Appendix A: Testnet Validation Results

**Transaction:** `6bd7c31e5939290a8ee798c6d0520e659699bb62412134e3881e1d2a8177df3e`  
**Block:** 90891  
**Date:** January 3, 2026  
**Explorer:** https://testnet.ergoplatform.com/en/transactions/6bd7c31e...

**Test Scenario:**
- 3 snippets purchased
- 2 creators (Creator1 owns snippets 1+2, Creator2 owns snippet 3)
- Payment aggregation: Creator1 receives 25M (10M + 15M combined)

**Verified Outputs:**
```
Output 0: Platform Fee
  Address: 3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ
  Amount: 5,000,000 nanoERG (0.005 ERG)
  Status: ✓ VERIFIED

Output 1: Creator1 (Aggregated)
  Address: 3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz
  Amount: 25,000,000 nanoERG (0.025 ERG)
  Snippets: #1 (10M) + #2 (15M) = 25M
  Status: ✓ VERIFIED (Aggregation working)

Output 2: Creator2
  Address: 3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB
  Amount: 20,000,000 nanoERG (0.020 ERG)
  Snippets: #3 (20M)
  Status: ✓ VERIFIED

Output 3: Miner Fee
  Amount: 1,000,000 nanoERG (0.001 ERG)
  Status: ✓ VERIFIED

Output 4: Change
  Address: 3WwEcnKeuUUWaCsMDL7eSvhShTnFBJJttSb6P1rTg3DPgZ6hPyW7
  Amount: 67,451,000,000 nanoERG (67.451 ERG)
  Status: ✓ VERIFIED
```

**Conclusions:**
1. ✅ Payment aggregation logic working correctly
2. ✅ UTXO-safe verification passing
3. ✅ Multiple outputs to same address handled properly
4. ✅ All 4 payout-critical patches validated on-chain
5. ✅ No ERG lost (conservation law upheld)

---

## Appendix B: Expanding This Knowledge Base

### B.1 Contributing New Sections

**Format:**
```markdown
## N. Section Title

### N.1 Subsection

**Problem:** Clear problem statement

**Solution:** Code example with explanation

**Critical Rules:**
- Rule 1
- Rule 2

**Example:**
\`\`\`typescript
// Working code example
\`\`\`
```

### B.2 Suggested Future Sections

- **Token Payments:** Native asset handling in Ergo
- **Smart Contracts:** P2S addresses and ErgoScript integration
- **Batch Payments:** Processing multiple compositions in single transaction
- **Refund Patterns:** Implementing cancellation and refund logic
- **Multi-Sig:** Escrow with multiple signatories
- **Oracle Integration:** Using oracle data in payment validation
- **Privacy:** Using Sigma protocols for confidential payments
- **Scaling:** Optimizing for high transaction volume

### B.3 Maintenance Guidelines

- Update code examples when libraries change (Fleet SDK versions)
- Add new pitfalls as discovered in production
- Include links to official documentation
- Date-stamp significant changes
- Test all code examples against current APIs

---

**Document Version:** 1.0  
**Last Updated:** January 3, 2026  
**Next Review:** Quarterly or when major Ergo protocol updates occur  
**Maintainer:** AI Knowledge Base / PromptPage Development Team
