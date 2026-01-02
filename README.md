# PromptPage V2 - Modular Prompt Snippet Marketplace

A non-custodial Ergo blockchain marketplace for buying and selling reusable prompt engineering snippets with automatic multi-creator payment splitting.

## Overview

**PromptPage V2** is a modular prompt snippet marketplace where:
- **Creators** upload reusable prompt components (snippets) and earn from usage
- **Users** describe their goals and receive AI-composed snippet suggestions
- **Payment** automatically splits between multiple creators + platform in one transaction
- **Composition Algorithm** (private) selects and ranks optimal snippet combinations

### Key Innovation
Monetizes **composition expertise** (snippet selection/ranking), not raw prompt text. The algorithm remains proprietary while providing transparent attribution and fair revenue distribution.

---

## Features

### For Creators
- ✅ Upload modular prompt snippets with metadata (title, summary, category)
- ✅ Version management (update content without breaking compositions)
- ✅ Set prices per snippet in nanoERG
- ✅ Automatic payout aggregation (one output per creator in transaction)
- ✅ Earnings tracking and usage statistics

### For Users
- ✅ Non-custodial: Sign transactions with Nautilus wallet
- ✅ Describe goals in natural language
- ✅ Review AI-composed snippet selections with rationale
- ✅ One-click payment to all creators + platform
- ✅ On-chain attribution via transaction registers

### Platform
- ✅ Private composition algorithm (baseline keyword matching, replaceable with ML)
- ✅ Multi-creator split payment transactions (aggregated outputs)
- ✅ UTXO-safe payment verification (handles multiple outputs per address)
- ✅ Explorer-based transaction verification
- ✅ Single source of truth for creator payouts (composition_items table)

---

## Architecture

### Tech Stack
- **Frontend**: React 18 + Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: MySQL 8.0+ (8 tables for V2, 1 legacy V1 table)
- **Blockchain**: Ergo (testnet/mainnet configurable)
- **Wallet**: Nautilus dApp connector (non-custodial)
- **Transaction Building**: Fleet SDK v0.4.0 (@fleet-sdk/core)
- **Verification**: Ergo Explorer API

### System Flow
```
Creator Flow:
Create Snippet → Add Versions → Set Price → Publish
                                              ↓
                                Earn from usage across platform

User Flow:
Describe Goal → Review Suggestions → Lock Composition → Pay via Nautilus
                                                              ↓
                                                  Funds split to creators + platform
                                                              ↓
                                                  Verify on Explorer → Confirm

Platform Flow:
User Prompt → [Private Composition Engine] → Snippet Selection
                                                    ↓
                          Resolve Creator Addresses (1 query via IN clause)
                                                    ↓
                                Build Split Payment Transaction
                                                    ↓
                    UTXO-Safe Verification (sum outputs per address)
```

### Database Schema (V2)

**8 Core Tables:**

1. **creators** - Creator profiles and payout addresses
2. **snippets** - Snippet metadata (title, category, status)
3. **snippet_versions** - Versioned content with prices
4. **requests** - User prompts and goals
5. **compositions** - Selected snippet combinations
6. **composition_items** - Individual snippets in composition (PAYOUT SOURCE OF TRUTH)
7. **payments** - Transaction tracking and verification
8. **snippet_usage_stats** - Analytics and earnings

Plus 1 legacy **prompts** table (V1 backward compatibility)

### Payment Transaction Structure

```
Inputs: User's UTXOs (sufficient for all outputs + tx fee)

Outputs:
1. Platform Fee Box
   - Value: 0.005 ERG (configurable PLATFORM_FEE_NANOERG)
   - Registers:
     R4: compositionId (UTF-8 bytes)
     R5: snippetVersionIds (comma-separated, UTF-8)
     R6: memo (optional)

2-N. Creator Payout Boxes (aggregated, one per unique creator address)
   - Value: Total nanoERG for all snippets by that creator
   - Address: creator.payout_address from database

N+1. Change Box to User
   - Value: Remaining funds

Fee: 0.001 ERG (MIN_TX_FEE)
```

**Key Design:**
- Multiple snippets from same creator → **single aggregated output**
- All creator addresses resolved in **1 SQL query** (no N+1 problem)
- Verification sums **all outputs per address** (UTXO-safe)

---

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm/yarn
- MySQL 8.0+ database
- Nautilus Wallet browser extension
- ERG testnet funds (for testing)

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/Question86/PP.git
cd PP
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=mysql://username:password@host:3306/promptpage

# Ergo Platform Configuration
ERGO_NETWORK=testnet
PLATFORM_ERGO_ADDRESS=9fPiW...your_address_here
PLATFORM_FEE_ERG=0.005

