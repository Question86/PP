# PromptPage Database Architecture & Workflow

**Repository**: https://github.com/Question86/PP  
**Schema File**: [db/schema_v2.sql](https://github.com/Question86/PP/blob/main/db/schema_v2.sql)  
**Date**: January 3, 2026

---

## Database Overview

**Database**: `promptpage`  
**Charset**: utf8mb4_unicode_ci  
**Engine**: InnoDB (MySQL 8.0+)

---

## Table Structure

### 1. **creators** - Snippet Authors
Stores information about snippet creators (the people who write prompt modules).

```sql
CREATE TABLE creators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  payout_address VARCHAR(255) NOT NULL,        -- Ergo blockchain address
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_payout (payout_address)
);
```

**Purpose**: Identity and payment routing for snippet creators.

---

### 2. **snippets** - Prompt Module Metadata
Contains searchable metadata about each prompt snippet (NOT the actual content).

```sql
CREATE TABLE snippets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,                 -- "Professional Tone Enforcer"
  summary TEXT,                                 -- "Ensures formal communication..."
  category ENUM('guardrail', 'format', 'tone', 'eval', 'tooling', 'context', 'other'),
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id)
);
```

**Purpose**: Searchable/browsable snippet catalog. Selection algorithm matches against `title`, `summary`, `category`.

**Key Point**: Content is NOT stored here - only metadata for discovery.

---

### 3. **snippet_versions** - Actual Prompt Content
Stores the actual prompt text with versioning support.

```sql
CREATE TABLE snippet_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snippet_id INT NOT NULL,
  version INT NOT NULL,
  content LONGTEXT NOT NULL,                   -- THE ACTUAL PROMPT TEXT
  content_hash VARCHAR(64) NOT NULL,           -- SHA-256 hash for integrity
  price_nanoerg BIGINT NOT NULL,               -- Price in nanoERG (1 ERG = 10^9 nanoERG)
  created_at TIMESTAMP,
  FOREIGN KEY (snippet_id) REFERENCES snippets(id),
  UNIQUE KEY unique_version (snippet_id, version)
);
```

**Purpose**: Stores the full prompt instructions. Delivered to user ONLY after payment confirmed.

**Key Point**: Multiple versions allow creators to update content while maintaining pricing history.

---

### 4. **requests** - User Search Queries
Logs what users are looking for.

```sql
CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_address VARCHAR(255) NOT NULL,          -- User's Ergo wallet address
  user_prompt LONGTEXT NOT NULL,               -- "I need a customer service chatbot..."
  created_at TIMESTAMP
);
```

**Purpose**: Audit trail of user requests. Used by AI agent to match snippets.

---

### 5. **compositions** - Selected Snippet Bundles
Represents a user's "shopping cart" of selected snippets.

```sql
CREATE TABLE compositions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_address VARCHAR(255) NOT NULL,
  status ENUM('proposed', 'awaiting_payment', 'paid', 'failed'),
  total_price_nanoerg BIGINT NOT NULL,         -- Sum of all snippets + platform fee
  platform_fee_nanoerg BIGINT NOT NULL,        -- PromptPage platform cut
  tx_id VARCHAR(64) NULL,                      -- Ergo blockchain transaction ID
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id)
);
```

**Purpose**: Tracks payment lifecycle. Status transitions:
- `proposed` → AI suggests snippets
- `awaiting_payment` → User locked composition, payment intent created
- `paid` → Payment verified on blockchain
- `failed` → Payment verification failed

**Key Point**: `user_address` used for IDOR prevention (ownership verification).

---

### 6. **composition_items** - Individual Snippets in Bundle
Links snippets to compositions with pricing and creator payout info.

```sql
CREATE TABLE composition_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  snippet_version_id INT NOT NULL,             -- Links to snippet_versions.id
  creator_payout_address VARCHAR(255) NOT NULL,
  price_nanoerg BIGINT NOT NULL,               -- Price for THIS snippet
  position INT NOT NULL DEFAULT 0,             -- Display order
  FOREIGN KEY (composition_id) REFERENCES compositions(id),
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id)
);
```

**Purpose**: Junction table for many-to-many relationship. Used to:
1. Calculate total payment (sum of all items)
2. Generate blockchain transaction outputs (one per creator)
3. Build R4 commitment hash for payment verification

---

### 7. **payments** - Payment Verification Records
Tracks blockchain transaction verification.

```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  tx_id VARCHAR(64) NOT NULL,                  -- Blockchain transaction ID
  status ENUM('submitted', 'confirmed', 'rejected'),
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  FOREIGN KEY (composition_id) REFERENCES compositions(id),
  UNIQUE KEY unique_tx (tx_id)
);
```

**Purpose**: Audit trail of payment verification attempts. Prevents duplicate confirmations via `UNIQUE KEY unique_tx`.

---

### 8. **snippet_usage_stats** (Phase 2 - Analytics)
Tracks snippet popularity and earnings.

```sql
CREATE TABLE snippet_usage_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snippet_version_id INT NOT NULL,
  usage_count INT DEFAULT 0,
  total_earned_nanoerg BIGINT DEFAULT 0,
  last_used_at TIMESTAMP NULL,
  updated_at TIMESTAMP,
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id)
);
```

**Purpose**: Future analytics for creators to see performance metrics.

---

## Complete User Workflow

### Step 1: User Arrives & Submits Request

**User Action**: Opens site, describes what they need  
**Input**: "I need a professional customer service chatbot that outputs JSON"

**Database Operations**:
```sql
-- API: POST /api/requests
INSERT INTO requests (user_address, user_prompt) 
VALUES ('9f...abc123', 'I need a professional customer service chatbot...');
-- Returns: requestId = 42
```

**Tables Updated**: `requests`

---

### Step 2: AI Suggests Snippets

**Backend Action**: AI agent reads published snippets and matches to request

**Database Operations**:
```sql
-- API: GET /api/snippets
SELECT 
  s.id,
  s.title,
  s.summary,
  s.category,
  c.display_name AS creator_name,
  sv.price_nanoerg
FROM snippets s
JOIN creators c ON s.creator_id = c.id
JOIN snippet_versions sv ON sv.snippet_id = s.id
WHERE s.status = 'published'
  AND sv.version = (SELECT MAX(version) FROM snippet_versions WHERE snippet_id = s.id);

-- Returns list like:
-- [
--   {title: "Professional Tone", summary: "...", category: "tone", price: "10000000"},
--   {title: "JSON Output Enforcer", summary: "...", category: "format", price: "8000000"}
-- ]
```

**AI Logic**: Matches `user_prompt` against `title + summary + category`

**Tables Read**: `snippets`, `creators`, `snippet_versions` (metadata only, NOT content)

---

### Step 3: Create Composition (Proposed Bundle)

**Backend Action**: AI creates composition with selected snippets

**Database Operations**:
```sql
-- API: POST /api/compositions/propose
-- Step 1: Create composition
INSERT INTO compositions (request_id, user_address, status, total_price_nanoerg, platform_fee_nanoerg)
VALUES (42, '9f...abc123', 'proposed', 20000000, 2000000);
-- Returns: compositionId = 7

-- Step 2: Add selected snippets to composition
INSERT INTO composition_items (composition_id, snippet_version_id, creator_payout_address, price_nanoerg, position)
VALUES 
  (7, 15, '9f...creator1', 10000000, 1),  -- Professional Tone snippet
  (7, 23, '9f...creator2', 8000000, 2);   -- JSON Output snippet

-- Step 3: Show to user
SELECT 
  s.title, s.summary, c.display_name, ci.price_nanoerg
FROM composition_items ci
JOIN snippet_versions sv ON ci.snippet_version_id = sv.id
JOIN snippets s ON sv.snippet_id = s.id
JOIN creators c ON s.creator_id = c.id
WHERE ci.composition_id = 7;
```

**User Sees**: List of snippets with prices, total cost, "Proceed to Payment" button

**Tables Updated**: `compositions`, `composition_items`

---

### Step 4: Lock Composition & Generate Payment Intent

**User Action**: Clicks "Pay Now"

**Database Operations**:
```sql
-- API: POST /api/compositions/7/lock
-- Update composition status
UPDATE compositions 
SET status = 'awaiting_payment' 
WHERE id = 7 AND user_address = '9f...abc123';  -- IDOR prevention

-- Generate payment intent (blockchain transaction structure)
SELECT 
  ci.creator_payout_address,
  SUM(ci.price_nanoerg) AS amount,
  COUNT(*) AS snippet_count,
  JSON_ARRAYAGG(ci.snippet_version_id) AS snippet_ids
FROM composition_items ci
WHERE ci.composition_id = 7
GROUP BY ci.creator_payout_address;
```

**Backend Creates**:
1. **Platform output**: `{address: PLATFORM_ADDRESS, amount: platform_fee_nanoerg}`
2. **Creator outputs**: One per creator with summed amounts
3. **R4 Commitment Hash**: Blake2b-256 hash of canonical payment structure
   - Format: `v1|7|20000000|9f...creator1:10000000,9f...creator2:8000000`
   - Hash stored in transaction output R4 register

**Implementation**: [src/lib/payments.ts](https://github.com/Question86/PP/blob/main/src/lib/payments.ts)

**User Sees**: Payment modal with transaction details + R4 commitment hash

**Tables Updated**: `compositions` (status → awaiting_payment)

---

### Step 5: User Submits Blockchain Transaction

**User Action**: Wallet (Nautilus) signs and broadcasts transaction

**Blockchain Action**: Transaction includes:
- Inputs: User's UTXOs
- Outputs: 
  - Platform output with R4 register = commitment hash
  - Creator outputs (one per creator)
- Transaction gets mined into blockchain

**No Database Operations Yet**: Waiting for user to confirm transaction was sent

---

### Step 6: User Confirms Transaction ID

**User Action**: Submits transaction ID via UI

**Database Operations**:
```sql
-- API: POST /api/compositions/7/confirm
-- Step 1: Verify ownership (IDOR prevention)
SELECT user_address, status FROM compositions WHERE id = 7;
-- Must match: composition.user_address === request.userAddress

-- Step 2: Log payment submission
INSERT INTO payments (composition_id, tx_id, status)
VALUES (7, '64-char-hex-transaction-id', 'submitted');

-- Step 3: Query blockchain explorer to verify transaction
-- Backend calls: https://api.ergoplatform.com/api/v1/transactions/unconfirmed/{txId}
```

**Backend Verification** ([src/lib/explorer.ts](https://github.com/Question86/PP/blob/main/src/lib/explorer.ts)):
1. Fetch transaction from blockchain
2. Find outputs matching expected addresses
3. **Verify R4 register**: Extract R4 from platform output, compare to expected commitment hash
4. Sum amounts per address (UTXO-safe: multiple outputs to same address are valid)
5. Verify totals match composition_items pricing

**If Verification Passes**:
```sql
UPDATE compositions SET status = 'paid', tx_id = '64-char...' WHERE id = 7;
UPDATE payments SET status = 'confirmed', confirmed_at = NOW() WHERE tx_id = '64-char...';
```

**If Verification Fails**:
```sql
UPDATE payments SET status = 'rejected' WHERE tx_id = '64-char...';
-- Composition remains 'awaiting_payment', user can retry
```

**Security Features**:
- **IDOR Prevention**: Ownership check ensures only composition owner can confirm
- **SQL Injection Prevention**: Parameterized queries in composition_items insert
- **R4 Commitment**: Prevents payment tampering (user can't pay wrong amounts)

**Tables Updated**: `compositions`, `payments`

---

### Step 7: Deliver Full Prompt Content

**User Action**: After payment confirmed, clicks "View Content"

**Database Operations**:
```sql
-- API: GET /api/compositions/7/content
-- Step 1: Verify payment status
SELECT status FROM compositions WHERE id = 7 AND user_address = '9f...abc123';
-- Must be: status = 'paid'

-- Step 2: Fetch full snippet content
SELECT 
  s.title,
  sv.content,     -- THE ACTUAL PROMPT TEXT (only accessible after payment)
  s.category,
  ci.position
FROM composition_items ci
JOIN snippet_versions sv ON ci.snippet_version_id = sv.id
JOIN snippets s ON sv.snippet_id = s.id
WHERE ci.composition_id = 7
ORDER BY ci.position;

-- Returns:
-- [
--   {title: "Professional Tone", content: "You must maintain a professional, formal tone in all responses. Avoid slang, emojis, and casual language. Address users with respect...", ...},
--   {title: "JSON Output Enforcer", content: "You must output valid JSON only. Never include explanatory text outside the JSON structure. Format: {...}", ...}
-- ]
```

**User Sees**: Full prompt text they can copy/paste into their AI system

**Tables Read**: `compositions`, `composition_items`, `snippet_versions`, `snippets`

---

## Key Data Flows

### Metadata Flow (Public - No Payment)
```
snippets.title + snippets.summary + snippets.category
  ↓
User browses/searches
  ↓
AI matches to user_prompt
  ↓
composition_items created (references snippet_version_id)
```

### Content Flow (Protected - After Payment)
```
snippet_versions.content (LONGTEXT)
  ↓
LOCKED until compositions.status = 'paid'
  ↓
Delivered via /api/compositions/[id]/content
```

### Payment Flow (Blockchain → Database)
```
composition_items → Calculate totals
  ↓
Generate R4 commitment hash
  ↓
User pays on blockchain (tx includes R4)
  ↓
Verify R4 matches + amounts correct
  ↓
Update compositions.status = 'paid'
  ↓
Unlock snippet_versions.content
```

---

## Critical Implementation Files

| Component | File | Purpose |
|-----------|------|---------|
| Schema | [db/schema_v2.sql](https://github.com/Question86/PP/blob/main/db/schema_v2.sql) | All table definitions |
| R4 Protocol | [src/lib/payments.ts](https://github.com/Question86/PP/blob/main/src/lib/payments.ts) | Commitment hash generation |
| Verification | [src/lib/explorer.ts](https://github.com/Question86/PP/blob/main/src/lib/explorer.ts) | Blockchain payment verification |
| DB Queries | [src/lib/db-compositions.ts](https://github.com/Question86/PP/blob/main/src/lib/db-compositions.ts) | Composition CRUD operations |
| Snippets API | [src/app/api/snippets/route.ts](https://github.com/Question86/PP/blob/main/src/app/api/snippets/route.ts) | List published snippets |
| Lock API | [src/app/api/compositions/[id]/lock/route.ts](https://github.com/Question86/PP/blob/main/src/app/api/compositions/[id]/lock/route.ts) | Generate payment intent |
| Confirm API | [src/app/api/compositions/[id]/confirm/route.ts](https://github.com/Question86/PP/blob/main/src/app/api/compositions/[id]/confirm/route.ts) | Verify blockchain payment |
| Content API | [src/app/api/compositions/[id]/content/route.ts](https://github.com/Question86/PP/blob/main/src/app/api/compositions/[id]/content/route.ts) | Deliver snippet content |

---

## Security Features

### 1. IDOR Prevention (Insecure Direct Object Reference)
**Location**: [src/app/api/compositions/[id]/confirm/route.ts](https://github.com/Question86/PP/blob/main/src/app/api/compositions/[id]/confirm/route.ts)

```typescript
// User can only confirm compositions they own
if (composition.user_address.toLowerCase() !== body.userAddress.toLowerCase()) {
  return NextResponse.json({ error: 'Forbidden: Not your composition' }, { status: 403 });
}
```

### 2. SQL Injection Prevention
**Location**: [src/lib/db-compositions.ts](https://github.com/Question86/PP/blob/main/src/lib/db-compositions.ts)

```typescript
// Parameterized queries prevent SQL injection
const placeholders = items.map(() => '(?, ?, ?, ?, ?)').join(', ');
const flatValues: any[] = [];
items.forEach(item => {
  flatValues.push(
    item.composition_id,
    item.snippet_version_id,
    item.creator_payout_address,
    item.price_nanoerg,
    item.position
  );
});
await pool.execute(`INSERT INTO composition_items (...) VALUES ${placeholders}`, flatValues);
```

### 3. R4 Commitment Hash
**Location**: [src/lib/payments.ts](https://github.com/Question86/PP/blob/main/src/lib/payments.ts)

Prevents payment tampering by storing a cryptographic hash in the blockchain transaction:
- **Canonical Format**: `v1|compositionId|totalNanoErg|creator1:amount1,creator2:amount2`
- **Hash Algorithm**: Blake2b-256 (32 bytes)
- **Verification**: Backend recalculates expected hash, compares to R4 register in transaction

---

## Database Indexes

Performance-critical indexes:

```sql
-- Fast snippet browsing
INDEX idx_status_category ON snippets(status, category);

-- User's composition lookup
INDEX idx_user_status ON compositions(user_address, status);

-- Payment verification
UNIQUE KEY unique_tx ON payments(tx_id);

-- Composition items retrieval
INDEX idx_composition ON composition_items(composition_id);
```

---

## State Machine: Composition Lifecycle

```
┌─────────────┐
│  proposed   │ ← AI creates composition with selected snippets
└──────┬──────┘
       │ POST /api/compositions/[id]/lock
       ↓
┌─────────────────┐
│ awaiting_payment│ ← User locks composition, payment intent generated
└──────┬──────────┘
       │ POST /api/compositions/[id]/confirm (with txId)
       ↓
    ┌──┴──┐
    ↓     ↓
┌────┐  ┌────────┐
│paid│  │ failed │ ← Blockchain verification result
└────┘  └────────┘
   │
   ↓ GET /api/compositions/[id]/content
┌──────────────┐
│Content Delivered│
└──────────────┘
```

---

## Current Status (January 3, 2026)

✅ **Implemented**:
- Complete database schema with all tables
- R4 commitment protocol for payment verification
- Full payment flow (lock → pay → confirm → deliver)
- Security fixes (SQL injection, IDOR prevention)
- UI for browse/pay/success pages

✅ **Tested**:
- TypeScript compilation (0 errors)
- Next.js build (13 routes)
- Git pushed to main branch (3 commits)

⏳ **Pending**:
- User testing with real Ergo blockchain transactions
- Analytics implementation (snippet_usage_stats)
- Creator dashboard for performance metrics

---

## For External AI Assistants

**Quick Reference**:
- **Snippet metadata** = `snippets` table (title, summary, category)
- **Snippet content** = `snippet_versions` table (content column)
- **User's cart** = `compositions` + `composition_items` tables
- **Payment verification** = Check `compositions.status = 'paid'`
- **Content delivery** = Only if status = 'paid', fetch from `snippet_versions.content`

**Key Relationships**:
```
creators (1) ──→ (N) snippets
snippets (1) ──→ (N) snippet_versions
compositions (1) ──→ (N) composition_items
composition_items (N) ──→ (1) snippet_versions
```

**GitHub Repo**: https://github.com/Question86/PP
