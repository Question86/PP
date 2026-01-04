# Payment Flow Test Guide

## Current Status: ✅ Ready for Testing

Your dev server is running on **http://localhost:3001**

---

## Test Page Available

Navigate to: **http://localhost:3001/test-payment-flow.html**

This interactive test page verifies the complete payment pipeline:

### What It Tests:

1. **Fetch Snippets** → Queries database for published snippets with prices
2. **Create Request** → Saves user prompt and address to DB
3. **Propose Composition** → Selects snippets and creates composition
4. **Lock & Generate Payment Intent** → Key step that:
   - Fetches creator payout addresses from DB
   - Aggregates payments by creator address
   - Computes R4 commitment hash
   - Returns payment intent ready for transaction building

---

## How to Use the Test Page:

### Step 1: Enter Your Address
```
Use your Nautilus wallet address or any testnet address:
Example: 3WwdXmYP1v8vRlP4M8fVVzVzWvZpJmxT1yKnGqAqTGYQvD7KqH5L
```

### Step 2: Click Through Each Step
1. **Fetch Snippets** - See what's in the database
2. **Create Request** - Submit your prompt
3. **Propose Composition** - Algorithm selects snippets
4. **Lock Composition** - Generate payment intent with R4 commitment

### Step 3: Verify Payment Intent
The final output shows:
- ✅ R4 commitment hash (32-byte hex)
- ✅ Platform output (address + amount)
- ✅ Creator outputs (aggregated by address)
- ✅ Each creator's snippet count and version IDs
- ✅ Total required amount

---

## What You Should See:

### Expected Output Structure:
```json
{
  "compositionId": 1,
  "protocolVersion": 1,
  "commitmentHex": "062ae4c2...", // 64 hex chars
  "platformOutput": {
    "address": "3Ww6Lw9R...",
    "amount": "5000000" // 0.005 ERG platform fee
  },
  "creatorOutputs": [
    {
      "address": "3WwdXmYP...", // Creator 1 testnet address
      "amount": "25000000", // 0.025 ERG (aggregated)
      "snippetCount": 2,
      "snippetVersionIds": [1, 2]
    },
    {
      "address": "3WwdXmYP...", // Creator 2 testnet address
      "amount": "20000000", // 0.020 ERG
      "snippetCount": 1,
      "snippetVersionIds": [3]
    }
  ],
  "totalRequired": "50000000", // 0.050 ERG total
  "estimatedFee": "1000000" // 0.001 ERG tx fee
}
```

---

## Database Flow Verified:

### 1. Snippet → Creator Mapping ✅
```sql
SELECT sv.id, c.payout_address, sv.price_nanoerg
FROM snippet_versions sv
JOIN snippets s ON s.id = sv.snippet_id
JOIN creators c ON c.id = s.creator_id
```

### 2. Composition Items with Payout Addresses ✅
```sql
INSERT INTO composition_items 
  (composition_id, snippet_version_id, creator_payout_address, price_nanoerg, position)
VALUES 
  (1, 1, '3WwdXmYP...', 10000000, 0),
  (1, 2, '3WwdXmYP...', 15000000, 1),
  (1, 3, '3WwdXmYP...', 20000000, 2)
```

### 3. Aggregated Payouts ✅
```sql
SELECT 
  creator_payout_address,
  SUM(price_nanoerg) as total_amount,
  COUNT(*) as snippet_count,
  GROUP_CONCAT(snippet_version_id) as snippet_version_ids
FROM composition_items
WHERE composition_id = 1
GROUP BY creator_payout_address
```

---

## Next Steps After Test Page Verification:

### 1. Test in Browse Page
Navigate to: **http://localhost:3001/browse**
- Connect Nautilus wallet
- Select snippets
- Create composition
- Should redirect to `/pay/[id]`

### 2. Test Payment Page
At: **http://localhost:3001/pay/[compositionId]**
- Click "Lock & Generate Payment Intent"
- Verify R4 commitment displayed
- Click "Pay with Nautilus Wallet"
- Sign transaction in Nautilus popup
- Verify transaction submitted

### 3. Verify on Explorer
After payment:
- Copy transaction ID
- Go to: https://testnet.ergoplatform.com/en/transactions/[txId]
- Check platform output has R4 register
- Verify R4 value: `0e20[commitmentHex]`

---

## Database Setup (If Needed):

If you see "No snippets found", run:

```bash
# Windows (adjust path to your MySQL installation)
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p promptpage < test_data_setup.sql
```

This creates:
- 2 test creators with testnet addresses
- 3 test snippets (Python, Data Analysis, Code Review)
- 3 snippet versions with prices (0.010, 0.015, 0.020 ERG)

---

## Troubleshooting:

### "No snippets found"
→ Run `test_data_setup.sql` to populate database

### "Plugin 'mysql_native_password' is not loaded"
→ Ignore - this only affects CLI scripts, not API endpoints

### "Composition not found"
→ Create a new request + composition through test page

### Port 3000 in use
→ Using port 3001 instead (as shown in terminal)

---

## Full E2E Flow Summary:

```
User Action                  Backend                           Result
─────────────────────────────────────────────────────────────────────────
1. Browse page               GET /api/snippets                 Display snippets
2. Select snippets           POST /api/requests                requestId created
3. Create composition        POST /api/compositions/propose    compositionId created
                            └─> Fetch creator addresses
                            └─> Create composition_items
4. Lock composition          POST /api/compositions/[id]/lock  Payment intent
                            └─> Aggregate payouts by address
                            └─> Compute R4 commitment
5. Pay button                buildPaymentTransaction()         Unsigned tx
                            └─> Add R4 to platform output
6. Sign in Nautilus          wallet.signTx()                   Signed tx
7. Submit transaction        wallet.submitTx()                 txId
8. Confirm payment           POST /api/compositions/[id]/confirm
                            └─> Verify R4 on Explorer
                            └─> Update status to 'paid'
9. Success page              GET /api/compositions/[id]/content  Deliver content
```

---

## Key Files Involved:

**Database Layer:**
- `src/lib/db-compositions.ts` - Query functions
  - `getAggregatedCreatorPayouts()` - Groups payments by creator

**API Endpoints:**
- `src/app/api/snippets/route.ts` - List snippets
- `src/app/api/compositions/propose/route.ts` - Create composition
- `src/app/api/compositions/[id]/lock/route.ts` - Generate payment intent
- `src/app/api/compositions/[id]/confirm/route.ts` - Verify payment

**Payment Logic:**
- `src/lib/payments.ts` 
  - `computeCommitment()` - R4 hash
  - `buildPaymentTransaction()` - Create unsigned tx

**Frontend:**
- `src/app/browse/page.tsx` - Snippet selection
- `src/app/pay/[id]/page.tsx` - Payment execution
- `src/hooks/useWallet.ts` - Nautilus integration

---

## Success Criteria:

✅ Test page shows snippets from database  
✅ Payment intent includes creator addresses  
✅ R4 commitment hash is 64 hex characters  
✅ Creator outputs aggregated correctly  
✅ Total amount = snippets + platform fee  
✅ Each creator output has snippet version IDs  

---

**Ready to test!** Open http://localhost:3001/test-payment-flow.html