# Ergo Explorer API
NEXT_PUBLIC_ERGO_EXPLORER_API=https://api-testnet.ergoplatform.com
```

**Configuration Notes:**
- `DATABASE_URL`: MySQL connection string
- `PLATFORM_ERGO_ADDRESS`: Your platform payout address
- `PLATFORM_FEE_ERG`: Platform fee per composition (default: 0.005 ERG)
- `ERGO_NETWORK`: `testnet` or `mainnet`
- Explorer API:
  - Testnet: `https://api-testnet.ergoplatform.com`
  - Mainnet: `https://api.ergoplatform.com`

### 3. Database Migration
Run the V2 migration to create all tables:

```bash
# Import V2 schema
mysql -u username -p promptpage < db/schema_v2.sql

# Or use your preferred MySQL client
```

This creates:
- 8 V2 tables (creators, snippets, snippet_versions, requests, compositions, composition_items, payments, snippet_usage_stats)
- 1 V1 table (prompts - for backward compatibility)
- All foreign keys, indexes, and constraints

### 4. Run Development Server
```bash
npm run dev
```

Application available at `http://localhost:3000`

### 5. Build for Production
```bash
npm run build
npm run start
```

---

## API Endpoints

### Creator Endpoints

#### Create Snippet
```http
POST /api/creators/snippets
X-Creator-Id: 1

{
  "title": "Data Analysis System Prompt",
  "summary": "Expert-level data analysis instructions",
  "category": "system",
  "content": "You are a data scientist...",
  "priceNanoerg": "10000000"
}
```

#### Add Snippet Version
```http
POST /api/creators/snippets/[id]/versions
X-Creator-Id: 1

{
  "content": "Updated prompt text...",
  "priceNanoerg": "12000000",
  "changeNotes": "Added Python-specific examples"
}
```

#### Publish Snippet
```http
POST /api/creators/snippets/[id]/publish
X-Creator-Id: 1

Response: { "status": "published" }
```

### User Endpoints

#### Create Request
```http
POST /api/requests

{
  "userAddress": "9f2Pq...",
  "userPrompt": "I need a prompt for analyzing sales data with Python"
}

Response: { "requestId": 123 }
```

#### Propose Composition
```http
POST /api/compositions/propose

{
  "requestId": 123
}

Response:
{
  "compositionId": 456,
  "items": [
    {
      "snippetTitle": "Data Analysis System Prompt",
      "priceNanoerg": "10000000",
      "rationale": "Matches data analysis requirement"
    }
  ],
  "totals": {
    "snippetsTotal": "25000000",
    "platformFee": "5000000",
    "grandTotal": "30000000"
  }
}
```

#### Lock Composition
```http
POST /api/compositions/[id]/lock

{
  "userAddress": "9f2Pq..."
}

Response:
{
  "paymentIntent": {
    "platformOutput": { "address": "9bK...", "amount": "5000000" },
    "creatorOutputs": [
      { "address": "9f3...", "amount": "15000000" },
      { "address": "9g4...", "amount": "10000000" }
    ],
    "totalRequired": 30000000
  }
}
```

#### Confirm Payment
```http
POST /api/compositions/[id]/confirm

{
  "txId": "abc123...",
  "userAddress": "9f2Pq..."
}

Response: { "status": "confirmed" }
```

---

## Critical Security Fixes

### ✅ Payout-Critical Bugs Fixed (Jan 2, 2026)

**1. UTXO-Safe Payment Verification**
- **Problem:** Used `.find()` to check outputs → failed when wallets split payments into multiple outputs to same address
- **Fix:** Sum all outputs per address before verification
- **File:** `src/lib/explorer.ts` - `verifyPayment()`

**2. N+1 Query Elimination**
- **Problem:** Executed 1 JOIN query per snippet in propose endpoint → timeout risk for many snippets
- **Fix:** Single query with `IN (?,?,...)` clause + Map lookup
- **File:** `src/app/api/compositions/propose/route.ts`

**3. Single Source of Truth**
- **Enforced:** `composition_items.creator_payout_address` is the ONLY source for payouts
- **Flow:** Written once (propose), read multiple times (lock, confirm)
- **Verification:** Payments checked against aggregated DB values

See [PATCHLOG.md](./PATCHLOG.md) for details.

---

## Testing Guide

### Testnet Testing

