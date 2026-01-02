# PromptPage Architecture - Complete System Reference

**Version:** 1.0  
**Date:** 2026-01-02  
**Status:** Implementation Ready

---

## Executive Summary

PromptPage is a **non-custodial Ergo blockchain marketplace** for modular prompt engineering snippets. Creators upload reusable prompt components; users describe their goals and receive AI-composed suggestions. Payment automatically splits between multiple creators and the platform in a single Ergo transaction.

**Key Innovation:** Monetizes **composition expertise** (snippet selection/ranking algorithm), not raw prompt text. The composition algorithm remains proprietary while providing transparent attribution and fair revenue distribution.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Principles](#2-core-principles)
3. [Architecture Layers](#3-architecture-layers)
4. [Database Schema](#4-database-schema)
5. [Transaction Structure](#5-transaction-structure)
6. [API Design](#6-api-design)
7. [Flow Diagrams](#7-flow-diagrams)
8. [Security & Privacy](#8-security--privacy)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. System Overview

### 1.1 What Users See

**Creators:**
```
Create Snippet → Add Versions → Set Price → Publish
                     ↓
            Earn from usage across platform
```

**End Users:**
```
Describe Goal → Review Suggestions → Confirm → Pay via Nautilus
                                                      ↓
                                      Funds split to creators + platform
```

### 1.2 What Happens Behind the Scenes

```
User Prompt → [Private Composition Engine] → Snippet Selection
                                                    ↓
                                    Build Split Payment Transaction
                                                    ↓
                                    Ergo Blockchain (Attribution + Payment)
                                                    ↓
                                    Explorer Verification → Confirmation
```

---

## 2. Core Principles

### 2.1 Non-Custodial Design
- ✅ Users sign transactions with **Nautilus wallet**
- ✅ Platform **NEVER** stores private keys
- ✅ All payments processed on-chain
- ✅ Users control their funds at all times

### 2.2 Data Storage Philosophy

**On-Chain (Ergo Blockchain):**
- Attribution metadata (creator addresses)
- Content hashes (proof of version)
- Payment records (txId, amounts)
- Composition references (optional registers)

**Off-Chain (MySQL Database):**
- Snippet full text content
- User prompts and requests
- Composition selections
- Creator profiles
- Analytics and stats

**Why:** Blockchain storage is expensive; we store only what's needed for trust, attribution, and payment routing.

### 2.3 Value Protection Strategy

**Snippet Level:** Individual snippets are small, combinable units (low standalone value)

**Composition Level:** Value lies in:
1. **Selection Algorithm** (which snippets for which goal) - PRIVATE
2. **Ranking Logic** (priority, conflict resolution) - PRIVATE
3. **Assembly Pipeline** (how snippets combine) - PRIVATE
4. **Version Management** (updates, deprecations) - PLATFORM
5. **Quality Curation** (ratings, moderation) - PLATFORM

---

## 3. Architecture Layers

### 3.1 Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
├─────────────────────────────────────────────────────────┤
│  Next.js 14 (App Router) + TypeScript + Tailwind CSS   │
│  - Creator Dashboard                                     │
│  - User Composition Interface                           │
│  - Nautilus Wallet Connector                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                     │
├─────────────────────────────────────────────────────────┤
│  Next.js API Routes (Backend)                           │
│  - Creator Management (snippets, versions)              │
│  - Composition Engine (PRIVATE algorithm)               │
│  - Payment Intent Builder                               │
│  - Explorer Verification                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                      DATA LAYER                         │
├─────────────────────────────────────────────────────────┤
│  MySQL Database                                          │
│  - Creators & Snippets                                  │
│  - Requests & Compositions                              │
│  - Payments & Verification                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   BLOCKCHAIN LAYER                       │
├─────────────────────────────────────────────────────────┤
│  Ergo Blockchain (via Nautilus + Explorer API)          │
│  - Payment Transactions (multi-output splits)           │
│  - Attribution Records (optional NFT registry)          │
│  - Verification & Proof                                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Component Breakdown

#### Frontend Components
```
components/
├── WalletConnect.tsx          # Nautilus integration
├── SnippetCard.tsx            # Display snippet metadata
├── CompositionSummary.tsx     # Show selected snippets + totals
├── PayButton.tsx              # Trigger payment flow
├── CreatorDashboard/
│   ├── SnippetList.tsx
│   ├── CreateSnippetForm.tsx
│   ├── VersionManager.tsx
│   └── RevenueChart.tsx
└── UserDashboard/
    ├── RequestInput.tsx
    ├── CompositionProposal.tsx
    └── PaymentStatus.tsx
```

#### Backend Modules
```
lib/
├── db.ts                      # MySQL connection pool
├── config.ts                  # Environment configuration
├── hash.ts                    # Content hashing (SHA-256/Blake2b)
├── selector.ts                # Composition selection interface
│                              # (PRIVATE ALGORITHM - baseline for MVP)
├── ergo/
│   ├── nautilus.ts            # Wallet connector helpers
│   ├── payments.ts            # Split payment tx builder
│   └── types.ts               # Ergo type definitions
└── explorer.ts                # Transaction verification
```

---

## 4. Database Schema

### 4.1 Complete Schema

```sql
-- =====================================================
-- CREATORS & SNIPPETS
-- =====================================================

CREATE TABLE creators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  payout_address VARCHAR(255) NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payout_address (payout_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE snippets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  category ENUM('guardrail', 'format', 'tone', 'eval', 'tooling', 'context', 'other') NOT NULL,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id),
  INDEX idx_creator (creator_id),
  INDEX idx_status (status),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE snippet_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snippet_id INT NOT NULL,
  version INT NOT NULL,
  content LONGTEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (snippet_id) REFERENCES snippets(id),
  UNIQUE KEY unique_version (snippet_id, version),
  INDEX idx_content_hash (content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- USER REQUESTS & COMPOSITIONS
-- =====================================================

CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_address VARCHAR(255) NOT NULL,
  user_prompt LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_address (user_address),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE compositions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_address VARCHAR(255) NOT NULL,
  status ENUM('proposed', 'awaiting_payment', 'paid', 'failed') DEFAULT 'proposed',
  total_price_nanoerg BIGINT NOT NULL,
  platform_fee_nanoerg BIGINT NOT NULL,
  tx_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id),
  INDEX idx_user_address (user_address),
  INDEX idx_status (status),
  INDEX idx_tx_id (tx_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE composition_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  snippet_version_id INT NOT NULL,
  creator_payout_address VARCHAR(255) NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE,
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id),
  INDEX idx_composition (composition_id),
  INDEX idx_creator_address (creator_payout_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- PAYMENTS & VERIFICATION
-- =====================================================

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  tx_id VARCHAR(64) NOT NULL,
  status ENUM('submitted', 'confirmed', 'rejected') DEFAULT 'submitted',
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (composition_id) REFERENCES compositions(id),
  UNIQUE KEY unique_tx (tx_id),
  INDEX idx_composition (composition_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.2 Key Relationships

```
creators (1) ──────< (many) snippets
                              │
                              │ (1)
                              ↓
                         (many) snippet_versions

users (implicit) ──────> (many) requests
                              │
                              │ (1)
                              ↓
                         (many) compositions
                              │
                              │ (1)
                              ↓
                         (many) composition_items ──> snippet_versions
                              │
                              │ (1)
                              ↓
                         (many) payments
```

### 4.3 Data Flow Examples

**Creator Revenue Calculation:**
```sql
SELECT 
  c.display_name,
  c.payout_address,
  SUM(ci.price_nanoerg) as total_earned_nanoerg
FROM creators c
JOIN snippets s ON s.creator_id = c.id
JOIN snippet_versions sv ON sv.snippet_id = s.id
JOIN composition_items ci ON ci.snippet_version_id = sv.id
JOIN compositions comp ON comp.id = ci.composition_id
JOIN payments p ON p.composition_id = comp.id
WHERE p.status = 'confirmed'
GROUP BY c.id;
```

**User Composition History:**
```sql
SELECT 
  comp.id,
  comp.status,
  comp.total_price_nanoerg,
  comp.tx_id,
  COUNT(ci.id) as snippet_count
FROM compositions comp
LEFT JOIN composition_items ci ON ci.composition_id = comp.id
WHERE comp.user_address = ?
GROUP BY comp.id
ORDER BY comp.created_at DESC;
```

---

## 5. Transaction Structure

### 5.1 Payment Transaction Anatomy

```
┌─────────────────────────────────────────────────────────┐
│                   ERGO TRANSACTION                       │
└─────────────────────────────────────────────────────────┘

INPUTS:
┌────────────────────────────────────────────────────────┐
│ User's UTXO #1                                         │
│ ├─ BoxId: abc...                                       │
│ ├─ Value: 100,000,000 nanoERG                         │
│ └─ Address: User's address                             │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ User's UTXO #2                                         │
│ ├─ BoxId: def...                                       │
│ ├─ Value: 50,000,000 nanoERG                          │
│ └─ Address: User's address                             │
└────────────────────────────────────────────────────────┘

                    ↓ TRANSACTION ↓

OUTPUTS (Aggregated per recipient):

┌────────────────────────────────────────────────────────┐
│ OUTPUT 1: Platform Fee                                 │
│ ├─ Address: PLATFORM_ERGO_ADDRESS                      │
│ ├─ Value: 5,000,000 nanoERG (0.005 ERG)              │
│ └─ Registers (optional):                               │
│    └─ R4: compositionId (bytes)                        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ OUTPUT 2: Creator A Payout (AGGREGATED)               │
│ ├─ Address: Creator_A_Payout_Address                  │
│ ├─ Value: 30,000,000 nanoERG                          │
│ │   (sum of 3 snippets: 10M + 15M + 5M)               │
│ └─ Registers (optional):                               │
│    ├─ R4: compositionId                                │
│    └─ R5: snippet_version_ids (compressed)             │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ OUTPUT 3: Creator B Payout (AGGREGATED)               │
│ ├─ Address: Creator_B_Payout_Address                  │
│ ├─ Value: 20,000,000 nanoERG                          │
│ │   (sum of 2 snippets: 12M + 8M)                     │
│ └─ Registers (optional):                               │
│    ├─ R4: compositionId                                │
│    └─ R5: snippet_version_ids (compressed)             │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ OUTPUT 4: Change to User                               │
│ ├─ Address: User's address                             │
│ └─ Value: 94,000,000 nanoERG                          │
│    (150M - 5M - 30M - 20M - 1M fee)                   │
└────────────────────────────────────────────────────────┘

Transaction Fee: 1,000,000 nanoERG (0.001 ERG)
```

### 5.2 Aggregation Logic

**Problem:** If composition uses 10 snippets from 5 creators:
- ❌ Bad: Create 10 separate outputs (tx size explosion)
- ✅ Good: Create 5 aggregated outputs (one per creator)

**Implementation:**
```typescript
// Pseudocode for aggregation
const creatorPayouts = new Map<string, bigint>();

for (const item of composition_items) {
  const existing = creatorPayouts.get(item.creator_payout_address) || 0n;
  creatorPayouts.set(
    item.creator_payout_address, 
    existing + BigInt(item.price_nanoerg)
  );
}

// Build one output per unique creator address
for (const [address, amount] of creatorPayouts.entries()) {
  outputs.push({
    address,
    value: amount + MIN_BOX_VALUE,
    registers: {
      R4: compositionIdBytes,
      R5: relatedSnippetIdsBytes
    }
  });
}
```

### 5.3 Verification Requirements

When user submits `txId`, backend must verify:

1. **Transaction Exists:** Query explorer API
2. **Platform Output:** One output to `PLATFORM_ERGO_ADDRESS` with `>= platform_fee_nanoerg`
3. **Creator Outputs:** For each creator in composition:
   - Output to `creator_payout_address` exists
   - Amount `>= expected_aggregated_amount`
4. **Optional Register Check:** R4 contains `compositionId` (stronger proof)

**Verification Flow:**
```
User submits txId
        ↓
Backend queries: GET /api/v1/transactions/{txId}
        ↓
Parse outputs and registers
        ↓
Compare with expected composition_items
        ↓
If all checks pass:
  - Mark composition as 'paid'
  - Mark payment as 'confirmed'
  - Update creator earnings
Else:
  - Mark payment as 'rejected'
  - Notify user of issue
```

---

## 6. API Design

### 6.1 Authentication Strategy (MVP)

**Creator Auth:** Simple `X-Creator-Id` header
```typescript
// Middleware
function requireCreator(req) {
  const creatorId = req.headers['x-creator-id'];
  if (!creatorId || !isValidCreatorId(creatorId)) {
    throw new UnauthorizedError();
  }
  req.creatorId = creatorId;
}
```

**User Auth:** Wallet address from signed message (optional for MVP)
- For MVP: Trust client-provided address
- Production: Require wallet signature proof

### 6.2 API Endpoint Specification

#### 6.2.1 Creator Endpoints

**POST /api/creators/snippets**
```typescript
// Create new snippet
Request: {
  creatorId: number;      // from auth header
  title: string;
  summary: string;
  category: SnippetCategory;
}

Response: {
  snippetId: number;
  status: 'draft';
}
```

**POST /api/creators/snippets/:id/versions**
```typescript
// Add new version to snippet
Request: {
  content: string;        // actual snippet text
  price_nanoerg: bigint;  // price per use
}

Response: {
  versionId: number;
  version: number;        // auto-incremented
  content_hash: string;   // SHA-256 hex
}
```

**POST /api/creators/snippets/:id/publish**
```typescript
// Publish snippet (make available for selection)
Request: {} // empty body

Response: {
  snippetId: number;
  status: 'published';
}
```

**GET /api/creators/dashboard**
```typescript
// Creator earnings and stats
Response: {
  snippets: [{
    id: number;
    title: string;
    versions: number;
    total_uses: number;
    total_earned_nanoerg: bigint;
  }];
  total_earned_all_time: bigint;
  pending_confirmations: number;
}
```

#### 6.2.2 User Flow Endpoints

**POST /api/requests**
```typescript
// User describes their goal
Request: {
  userAddress: string;    // Ergo address
  userPrompt: string;     // goal description (max 10k chars)
}

Response: {
  requestId: number;
}
```

**POST /api/compositions/propose**
```typescript
// System proposes snippet selection
Request: {
  requestId: number;
}

Backend Logic:
  1. Load request.user_prompt
  2. Run selector.propose(user_prompt)
  3. Create composition + items
  4. Calculate totals

Response: {
  compositionId: number;
  items: [{
    snippetTitle: string;
    snippetSummary: string;
    creatorName: string;
    priceNanoerg: bigint;
    // NOTE: Full snippet content NOT exposed here
  }];
  totals: {
    snippetsTotal: bigint;
    platformFee: bigint;
    grandTotal: bigint;
  };
  status: 'proposed';
}
```

**POST /api/compositions/:id/lock**
```typescript
// User confirms selection, ready to pay
Request: {
  userAddress: string;    // must match composition.user_address
}

Backend Logic:
  1. Verify user owns this composition
  2. Set status = 'awaiting_payment'
  3. Build payment intent with aggregated payouts

Response: {
  paymentIntent: {
    platformOutput: {
      address: string;
      amount: bigint;
    };
    creatorOutputs: [{
      address: string;      // aggregated per creator
      amount: bigint;
      snippetCount: number;
    }];
    memo: string;           // compositionId
    totalRequired: bigint;
  };
}
```

**POST /api/compositions/:id/confirm**
```typescript
// User submits txId after Nautilus signing
Request: {
  txId: string;
}

Backend Logic:
  1. Query explorer: GET /api/v1/transactions/{txId}
  2. Verify outputs match paymentIntent
  3. If valid:
     - compositions.status = 'paid'
     - payments.status = 'confirmed'
  4. Else: payments.status = 'rejected'

Response: {
  ok: boolean;
  status: 'paid' | 'failed';
  verificationDetails: {
    platformOutputVerified: boolean;
    creatorOutputsVerified: boolean[];
    registersVerified: boolean;
  };
}
```

#### 6.2.3 Optional Future Endpoints

**POST /api/run** (Phase 2)
```typescript
// Execute composition (actual prompt assembly + LLM call)
Request: {
  compositionId: number;
  runtimeInputs: Record<string, any>;
}

Response: {
  result: string;         // LLM output
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

---

## 7. Flow Diagrams

### 7.1 Creator Flow

```
┌─────────────────────────────────────────────────────────┐
│                    CREATOR JOURNEY                       │
└─────────────────────────────────────────────────────────┘

1. REGISTRATION
   ├─ Creator signs up
   ├─ Provides payout address (Ergo)
   └─ Receives creator_id

2. SNIPPET CREATION
   ├─ POST /api/creators/snippets
   │  ├─ Title: "JSON Output Enforcer"
   │  ├─ Summary: "Forces structured JSON output"
   │  ├─ Category: "format"
   │  └─ Status: draft
   └─ Receives snippet_id

3. VERSION MANAGEMENT
   ├─ POST /api/creators/snippets/:id/versions
   │  ├─ Content: "You must output valid JSON..."
   │  ├─ Price: 10,000,000 nanoERG (0.01 ERG)
   │  └─ System computes content_hash
   └─ Receives version_id

4. PUBLISHING
   ├─ POST /api/creators/snippets/:id/publish
   └─ Status: published (now selectable)

5. EARNING
   ├─ System includes snippet in compositions
   ├─ Users pay → funds split to creator_address
   └─ Dashboard shows earnings

6. ITERATION
   ├─ Create new version (improved content)
   ├─ Adjust price
   └─ Publish updated version
```

### 7.2 User Flow

```
┌─────────────────────────────────────────────────────────┐
│                     USER JOURNEY                         │
└─────────────────────────────────────────────────────────┘

1. WALLET CONNECTION
   ├─ User visits platform
   ├─ Clicks "Connect Nautilus"
   └─ Grants dApp permission

2. GOAL DESCRIPTION
   ├─ User enters prompt:
   │  "I need a customer support chatbot that:
   │   - Stays professional
   │   - Outputs JSON
   │   - Handles escalations"
   └─ POST /api/requests → requestId

3. COMPOSITION PROPOSAL
   ├─ POST /api/compositions/propose
   ├─ Backend runs selection algorithm:
   │  ├─ Matches "professional" → tone snippets
   │  ├─ Matches "JSON" → format snippets
   │  ├─ Matches "escalations" → guardrail snippets
   │  └─ Resolves conflicts, ranks by relevance
   └─ Response shows:
      ├─ 5 selected snippets
      ├─ Creator names
      ├─ Individual prices
      └─ Total: 0.045 ERG

4. REVIEW & CONFIRMATION
   ├─ User reviews suggestions
   ├─ Sees why each was selected
   ├─ Clicks "Proceed to Payment"
   └─ POST /api/compositions/:id/lock

5. PAYMENT TRANSACTION
   ├─ Backend returns paymentIntent
   ├─ Frontend builds unsigned tx:
   │  ├─ Platform fee: 0.005 ERG
   │  ├─ Creator A: 0.025 ERG (3 snippets)
   │  ├─ Creator B: 0.020 ERG (2 snippets)
   │  └─ Tx fee: 0.001 ERG
   ├─ Nautilus signs transaction
   └─ Nautilus submits to blockchain

6. CONFIRMATION
   ├─ POST /api/compositions/:id/confirm
   ├─ Backend verifies via Explorer
   ├─ If valid:
   │  └─ Composition status: paid
   └─ User can now access assembled prompt

7. USAGE (Phase 2)
   ├─ POST /api/run
   └─ Backend assembles final prompt + executes
```

### 7.3 Payment Verification Flow

```
┌─────────────────────────────────────────────────────────┐
│              PAYMENT VERIFICATION LOGIC                  │
└─────────────────────────────────────────────────────────┘

User submits txId
       ↓
┌──────────────────────────────────┐
│ Query Ergo Explorer API          │
│ GET /api/v1/transactions/{txId}  │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Parse Transaction                │
│ - Extract outputs[]              │
│ - Extract registers              │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Verify Platform Output           │
│ Find output where:               │
│   address == PLATFORM_ADDRESS    │
│   value >= platform_fee          │
│   R4 == compositionId (opt)      │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Verify Creator Outputs           │
│ For each creator in composition: │
│   Find output where:             │
│     address == creator_address   │
│     value >= expected_amount     │
│   Mark verified: true/false      │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ All Checks Passed?               │
└──────────────────────────────────┘
       ↓                  ↓
     YES                 NO
       ↓                  ↓
   ┌───────┐        ┌─────────┐
   │ PAID  │        │ FAILED  │
   └───────┘        └─────────┘
       ↓                  ↓
Update Database:    Notify User:
- composition       "Payment
  status=paid       verification
- payment           failed"
  status=confirmed
- creator earnings
  updated
```

---

## 8. Security & Privacy

### 8.1 What Remains Private

**Composition Algorithm (Business Secret):**
- ❌ NOT exposed: Ranking scores, weights, heuristics
- ❌ NOT exposed: Conflict resolution rules
- ❌ NOT exposed: Category matching logic
- ✅ Exposed: Selected snippets (title, summary, price)
- ✅ Exposed: Final composition result (after payment)

**Snippet Content (Until Paid):**
- ❌ NOT exposed: Full snippet text before payment
- ✅ Exposed: Metadata (title, summary, category, price)
- ✅ Exposed: Content hash (for verification)

**User Prompts:**
- ❌ NOT publicly exposed: User's goal descriptions
- ✅ Stored: In database for composition history
- ✅ Used: By selection algorithm server-side

### 8.2 Attack Vectors & Mitigations

#### 8.2.1 Payment Manipulation
**Attack:** User modifies transaction to pay less
**Mitigation:** 
- Backend verifies exact amounts via Explorer
- Rejects if any output < expected amount

#### 8.2.2 Composition Replay
**Attack:** User pays once, claims multiple times
**Mitigation:**
- TxId stored in database (unique constraint)
- Second confirm attempt with same txId rejected

#### 8.2.3 Creator Impersonation
**Attack:** Fake creator steals snippet content
**Mitigation (Phase 2):**
- Optional on-chain snippet registry (NFT)
- Content hash signed by creator address

#### 8.2.4 Algorithm Reverse Engineering
**Attack:** Scrape enough compositions to infer selection logic
**Mitigation:**
- Never expose scores or detailed reasoning
- Limit API rate (prevent mass scraping)
- Add noise/randomization to selection

#### 8.2.5 Front-Running
**Attack:** Observer sees composition, creates competing one
**Mitigation:**
- Composition locked to user_address
- Payment must come from same address
- Optional: Time-limited locks

### 8.3 Privacy Considerations

**GDPR/Privacy:**
- User addresses are pseudonymous (not PII)
- User prompts stored, but not publicly exposed
- Creator profiles optional (display_name not required to be real)

**Data Retention:**
- Compositions: Keep indefinitely (payment proofs)
- User prompts: Optional deletion after X days
- Transaction data: Immutable on blockchain

---

## 9. Implementation Phases

### 9.1 MVP (Phase 1) - 2-3 Weeks

**Goal:** Prove core mechanics work

**Deliverables:**
- ✅ Creator can upload snippets with versions
- ✅ User can describe goal and see composition
- ✅ Payment transaction builds and submits
- ✅ Backend verifies payment via Explorer
- ✅ Basic dashboards (creator earnings, user history)

**Baseline Selector:**
```typescript
// Simple keyword matching for MVP
function proposeComposition(userPrompt: string) {
  // 1. Extract keywords from prompt
  // 2. Match against snippet titles/summaries
  // 3. Return top N by relevance + price
  // 4. Limit to 5-10 snippets max
}
```

**Auth:** Simple `X-Creator-Id` header (no real auth yet)

**Scope Cuts:**
- No run/execution service
- No snippet ratings/stats
- No on-chain registry (DB only)

### 9.2 Phase 2 - Advanced Selection

**Goal:** Improve composition quality

**Features:**
- Sophisticated NLP-based selection
- Conflict detection (e.g., "strict_json" vs "freeform_text")
- Category weights and priorities
- Creator reputation scores
- A/B testing framework

**Deliverables:**
- Enhanced selector module (still private)
- Analytics on selection performance
- User feedback loop

### 9.3 Phase 3 - Execution Service

**Goal:** Users run compositions directly

**Features:**
- `POST /api/run` endpoint
- Server-side prompt assembly
- LLM gateway integration
- Usage tracking and quotas

**Why Later?**
- MVP focuses on monetization mechanism
- Run service requires infrastructure (LLM API keys, rate limiting)
- Composition value proven before execution added

### 9.4 Phase 4 - Trust Layer

**Goal:** On-chain snippet registry

**Features:**
- NFT minting for snippet versions
- Content hash stored in registers
- Creator signatures
- Explorer-verifiable provenance

**Transaction Structure:**
```
Snippet Registry TX:
  Output: NFT Box
    - TokenId: unique per snippet version
    - R4: content_hash
    - R5: snippet_id + version
    - R6: creator_payout_address
```

### 9.5 Phase 5 - Marketplace Features

**Goal:** Community and discovery

**Features:**
- Public snippet marketplace
- Search and filters
- Ratings and reviews
- Featured/trending snippets
- Creator profiles and portfolios

---

## 10. Configuration Reference

### 10.1 Environment Variables

```bash
# Database
DATABASE_URL=mysql://user:pass@host:3306/promptpage
# Or individual vars:
DB_HOST=localhost
DB_USER=promptpage
DB_PASS=secure_password
DB_NAME=promptpage

# Ergo Platform
ERGO_NETWORK=testnet                        # or mainnet
PLATFORM_ERGO_ADDRESS=9f...                 # Platform payout address
PLATFORM_FEE_NANOERG=5000000                # 0.005 ERG
MIN_OUTPUT_VALUE_NANOERG=1000000            # 0.001 ERG box minimum
ERGO_EXPLORER_API=https://api-testnet.ergoplatform.com

# Limits
MAX_SNIPPETS_PER_COMPOSITION=20
MAX_PROMPT_LENGTH=10000
MAX_SNIPPET_CONTENT_LENGTH=50000

# Application
APP_BASE_URL=http://localhost:3000
NODE_ENV=development
```

### 10.2 Constants

```typescript
// lib/config.ts
export const ERGO = {
  NANOERG_PER_ERG: 1_000_000_000,
  MIN_BOX_VALUE: 1_000_000,        // 0.001 ERG
  TX_FEE: 1_000_000,                // 0.001 ERG
} as const;

export const LIMITS = {
  MAX_SNIPPETS_PER_COMPOSITION: 20,
  MAX_OUTPUTS_PER_TX: 100,
  MAX_PROMPT_LENGTH: 10_000,
  MAX_SNIPPET_CONTENT: 50_000,
} as const;

export const CATEGORIES = [
  'guardrail',
  'format',
  'tone',
  'eval',
  'tooling',
  'context',
  'other',
] as const;
```

---

## 11. File Structure

```
promptpage/
├── app/
│   ├── page.tsx                          # Landing / User flow
│   ├── creator/
│   │   └── page.tsx                      # Creator dashboard
│   ├── p/
│   │   └── [compositionId]/
│   │       └── page.tsx                  # Composition detail + pay
│   └── api/
│       ├── requests/
│       │   └── route.ts                  # POST /api/requests
│       ├── compositions/
│       │   ├── propose/
│       │   │   └── route.ts              # POST /api/compositions/propose
│       │   └── [id]/
│       │       ├── lock/
│       │       │   └── route.ts          # POST /api/compositions/:id/lock
│       │       └── confirm/
│       │           └── route.ts          # POST /api/compositions/:id/confirm
│       └── creators/
│           ├── snippets/
│           │   └── route.ts              # POST /api/creators/snippets
│           └── [id]/
│               ├── versions/
│               │   └── route.ts          # POST versions
│               └── publish/
│                   └── route.ts          # POST publish
├── lib/
│   ├── db.ts                             # MySQL pool
│   ├── schema.sql                        # Database migrations
│   ├── config.ts                         # Configuration
│   ├── hash.ts                           # Content hashing
│   ├── selector.ts                       # Composition algorithm (PRIVATE)
│   ├── ergo/
│   │   ├── nautilus.ts                   # Wallet connector
│   │   ├── payments.ts                   # Split TX builder
│   │   └── types.ts                      # Ergo types
│   └── explorer.ts                       # TX verification
├── components/
│   ├── WalletConnect.tsx
│   ├── SnippetCard.tsx
│   ├── CompositionSummary.tsx
│   └── PayButton.tsx
├── .env.example
├── README.md
└── package.json
```

---

## 12. Key Differences from Simple Prompt-NFT Model

| Aspect | Simple Model (Previous) | Modular Marketplace (New) |
|--------|------------------------|---------------------------|
| **Users** | Single creator per prompt | Multiple creators per composition |
| **Payment** | Single service fee | Split payment to N creators + platform |
| **Content** | Full prompt text | Modular snippets assembled |
| **Monetization** | One-time mint fee | Per-use snippet licensing |
| **Ownership** | NFT proves prompt ownership | Payment proves usage rights |
| **Value** | Individual prompts | Composition algorithm + curation |
| **Complexity** | Simple 1-output tx | Multi-output aggregated tx |
| **Verification** | Optional | Required (multiple payouts) |

---

## 13. Success Metrics

### 13.1 MVP Success Criteria

- ✅ 10+ creators upload snippets
- ✅ 100+ snippet versions published
- ✅ 50+ compositions paid
- ✅ Payment verification: 99%+ accuracy
- ✅ Transaction success rate: >95%
- ✅ Average composition uses 5-8 snippets
- ✅ Creator earnings distributed correctly

### 13.2 Phase 2+ Metrics

- Composition quality scores (user feedback)
- Snippet reuse frequency
- Creator retention rate
- Average revenue per snippet
- Time from request to payment
- Platform fee revenue vs. creator payouts

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Snippet** | Reusable prompt engineering module created by a creator |
| **Version** | Specific iteration of a snippet with content hash and price |
| **Composition** | Selected collection of snippets for a user's goal |
| **Request** | User's description of what they want to achieve |
| **Payment Intent** | Pre-computed breakdown of who gets paid how much |
| **Aggregation** | Combining multiple snippet prices per creator into one output |
| **Selector** | Private algorithm that proposes snippet combinations |
| **Lock** | Freezing composition before payment (status: awaiting_payment) |
| **Confirmation** | Backend verification that payment tx is valid |

---

## Appendix B: Example Scenario

**Scenario:** User wants a "professional customer support chatbot"

**Step-by-Step:**

1. **User Input:**
   ```
   "Create a customer support chatbot that:
   - Responds professionally
   - Handles complaints gracefully
   - Escalates to human when needed
   - Always outputs valid JSON"
   ```

2. **System Selection (Private):**
   ```typescript
   Algorithm matches:
   - "professional" → Snippet #12 (Tone: Professional)
   - "complaints" → Snippet #47 (Guardrail: Complaint Handler)
   - "escalates" → Snippet #89 (Logic: Escalation Rules)
   - "JSON" → Snippet #3 (Format: JSON Output Enforcer)
   - Base: Snippet #1 (Context: Customer Support Base)
   ```

3. **Composition Proposed:**
   ```
   5 snippets selected:
   - Snippet #1 by Creator A: 0.010 ERG
   - Snippet #3 by Creator B: 0.008 ERG
   - Snippet #12 by Creator A: 0.012 ERG
   - Snippet #47 by Creator C: 0.015 ERG
   - Snippet #89 by Creator A: 0.010 ERG
   
   Total: 0.055 ERG
   Platform fee: 0.005 ERG
   Grand total: 0.060 ERG
   ```

4. **Payment Transaction:**
   ```
   Inputs: User's UTXOs (0.070 ERG available)
   
   Outputs:
   - Platform: 0.005 ERG
   - Creator A: 0.032 ERG (3 snippets aggregated)
   - Creator B: 0.008 ERG (1 snippet)
   - Creator C: 0.015 ERG (1 snippet)
   - Change to user: 0.009 ERG
   
   Fee: 0.001 ERG
   ```

5. **Verification:**
   ```
   Explorer confirms:
   ✅ Platform received 0.005 ERG
   ✅ Creator A received 0.032 ERG
   ✅ Creator B received 0.008 ERG
   ✅ Creator C received 0.015 ERG
   
   Composition marked PAID
   ```

6. **Result:**
   - User can now access assembled prompt
   - Creators see earnings in dashboard
   - Platform collects fee

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-02  
**Status:** Implementation Ready  
**Next Review:** After MVP completion

