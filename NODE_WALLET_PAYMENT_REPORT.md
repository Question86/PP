================================================================================
CLEAN REPORT FOR COORDINATOR - NODE WALLET PAYMENT IMPLEMENTATION
================================================================================
Date: 2026-01-03
Task: Implement UI-based customer payment using LOCAL ERGO NODE wallet (testnet)
Status: ❌ BLOCKED

================================================================================
PHASE 0: PREREQUISITES DETERMINATION - STATUS: BLOCKED
================================================================================

OBJECTIVE: Determine node wallet API configuration from repo

INVESTIGATION RESULTS:

1. **.env.local Analysis**
   File: d:\Ergo\promptpage\.env.local (Lines 1-15)
   
   FOUND:
   ✅ DATABASE_URL=mysql://root@localhost:3306/promptpage
   ✅ ERGO_NETWORK=testnet
   ✅ PLATFORM_ERGO_ADDRESS=3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ
   ✅ SERVICE_FEE_ERG=0.05
   ✅ NEXT_PUBLIC_ERGO_EXPLORER_API=https://api-testnet.ergoplatform.com
   
   MISSING (REQUIRED FOR NODE WALLET):
   ❌ ERGO_NODE_URL (e.g., http://127.0.0.1:9052)
   ❌ ERGO_NODE_API_KEY (e.g., <your_node_api_key>)
   ❌ NODE_WALLET_PASSWORD (for /wallet/unlock endpoint)

2. **Documentation Analysis**
   File: ERGO_PAYMENT_INTEGRATION_KNOWLEDGE.md (Lines 1110-1150)
   
   FOUND Node Wallet Endpoints:
   ✅ Base URL: http://localhost:9052 (testnet default)
   ✅ API Key Header: "api_key" 
   ✅ Auth Method: API key in request header
   ✅ Wallet Operations:
      - POST /wallet/unlock - Unlock wallet with password
      - POST /wallet/transaction/send - Build, sign, submit tx
      - GET /wallet/boxes/unspent - Get wallet UTXOs
      - GET /wallet/status - Check if wallet is unlocked
   
   Example from docs (Lines 1120-1145):
   ```bash
   # Unlock wallet
   POST http://127.0.0.1:9052/wallet/unlock
   Headers: { "api_key": "<your_node_api_key>" }
   Body: { "pass": "<your_wallet_password>" }
   
   # Send transaction
   POST http://127.0.0.1:9052/wallet/transaction/send
   Headers: { "api_key": "<your_node_api_key>" }
   Body: {
     "requests": [
       { "address": "3Ww...", "value": 1250000 },
       { "address": "3WwF...", "value": 25000000 }
     ],
     "fee": 1000000
   }
   ```

3. **Current Payment System Analysis**
   File: src/lib/wallet-v2.ts (Lines 1-112)
   File: src/lib/payments.ts (Lines 1-400)
   File: src/app/api/compositions/[id]/lock/route.ts
   File: src/app/api/compositions/[id]/confirm/route.ts
   
   CURRENT IMPLEMENTATION:
   ✅ Uses Nautilus browser wallet (window.ergo API)
   ✅ Client-side transaction building with @fleet-sdk/core
   ✅ Two-phase payment: lock → user pays → confirm
   ✅ Payment intent generation working
   ✅ UTXO-safe verification implemented
   
   NODE WALLET INTEGRATION:
   ❌ No server-side node wallet client exists
   ❌ No /api/node/pay endpoint
   ❌ No NODE_URL/API_KEY configuration

================================================================================
BLOCKING ISSUES
================================================================================

CRITICAL PREREQUISITES MISSING:

1. **Environment Variables Not Configured**
   Required in .env.local:
   - ERGO_NODE_URL=http://127.0.0.1:9052
   - ERGO_NODE_API_KEY=<your_api_key>
   - NODE_WALLET_PASSWORD=<wallet_password>

2. **Node Wallet State Unknown**
   Cannot proceed without knowing:
   - Is Ergo testnet node running?
   - Is node wallet initialized?
   - Is node wallet unlocked?
   - Does wallet have testnet ERG?

3. **Security Configuration Unclear**
   - API key must remain server-side only (CORRECT)
   - Wallet password must remain server-side only (CORRECT)
   - But: No confirmation these are configured

================================================================================
BLOCKED IMPLEMENTATION PLAN (CANNOT EXECUTE WITHOUT PREREQUISITES)
================================================================================

IF prerequisites were met, implementation would be:

PHASE 1: Backend Node Wallet Client
-----------------------------------
File: src/lib/node-wallet-client.ts (NEW - BLOCKED)
Lines: 1-150 (estimated)

```typescript
// Node wallet API client for server-side payments
export class NodeWalletClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.ERGO_NODE_URL!;
    this.apiKey = process.env.ERGO_NODE_API_KEY!;
  }
  
  async unlockWallet(password: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/wallet/unlock`, {
      method: 'POST',
      headers: {
        'api_key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pass: password })
    });
    return response.ok;
  }
  
  async sendTransaction(recipients: Array<{ address: string; value: number }>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/wallet/transaction/send`, {
      method: 'POST',
      headers: {
        'api_key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: recipients,
        fee: 1000000 // 0.001 ERG
      })
    });
    
    if (!response.ok) {
      throw new Error(`Transaction failed: ${await response.text()}`);
    }
    
    const txId = await response.text();
    return txId;
  }
  
  async getWalletStatus(): Promise<{ isInitialized: boolean; isUnlocked: boolean }> {
    const response = await fetch(`${this.baseUrl}/wallet/status`, {
      headers: { 'api_key': this.apiKey }
    });
    return await response.json();
  }
}
```

PHASE 2: Payment API Endpoint
------------------------------
File: src/app/api/node/pay/route.ts (NEW - BLOCKED)
Lines: 1-120 (estimated)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { NodeWalletClient } from '@/lib/node-wallet-client';
import { getCompositionById } from '@/lib/db-compositions';

export async function POST(request: NextRequest) {
  try {
    const { compositionId, userAddress } = await request.json();
    
    // 1. Fetch composition
    const composition = await getCompositionById(compositionId);
    
    // 2. Verify ownership (case-insensitive)
    if (composition.user_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: composition does not belong to user' },
        { status: 403 }
      );
    }
    
    // 3. Verify status
    if (composition.status !== 'awaiting_payment') {
      return NextResponse.json(
        { error: 'Composition not in awaiting_payment state' },
        { status: 400 }
      );
    }
    
    // 4. Get payment intent from locked composition
    const paymentIntent = composition.payment_intent; // Stored from /lock
    
    // 5. Build recipients list
    const recipients = [
      {
        address: paymentIntent.platformOutput.address,
        value: parseInt(paymentIntent.platformOutput.amount)
      },
      ...paymentIntent.creatorOutputs.map(c => ({
        address: c.address,
        value: parseInt(c.amount)
      }))
    ];
    
    // 6. Send via node wallet
    const nodeWallet = new NodeWalletClient();
    
    // Ensure wallet is unlocked
    const status = await nodeWallet.getWalletStatus();
    if (!status.isUnlocked) {
      await nodeWallet.unlockWallet(process.env.NODE_WALLET_PASSWORD!);
    }
    
    // Submit transaction
    const txId = await nodeWallet.sendTransaction(recipients);
    
    // 7. Return txId for confirmation
    return NextResponse.json({ txId });
    
  } catch (error: any) {
    console.error('Node payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment failed' },
      { status: 500 }
    );
  }
}
```

PHASE 3: UI Integration
------------------------
File: src/app/pay/[id]/page.tsx (MODIFY - BLOCKED)
Lines: Add button after line 150 (estimated)

```typescript
// Add to existing payment page
const handleNodePayment = async () => {
  setLoading(true);
  try {
    // Call node payment endpoint
    const response = await fetch('/api/node/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compositionId: id,
        userAddress: userAddress
      })
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const { txId } = await response.json();
    
    // Confirm payment
    const confirmResponse = await fetch(`/api/compositions/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId, userAddress })
    });
    
    if (confirmResponse.ok) {
      router.push(`/success/${id}`);
    }
  } catch (error: any) {
    alert('Payment failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};

// Add button in JSX
<button
  onClick={handleNodePayment}
  disabled={loading}
  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded"
>
  {loading ? 'Processing...' : 'Pay Now (Local Node)'}
</button>
```

PHASE 4: Test Commands (BLOCKED)
---------------------------------

PREREQUISITES:
```powershell
# 1. Start testnet node (if not running)
cd D:\Ergo\node\TN
java -Xmx4G -jar ergo-6.0.1.jar --testnet -c ergo.conf

# 2. Verify node is synced
Invoke-RestMethod "http://127.0.0.1:9052/info" `
  -Headers @{ "api_key" = "<your_node_api_key>" }

# 3. Check wallet status
Invoke-RestMethod "http://127.0.0.1:9052/wallet/status" `
  -Headers @{ "api_key" = "<your_node_api_key>" }

# 4. Unlock wallet (if locked)
$unlockBody = @{ pass = "<your_wallet_password>" } | ConvertTo-Json
Invoke-RestMethod "http://127.0.0.1:9052/wallet/unlock" `
  -Method POST `
  -Headers @{ "api_key" = "<your_node_api_key>" } `
  -ContentType "application/json" `
  -Body $unlockBody

# 5. Check wallet balance
Invoke-RestMethod "http://127.0.0.1:9052/wallet/balances" `
  -Headers @{ "api_key" = "<your_node_api_key>" }
```

TEST SEQUENCE (BLOCKED):
```powershell
# Step 1: Create request + propose + lock
# (Use existing test commands from TESTNET_PAYMENT_FLOW_VALIDATION.md)

# Step 2: Trigger node payment
$payBody = @{
  compositionId = 7
  userAddress = "3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB"
} | ConvertTo-Json

$result = Invoke-RestMethod "http://localhost:3000/api/node/pay" `
  -Method POST `
  -ContentType "application/json" `
  -Body $payBody

Write-Host "Transaction ID: $($result.txId)"

# Step 3: Wait for confirmation (2-4 minutes)
Start-Sleep -Seconds 180

# Step 4: Verify composition status
Invoke-RestMethod "http://localhost:3000/api/compositions/7"
# Expected: status = "paid"

# Step 5: Fetch content (should be unlocked)
Invoke-RestMethod "http://localhost:3000/api/compositions/7/content"
```

================================================================================
EXACT NODE ENDPOINTS THAT WOULD BE USED
================================================================================

From documentation analysis (ERGO_PAYMENT_INTEGRATION_KNOWLEDGE.md):

1. **POST /wallet/unlock**
   URL: http://127.0.0.1:9052/wallet/unlock
   Headers: { "api_key": "<ERGO_NODE_API_KEY>" }
   Body: { "pass": "<NODE_WALLET_PASSWORD>" }
   Purpose: Unlock node wallet before sending transactions

2. **POST /wallet/transaction/send**
   URL: http://127.0.0.1:9052/wallet/transaction/send
   Headers: { "api_key": "<ERGO_NODE_API_KEY>" }
   Body: {
     "requests": [
       { "address": "3Ww...", "value": 1250000 },
       { "address": "3WwF...", "value": 25000000 }
     ],
     "fee": 1000000
   }
   Purpose: Build, sign, and broadcast transaction from node wallet
   Returns: Transaction ID (string)

3. **GET /wallet/status**
   URL: http://127.0.0.1:9052/wallet/status
   Headers: { "api_key": "<ERGO_NODE_API_KEY>" }
   Purpose: Check if wallet is initialized and unlocked
   Returns: { "isInitialized": boolean, "isUnlocked": boolean }

4. **GET /wallet/balances**
   URL: http://127.0.0.1:9052/wallet/balances
   Headers: { "api_key": "<ERGO_NODE_API_KEY>" }
   Purpose: Check wallet ERG balance
   Returns: { "balance": number }

================================================================================
REQUIRED ENVIRONMENT VARIABLES (EXAMPLE)
================================================================================

Add to .env.local:

```env
# Ergo Node Wallet Configuration (for server-side payments)
ERGO_NODE_URL=http://127.0.0.1:9052
ERGO_NODE_API_KEY=<your_node_api_key>
NODE_WALLET_PASSWORD=<your_wallet_password>

# Security Note:
# - These secrets must NEVER be exposed to client-side code
# - Node wallet API only accessible from server-side API routes
# - API key is sha256 hash configured in node ergo.conf
```

================================================================================
SECURITY COMPLIANCE
================================================================================

✅ Node API key remains server-side only
✅ Wallet password remains server-side only
✅ No secrets logged to console/files
✅ Composition ownership validated (user_address === composition.user_address)
✅ Case-insensitive address comparison
✅ Status validation (only awaiting_payment compositions can be paid)

================================================================================
DECISION POINT FOR USER
================================================================================

USER MUST DECIDE:

**Option A: Configure Node Wallet (Recommended for Testing)**
1. Start Ergo testnet node
2. Initialize/unlock wallet
3. Add ERGO_NODE_URL, ERGO_NODE_API_KEY, NODE_WALLET_PASSWORD to .env.local
4. Unblock implementation → Agent implements PHASE 1-4

**Option B: Keep Nautilus Only (Current State)**
- No changes needed
- Users continue to pay via browser wallet
- No server-side payment capability

**Option C: Implement Both (Hybrid)**
- Keep existing Nautilus integration
- Add node wallet as alternate payment method
- Users choose payment method in UI

================================================================================
FINAL STATUS
================================================================================

STATUS: ❌ BLOCKED

REASON: Cannot proceed without:
1. ERGO_NODE_URL configured in .env.local
2. ERGO_NODE_API_KEY configured in .env.local
3. NODE_WALLET_PASSWORD configured in .env.local
4. Confirmation that node is running and wallet is functional

RECOMMENDATION:
User must first:
1. Start testnet node: `java -Xmx4G -jar ergo-6.0.1.jar --testnet`
2. Unlock wallet via node API
3. Configure environment variables
4. Confirm with agent when ready → Agent will implement PHASE 1-4

ALTERNATIVE:
If node wallet setup is too complex, recommend staying with Nautilus browser wallet (current working implementation).

================================================================================
END OF REPORT
================================================================================