1. **Install Nautilus Wallet**
   - Install [Nautilus extension](https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
   - Switch to **Testnet** mode in settings

2. **Get Testnet ERG**
   - Visit [Ergo Testnet Faucet](https://testnet.ergofaucet.org/)
   - Request funds (~0.1 ERG for testing)

3. **Create Test Creator**
   ```bash
   curl -X POST http://localhost:3000/api/creators \
     -H "Content-Type: application/json" \
     -d '{
       "displayName": "Test Creator",
       "payoutAddress": "9f2Pq...your_nautilus_address"
     }'
   ```

4. **Create Test Snippets**
   ```bash
   curl -X POST http://localhost:3000/api/creators/snippets \
     -H "Content-Type: application/json" \
     -H "X-Creator-Id: 1" \
     -d '{
       "title": "Python Expert System",
       "summary": "Expert Python developer instructions",
       "category": "system",
       "content": "You are an expert Python developer...",
       "priceNanoerg": "10000000"
     }'
   ```

5. **Publish Snippet**
   ```bash
   curl -X POST http://localhost:3000/api/creators/snippets/1/publish \
     -H "X-Creator-Id: 1"
   ```

6. **Test User Flow**
   - Create request with user prompt
   - Propose composition
   - Lock composition (get payment intent)
   - Build transaction with PayButton component
   - Sign with Nautilus
   - Confirm payment

### UTXO-Safe Test Scenario

To test the UTXO-safe verification fix:

1. **Manually split outputs** in a test transaction
   - Create 2 outputs to same creator address (e.g., 0.005 ERG + 0.005 ERG)
   - Expected: Verification should sum both outputs (0.01 ERG total)

2. **Verify with confirm endpoint**
   - Should pass with `valid: true`
   - Old behavior would fail (only counted first 0.005 ERG)

---

## Project Structure

```
promptpage/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── creators/
│   │   │   │   └── snippets/         # Creator endpoints
│   │   │   ├── compositions/         # User endpoints
│   │   │   ├── requests/             # Request creation
│   │   │   └── creators/             # Creator registration
│   │   ├── page-v2.tsx               # V2 demo page
│   │   └── composition/[id]/         # Composition detail pages
│   ├── components/
│   │   ├── WalletConnect.tsx         # Nautilus wallet integration
│   │   ├── SnippetCard.tsx           # Snippet display
│   │   ├── CompositionSummary.tsx    # Composition preview
│   │   └── PayButton.tsx             # Payment flow handler
│   ├── lib/
│   │   ├── config_v2.ts              # Configuration & constants
│   │   ├── db-creators.ts            # Creator data access
│   │   ├── db-compositions.ts        # Composition data access
│   │   ├── selector.ts               # Composition algorithm (PRIVATE)
│   │   ├── payments.ts               # Transaction building
│   │   ├── explorer.ts               # Payment verification
│   │   └── wallet-v2.ts              # Nautilus connector
│   └── types/
│       └── v2.ts                     # TypeScript interfaces
├── db/
│   └── schema_v2.sql                 # Database schema
├── ARCHITECTURE_V2.md                # Complete architecture docs
├── IMPLEMENTATION_STATUS.md          # What's done vs placeholders
├── PATCHLOG.md                       # Security fixes log
├── PAYOUT_BUG_FIX_VERIFICATION.md    # Payout bug verification
└── UTXO_SAFE_PATCH_REPORT.md         # UTXO-safe patch details
```

---

## Documentation

- **[ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md)** - Complete system architecture reference
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - Implementation status and placeholders
- **[PATCHLOG.md](./PATCHLOG.md)** - Critical security fixes
- **[PAYOUT_BUG_FIX_VERIFICATION.md](./PAYOUT_BUG_FIX_VERIFICATION.md)** - Payout bug verification report
- **[UTXO_SAFE_PATCH_REPORT.md](./UTXO_SAFE_PATCH_REPORT.md)** - UTXO-safe verification patch

---

## Development Status

### ✅ Complete (85%)
- Database schema and access layers
- All 8 API endpoints (creator + user flows)
- Payment transaction builder with aggregation
- UTXO-safe verification
- Nautilus wallet integration
- React components

### ⚠️ Placeholders/Incomplete
- **Authentication**: X-Creator-Id header (insecure, needs JWT/OAuth)
- **Selector Algorithm**: Baseline keyword matching (works but not sophisticated, replace with ML)
- **UI**: Demo pages exist but not integrated into main app
- **Testing**: Zero test coverage
- **Documentation**: README updated, but needs API docs

### 🔥 Critical for Production
1. Replace authentication system
2. Add comprehensive error handling
3. Implement retry logic for API/blockchain calls
4. Add rate limiting
5. Deploy to testnet and run full flow tests

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see LICENSE file for details

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Question86/PP/issues)
- **Ergo Documentation**: [docs.ergoplatform.com](https://docs.ergoplatform.com)
- **Fleet SDK**: [@fleet-sdk/core](https://www.npmjs.com/package/@fleet-sdk/core)
- **Nautilus Wallet**: [nautilus-wallet.io](https://nautilus-wallet.io)

---

## Acknowledgments

- Ergo Platform team for blockchain infrastructure
- Nautilus Wallet team for dApp connector
- Fleet SDK maintainers for transaction building tools
