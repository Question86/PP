================================================================================
E2E TEST GAP ANALYSIS - CREATOR & CUSTOMER UI FLOW
================================================================================

**Repository**: https://github.com/Question86/PP  
**Date**: January 3, 2026  
**Context**: Full UI-based testnet workflow for User1 (Creator) and User2 (Customer)

================================================================================
1. MISSING DATABASE FIELDS/TABLES
================================================================================

✅ **VERDICT: NO DATABASE CHANGES NEEDED**

All required tables exist:
- `creators` - ✅ Has display_name, payout_address, bio
- `snippets` - ✅ Has title, summary, category, status
- `snippet_versions` - ✅ Has content, price_nanoerg, content_hash
- `compositions` - ✅ Has user_address, status, tx_id
- `composition_items` - ✅ Has creator_payout_address, price_nanoerg
- `payments` - ✅ Has tx_id, status, confirmed_at

**Optional Enhancement (NOT blocking)**:
- Add `creators.wallet_connected` BOOLEAN to track online status
- Add `snippets.view_count` INT for analytics

================================================================================
2. MISSING API ENDPOINTS
================================================================================

### 2.1 Creator Registration (HIGH PRIORITY - BLOCKING)

**Missing**: `POST /api/creators`  
**Status**: Database function exists (`createCreator`), endpoint MISSING  
**Required For**: User1 to register as creator

**Implementation Needed**:
```typescript
// FILE: src/app/api/creators/route.ts (ADD POST handler)
export async function POST(request: NextRequest) {
  const body: { displayName: string; payoutAddress: string; bio?: string } = await request.json();
  
  // Validation
  if (!body.displayName || body.displayName.trim().length === 0) {
    return NextResponse.json({ error: 'Display name required' }, { status: 400 });
  }
  
  if (!body.payoutAddress || body.payoutAddress.length < 40) {
    return NextResponse.json({ error: 'Invalid Ergo address' }, { status: 400 });
  }
  
  // Check if already exists
  const existing = await getCreatorByPayoutAddress(body.payoutAddress);
  if (existing) {
    return NextResponse.json({ creatorId: existing.id, message: 'Already registered' });
  }
  
  // Create
  const creatorId = await createCreator({
    display_name: body.displayName.trim(),
    payout_address: body.payoutAddress,
    bio: body.bio?.trim(),
  });
  
  return NextResponse.json({ creatorId, status: 'created' });
}
```

**Auth/Ownership**: None for registration (public endpoint)

---

### 2.2 Creator Dashboard Data (MEDIUM PRIORITY - UX)

**Missing**: `GET /api/creators/me?payoutAddress=9f...`  
**Status**: Database function exists (`getCreatorByPayoutAddress`), endpoint MISSING  
**Required For**: User1 to see their snippets and earnings

**Implementation Needed**:
```typescript
// FILE: src/app/api/creators/me/route.ts (NEW)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const payoutAddress = searchParams.get('payoutAddress');
  
  if (!payoutAddress) {
    return NextResponse.json({ error: 'payoutAddress required' }, { status: 400 });
  }
  
  const creator = await getCreatorByPayoutAddress(payoutAddress);
  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }
  
  // Get creator's snippets
  const snippets = await getSnippetsByCreator(creator.id);
  
  // Get earnings
  const earnings = await getCreatorEarnings(creator.id);
  
  return NextResponse.json({
    creator,
    snippets,
    earnings,
  });
}
```

**Auth/Ownership**: None (public read, filtered by address)

---

### 2.3 List Creator's Snippets (LOW PRIORITY - Can use existing)

**Existing**: Database function `getSnippetsByCreator(creatorId)` exists  
**Status**: ✅ Can be called from dashboard endpoint above  
**Alternative**: Add `GET /api/creators/[id]/snippets` if needed

---

### 2.4 Customer Content Unlocking (ALREADY EXISTS)

✅ **Status**: COMPLETE  
**Endpoint**: `GET /api/compositions/[id]/content`  
**Validation**: Checks `compositions.status = 'paid'` and ownership

================================================================================
3. MISSING UI PAGES/COMPONENTS
================================================================================

### 3.1 Creator Registration Page (HIGH PRIORITY - BLOCKING)

**Missing**: `src/app/creator/register/page.tsx`  
**Required For**: User1 to create creator profile

**Implementation Needed**:
```tsx
// FILE: src/app/creator/register/page.tsx (NEW)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';

export default function CreatorRegisterPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!wallet.isConnected) {
      setError('Please connect wallet first');
      return;
    }

    if (!displayName.trim()) {
      setError('Display name required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          payoutAddress: wallet.address,
          bio: bio.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Registration failed');
      }

      const { creatorId } = await response.json();
      
      // Store creator ID in localStorage for MVP auth
      localStorage.setItem('creatorId', creatorId.toString());
      
      // Navigate to dashboard
      router.push('/creator/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Creator Registration</h1>
        
        {!wallet.isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800">Connect your wallet to register</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Display Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name or Studio"
              className="input w-full"
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payout Address</label>
            <input
              type="text"
              value={wallet.address || 'Not connected'}
              disabled
              className="input w-full bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Earnings will be sent to this address</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell users about your expertise..."
              className="input w-full"
              rows={4}
              maxLength={1000}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={isLoading || !wallet.isConnected || !displayName.trim()}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Registering...' : 'Register as Creator'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.2 Creator Dashboard Page (HIGH PRIORITY - BLOCKING)

**Missing**: `src/app/creator/dashboard/page.tsx`  
**Required For**: User1 to manage snippets and see earnings

**Implementation Needed**:
```tsx
// FILE: src/app/creator/dashboard/page.tsx (NEW)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';

interface CreatorData {
  creator: {
    id: number;
    display_name: string;
    payout_address: string;
  };
  snippets: Array<{
    id: number;
    title: string;
    status: string;
    category: string;
  }>;
  earnings: {
    total_earned: string;
    confirmed_payments: number;
  };
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [data, setData] = useState<CreatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (wallet.isConnected) {
      loadDashboard();
    }
  }, [wallet.isConnected, wallet.address]);

  const loadDashboard = async () => {
    try {
      const response = await fetch(`/api/creators/me?payoutAddress=${wallet.address}`);
      
      if (response.status === 404) {
        // Creator not registered yet
        router.push('/creator/register');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Creator Not Found</h2>
          <p className="mb-4">You need to register as a creator first.</p>
          <button
            onClick={() => router.push('/creator/register')}
            className="btn btn-primary"
          >
            Register Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Creator Dashboard</h1>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Earned</div>
          <div className="text-2xl font-bold">
            {(parseInt(data.earnings.total_earned) / 1e9).toFixed(3)} ERG
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Confirmed Payments</div>
          <div className="text-2xl font-bold">{data.earnings.confirmed_payments}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Snippets</div>
          <div className="text-2xl font-bold">{data.snippets.length}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/creator/snippets/create')}
          className="btn btn-primary"
        >
          + Create New Snippet
        </button>
      </div>

      {/* Snippets List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Your Snippets</h2>
        {data.snippets.length === 0 ? (
          <p className="text-gray-500">No snippets yet. Create your first one!</p>
        ) : (
          <div className="space-y-4">
            {data.snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="p-4 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/creator/snippets/${snippet.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{snippet.title}</h3>
                    <p className="text-sm text-gray-500">
                      {snippet.category} • {snippet.status}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      snippet.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {snippet.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 3.3 Create Snippet Page (HIGH PRIORITY - BLOCKING)

**Missing**: `src/app/creator/snippets/create/page.tsx`  
**Required For**: User1 to create new snippet

**Implementation Needed**:
```tsx
// FILE: src/app/creator/snippets/create/page.tsx (NEW)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { value: 'guardrail', label: 'Guardrail' },
  { value: 'format', label: 'Format' },
  { value: 'tone', label: 'Tone' },
  { value: 'eval', label: 'Evaluation' },
  { value: 'tooling', label: 'Tooling' },
  { value: 'context', label: 'Context' },
  { value: 'other', label: 'Other' },
];

export default function CreateSnippetPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('guardrail');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('0.01');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    // Get creator ID from localStorage (MVP auth)
    const creatorId = localStorage.getItem('creatorId');
    if (!creatorId) {
      setError('Not authenticated. Please register first.');
      router.push('/creator/register');
      return;
    }

    // Validation
    if (!title.trim()) {
      setError('Title required');
      return;
    }

    if (!content.trim()) {
      setError('Content required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Invalid price');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Step 1: Create snippet
      const snippetResponse = await fetch('/api/creators/snippets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-Id': creatorId,
        },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || undefined,
          category,
        }),
      });

      if (!snippetResponse.ok) {
        const data = await snippetResponse.json();
        throw new Error(data.error || 'Failed to create snippet');
      }

      const { snippetId } = await snippetResponse.json();

      // Step 2: Create first version
      const versionResponse = await fetch(`/api/creators/snippets/${snippetId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-Id': creatorId,
        },
        body: JSON.stringify({
          content: content.trim(),
          price_nanoerg: (priceNum * 1e9).toString(),
        }),
      });

      if (!versionResponse.ok) {
        throw new Error('Failed to create version');
      }

      // Navigate to snippet detail page (to publish)
      router.push(`/creator/snippets/${snippetId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Create New Snippet</h1>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Professional Tone Enforcer"
              className="input w-full"
              maxLength={255}
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium mb-2">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ensures formal business communication..."
              className="input w-full"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-2">Prompt Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="You must maintain a professional, formal tone in all responses. Avoid slang, emojis, and casual language..."
              className="input w-full font-mono text-sm"
              rows={12}
            />
            <p className="text-xs text-gray-500 mt-1">
              This is the actual prompt text users will receive after payment
            </p>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Price (ERG) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.01"
              step="0.001"
              min="0"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Price in ERG (1 ERG = 1,000,000,000 nanoERG)
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleCreate}
              disabled={isLoading || !title.trim() || !content.trim()}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Creating...' : 'Create Snippet (Draft)'}
            </button>
            <button
              onClick={() => router.push('/creator/dashboard')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.4 Snippet Detail Page (MEDIUM PRIORITY - For publishing)

**Missing**: `src/app/creator/snippets/[id]/page.tsx`  
**Required For**: User1 to publish snippet (change status from draft → published)

**Implementation Needed**:
```tsx
// FILE: src/app/creator/snippets/[id]/page.tsx (NEW)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SnippetDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [snippet, setSnippet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    loadSnippet();
  }, [params.id]);

  const loadSnippet = async () => {
    const creatorId = localStorage.getItem('creatorId');
    if (!creatorId) {
      router.push('/creator/register');
      return;
    }

    try {
      // Fetch snippet details (you'll need to add GET endpoint or use existing)
      // For MVP, just show basic info and publish button
      setSnippet({
        id: parseInt(params.id),
        title: 'Loading...',
        status: 'draft',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    const creatorId = localStorage.getItem('creatorId');
    if (!creatorId) return;

    setIsPublishing(true);
    setError('');

    try {
      const response = await fetch(`/api/creators/snippets/${params.id}/publish`, {
        method: 'POST',
        headers: {
          'X-Creator-Id': creatorId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to publish');
      }

      alert('Snippet published successfully!');
      router.push('/creator/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Snippet Details</h1>

        <div className="space-y-4 mb-6">
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <span className="ml-2 font-semibold">{snippet?.status || 'draft'}</span>
          </div>
        </div>

        {snippet?.status === 'draft' && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm">
                This snippet is in draft mode. Publish it to make it available for purchase.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="btn btn-primary"
            >
              {isPublishing ? 'Publishing...' : 'Publish Snippet'}
            </button>
          </div>
        )}

        {snippet?.status === 'published' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 text-sm">
              ✅ This snippet is published and available for purchase
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/creator/dashboard')}
          className="btn btn-secondary mt-6"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
```

---

### 3.5 Navigation/Home Updates (LOW PRIORITY - UX)

**Existing**: `src/app/home/page.tsx` already exists  
**Update Needed**: Add "Become a Creator" button

```tsx
// ADDITION to src/app/home/page.tsx
<button
  onClick={() => router.push('/creator/register')}
  className="btn btn-secondary"
>
  Become a Creator
</button>
```

---

### 3.6 Customer Pages (ALREADY EXIST)

✅ **Status**: COMPLETE

- `/browse` - Snippet selection ✅
- `/pay/[id]` - Payment flow ✅
- `/success/[id]` - Content delivery ✅

================================================================================
4. EXACT NAVIGATION FLOW
================================================================================

### 4.1 CREATOR FLOW (User1)

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: REGISTRATION                                           │
├────────────────────────────────────────────────────────────────┤
│ URL: /creator/register                                         │
│ Action:                                                        │
│   1. Connect Nautilus wallet                                   │
│   2. Fill form:                                                │
│      - Display Name: "ErgoScript Expert"                       │
│      - Bio: "Specialized in ErgoScript smart contracts"        │
│   3. Click "Register as Creator"                               │
│ API: POST /api/creators                                        │
│   Body: { displayName, payoutAddress, bio }                    │
│   Response: { creatorId: 1 }                                   │
│ Storage: localStorage.setItem('creatorId', '1')                │
│ Navigate: /creator/dashboard                                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 2: VIEW DASHBOARD                                         │
├────────────────────────────────────────────────────────────────┤
│ URL: /creator/dashboard                                        │
│ API: GET /api/creators/me?payoutAddress=9f...abc123            │
│ Response: { creator, snippets: [], earnings: { total: "0" } } │
│ Action: Click "Create New Snippet" button                      │
│ Navigate: /creator/snippets/create                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 3: CREATE SNIPPET                                         │
├────────────────────────────────────────────────────────────────┤
│ URL: /creator/snippets/create                                  │
│ Action:                                                        │
│   1. Fill form:                                                │
│      - Title: "JSON Output Enforcer"                           │
│      - Summary: "Forces structured JSON output"                │
│      - Category: "format"                                      │
│      - Content: "You must output valid JSON only..."           │
│      - Price: "0.01" ERG                                       │
│   2. Click "Create Snippet (Draft)"                            │
│ API Calls:                                                     │
│   POST /api/creators/snippets                                  │
│     Headers: { X-Creator-Id: "1" }                             │
│     Body: { title, summary, category }                         │
│     Response: { snippetId: 5 }                                 │
│   POST /api/creators/snippets/5/versions                       │
│     Headers: { X-Creator-Id: "1" }                             │
│     Body: { content, price_nanoerg: "10000000" }               │
│     Response: { versionId: 7 }                                 │
│ Navigate: /creator/snippets/5                                  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 4: PUBLISH SNIPPET                                        │
├────────────────────────────────────────────────────────────────┤
│ URL: /creator/snippets/5                                       │
│ Action: Click "Publish Snippet" button                         │
│ API: POST /api/creators/snippets/5/publish                     │
│   Headers: { X-Creator-Id: "1" }                               │
│   Response: { snippetId: 5, status: "published" }              │
│ Alert: "Snippet published successfully!"                       │
│ Navigate: /creator/dashboard                                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 5: REPEAT FOR MORE SNIPPETS                               │
├────────────────────────────────────────────────────────────────┤
│ Create 2-3 more snippets with different categories:            │
│   - "Professional Tone" (tone category, 0.015 ERG)             │
│   - "SQL Injection Guard" (guardrail category, 0.02 ERG)       │
│                                                                │
│ Result: 3 published snippets in marketplace                    │
└────────────────────────────────────────────────────────────────┘
```

---

### 4.2 CUSTOMER FLOW (User2)

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: BROWSE SNIPPETS                                        │
├────────────────────────────────────────────────────────────────┤
│ URL: /browse                                                   │
│ Action:                                                        │
│   1. Connect Nautilus wallet (different from User1)            │
│   2. See list of published snippets (3 snippets from User1)    │
│   3. Select 2 snippets:                                        │
│      ☑ JSON Output Enforcer (0.01 ERG)                         │
│      ☑ Professional Tone (0.015 ERG)                           │
│   4. Enter user prompt: "I need a customer service chatbot"    │
│   5. Click "Create Composition"                                │
│ API Calls:                                                     │
│   POST /api/requests                                           │
│     Body: { userAddress: "9f...xyz789", userPrompt: "..." }   │
│     Response: { requestId: 42 }                                │
│   POST /api/compositions/propose                               │
│     Body: { requestId: 42 }                                    │
│     Response: { compositionId: 7 }                             │
│ Navigate: /pay/7                                               │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 2: REVIEW COMPOSITION                                     │
├────────────────────────────────────────────────────────────────┤
│ URL: /pay/7                                                    │
│ Display:                                                       │
│   - JSON Output Enforcer: 0.01 ERG                             │
│   - Professional Tone: 0.015 ERG                               │
│   - Platform Fee: 0.002 ERG                                    │
│   - Total: 0.027 ERG                                           │
│ Action: Click "Lock & Pay"                                     │
│ API: POST /api/compositions/7/lock                             │
│   Body: { userAddress: "9f...xyz789" }                         │
│   Response: {                                                  │
│     paymentIntent: {                                           │
│       platformOutput: { address, amount: "2000000" },          │
│       creatorOutputs: [                                        │
│         { address: "9f...abc123", amount: "25000000" }         │
│       ],                                                       │
│       commitmentHex: "64-char-blake2b-hash",                   │
│       totalRequired: "27000000"                                │
│     }                                                          │
│   }                                                            │
│ UI: Show R4 commitment hash and payment details                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 3: EXECUTE PAYMENT ON TESTNET                             │
├────────────────────────────────────────────────────────────────┤
│ Action:                                                        │
│   1. Nautilus popup appears                                    │
│   2. Review transaction:                                       │
│      - Outputs: 2 (platform + creator)                         │
│      - Total: 0.027 ERG + ~0.001 ERG fee                       │
│   3. Verify R4 register shown in Nautilus                      │
│   4. Click "Sign & Send" in Nautilus                           │
│   5. Transaction broadcasts to testnet                         │
│ Result: Transaction ID (64-char hex)                           │
│ UI: Shows "Transaction submitted: abc123..."                   │
│ Action: Click "Confirm Payment" button                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 4: VERIFY PAYMENT                                         │
├────────────────────────────────────────────────────────────────┤
│ API: POST /api/compositions/7/confirm                          │
│   Body: { txId: "abc123...", userAddress: "9f...xyz789" }     │
│   Backend:                                                     │
│     1. Verify ownership (IDOR check)                           │
│     2. Query Ergo Explorer API for transaction                 │
│     3. Verify R4 register matches expected commitment          │
│     4. Verify output amounts match composition_items           │
│     5. Update compositions.status = 'paid'                     │
│   Response: { status: "paid", txId: "abc123..." }              │
│ Navigate: /success/7                                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ STEP 5: UNLOCK CONTENT                                         │
├────────────────────────────────────────────────────────────────┤
│ URL: /success/7                                                │
│ API: GET /api/compositions/7/content                           │
│   Validation:                                                  │
│     - compositions.status = 'paid' ✅                           │
│     - compositions.user_address matches requester ✅            │
│   Response: {                                                  │
│     content: "...",                                            │
│     items: [                                                   │
│       {                                                        │
│         snippetTitle: "JSON Output Enforcer",                  │
│         content: "You must output valid JSON only. Never..."   │
│       },                                                       │
│       {                                                        │
│         snippetTitle: "Professional Tone",                     │
│         content: "You must maintain a professional tone..."    │
│       }                                                        │
│     ]                                                          │
│   }                                                            │
│ Display: Full prompt text for both snippets                    │
│ Action: User copies text and uses in their AI system           │
└────────────────────────────────────────────────────────────────┘
```

================================================================================
5. STEP-BY-STEP TESTNET TEST SCRIPT
================================================================================

### PREREQUISITES

1. **Wallets**:
   - User1 (Creator): Nautilus wallet with testnet ERG
   - User2 (Customer): Different Nautilus wallet with testnet ERG

2. **Environment**:
   - MySQL database running with schema_v2.sql loaded
   - Next.js dev server running on localhost:3000
   - Testnet explorer: https://testnet.ergoplatform.com/

3. **Testnet Faucet**:
   - Get testnet ERG: https://testnet.ergofaucet.org/

---

### TEST EXECUTION (CLICK-BY-CLICK)

#### PHASE 1: CREATOR SETUP (User1)

**Test 1.1: Creator Registration**
```
1. Open Chrome with Nautilus extension
2. Switch Nautilus to testnet mode
3. Create/import wallet (User1 address: 9f...abc123)
4. Navigate: http://localhost:3000/creator/register
5. Click "Connect Wallet" → Approve in Nautilus
6. Fill form:
   - Display Name: "ErgoScript Expert"
   - Payout Address: (auto-filled from wallet)
   - Bio: "Smart contract specialist"
7. Click "Register as Creator"
8. ✅ Verify: Redirected to /creator/dashboard
9. ✅ Verify: localStorage has creatorId=1
```

**Test 1.2: Create First Snippet**
```
10. Click "Create New Snippet"
11. Navigate: /creator/snippets/create
12. Fill form:
    - Title: "JSON Output Enforcer"
    - Summary: "Forces structured JSON output format"
    - Category: "format"
    - Content: "You must output valid JSON only. Never include explanatory text outside the JSON structure. Format all responses as: {...}"
    - Price: "0.01"
13. Click "Create Snippet (Draft)"
14. ✅ Verify: Redirected to /creator/snippets/5
15. ✅ Verify: Status shows "draft"
```

**Test 1.3: Publish Snippet**
```
16. Click "Publish Snippet"
17. ✅ Verify: Alert "Snippet published successfully!"
18. ✅ Verify: Redirected to /creator/dashboard
19. ✅ Verify: Dashboard shows 1 snippet with status "published"
```

**Test 1.4: Create Second Snippet**
```
20. Repeat steps 10-18 with:
    - Title: "Professional Tone"
    - Summary: "Ensures formal business communication"
    - Category: "tone"
    - Content: "You must maintain a professional, formal tone in all responses. Avoid slang, emojis, and casual language. Address users with respect and courtesy."
    - Price: "0.015"
21. ✅ Verify: Dashboard shows 2 published snippets
```

**Test 1.5: Database Verification**
```
22. Query database:
    SELECT * FROM creators WHERE payout_address LIKE '9f%abc123%';
    ✅ Expect: 1 row with display_name="ErgoScript Expert"

23. Query snippets:
    SELECT * FROM snippets WHERE creator_id=1;
    ✅ Expect: 2 rows with status='published'

24. Query versions:
    SELECT * FROM snippet_versions WHERE snippet_id IN (SELECT id FROM snippets WHERE creator_id=1);
    ✅ Expect: 2 rows with price_nanoerg=10000000 and 15000000
```

---

#### PHASE 2: CUSTOMER PURCHASE (User2)

**Test 2.1: Browse Snippets**
```
25. Open new incognito window (or different browser profile)
26. Switch Nautilus to testnet (User2 address: 9f...xyz789)
27. Navigate: http://localhost:3000/browse
28. Click "Connect Wallet" → Approve in Nautilus
29. ✅ Verify: See 2 snippets listed:
    - "JSON Output Enforcer" by ErgoScript Expert (0.01 ERG)
    - "Professional Tone" by ErgoScript Expert (0.015 ERG)
```

**Test 2.2: Select Snippets**
```
30. Check both snippets
31. Enter user prompt: "I need a customer service chatbot"
32. ✅ Verify: Total shows "0.027 ERG" (0.025 + 0.002 platform fee)
33. Click "Create Composition"
```

**Test 2.3: API Verification (Browser DevTools)**
```
34. Open DevTools → Network tab
35. ✅ Verify: POST /api/requests → 200 OK
36. ✅ Verify: POST /api/compositions/propose → 200 OK
37. ✅ Verify: Response contains compositionId=7
38. ✅ Verify: Redirected to /pay/7
```

**Test 2.4: Review Payment**
```
39. ✅ Verify: Page shows:
    - 2 snippets listed
    - Total: 0.027 ERG
    - Platform fee: 0.002 ERG
    - "Lock & Pay" button visible
40. Click "Lock & Pay"
41. ✅ Verify: API call POST /api/compositions/7/lock succeeds
42. ✅ Verify: UI shows:
    - R4 Commitment Hash (64 hex chars)
    - Platform output address and amount
    - Creator outputs (1 output aggregated)
    - Total required: 0.027 ERG
```

**Test 2.5: Execute Payment**
```
43. Click "Pay with Nautilus"
44. ✅ Nautilus popup appears with transaction details
45. ✅ Verify in Nautilus:
    - Total amount: ~0.028 ERG (0.027 + fee)
    - Output count: 2
    - R4 register visible in first output (if Nautilus shows registers)
46. Click "Sign & Send" in Nautilus
47. ✅ Transaction broadcasts
48. ✅ UI shows: "Transaction submitted: abc123def456..."
49. Copy transaction ID
```

**Test 2.6: Testnet Verification**
```
50. Open: https://testnet.ergoplatform.com/en/transactions/abc123def456...
51. ✅ Verify transaction exists (may take 10-120 seconds)
52. ✅ Verify outputs:
    - Output 0: Platform address, 0.002 ERG, R4 register present
    - Output 1: Creator address (9f...abc123), 0.025 ERG
53. Copy transaction ID again
```

**Test 2.7: Confirm Payment**
```
54. Return to /pay/7 page
55. Paste transaction ID in confirmation field
56. Click "Confirm Payment"
57. ✅ Verify: API call POST /api/compositions/7/confirm → 200 OK
58. ✅ Verify: Redirected to /success/7
```

**Test 2.8: Unlock Content**
```
59. ✅ Verify: Page title "Payment Confirmed"
60. ✅ Verify: Transaction ID displayed: abc123def456...
61. ✅ Verify: Content section shows 2 snippets:
    - "JSON Output Enforcer"
      Content: "You must output valid JSON only. Never include..."
    - "Professional Tone"
      Content: "You must maintain a professional, formal tone..."
62. ✅ Copy content and verify it matches what User1 created
```

**Test 2.9: Database Verification**
```
63. Query compositions:
    SELECT * FROM compositions WHERE id=7;
    ✅ Expect: status='paid', tx_id='abc123def456...', user_address='9f...xyz789'

64. Query payments:
    SELECT * FROM payments WHERE composition_id=7;
    ✅ Expect: status='confirmed', tx_id='abc123def456...', confirmed_at IS NOT NULL

65. Query composition_items:
    SELECT * FROM composition_items WHERE composition_id=7;
    ✅ Expect: 2 rows with creator_payout_address='9f...abc123'
```

---

#### PHASE 3: CREATOR EARNINGS CHECK (User1)

**Test 3.1: View Earnings**
```
66. Return to User1 browser window
67. Refresh /creator/dashboard
68. ✅ Verify: Dashboard shows:
    - Total Earned: 0.025 ERG
    - Confirmed Payments: 1
    - Total Snippets: 2
```

**Test 3.2: Database Earnings Query**
```
69. Query earnings:
    SELECT 
      SUM(ci.price_nanoerg) as total_earned,
      COUNT(DISTINCT p.id) as payment_count
    FROM composition_items ci
    JOIN compositions c ON c.id = ci.composition_id
    JOIN payments p ON p.composition_id = c.id
    WHERE ci.creator_payout_address = '9f...abc123'
      AND p.status = 'confirmed';
    ✅ Expect: total_earned=25000000, payment_count=1
```

================================================================================
6. EXPECTED API CALL SEQUENCE
================================================================================

**Creator Registration**:
```
POST /api/creators
  ← { creatorId: 1, status: "created" }
```

**Create Snippet**:
```
POST /api/creators/snippets
  Headers: { X-Creator-Id: "1" }
  ← { snippetId: 5, status: "draft" }

POST /api/creators/snippets/5/versions
  Headers: { X-Creator-Id: "1" }
  ← { versionId: 7, version: 1 }

POST /api/creators/snippets/5/publish
  Headers: { X-Creator-Id: "1" }
  ← { snippetId: 5, status: "published" }
```

**Customer Flow**:
```
GET /api/snippets
  ← { snippets: [{ id: 5, title: "JSON...", price_nanoerg: 10000000 }] }

POST /api/requests
  ← { requestId: 42 }

POST /api/compositions/propose
  ← { compositionId: 7, items: [...], totals: {...} }

POST /api/compositions/7/lock
  ← { paymentIntent: { commitmentHex: "...", creatorOutputs: [...] } }

POST /api/compositions/7/confirm
  ← { status: "paid", txId: "abc123..." }

GET /api/compositions/7/content
  ← { content: "...", items: [{ content: "..." }] }
```

================================================================================
7. SUCCESS CRITERIA
================================================================================

✅ **Creator Side**:
- [ ] User1 can register as creator
- [ ] User1 can create 2+ snippets with different categories
- [ ] User1 can publish snippets (draft → published)
- [ ] User1 sees snippets on dashboard
- [ ] User1 sees earnings update after User2 payment

✅ **Customer Side**:
- [ ] User2 sees published snippets on /browse
- [ ] User2 can select multiple snippets
- [ ] User2 can lock composition and see R4 commitment
- [ ] User2 can pay via Nautilus on testnet
- [ ] User2 can confirm payment with transaction ID
- [ ] User2 receives full snippet content after payment

✅ **Blockchain**:
- [ ] Transaction visible on testnet explorer
- [ ] R4 register present in platform output
- [ ] Correct amounts sent to creator and platform
- [ ] Payment verification succeeds with R4 match

✅ **Database**:
- [ ] All tables updated correctly
- [ ] composition.status transitions: proposed → awaiting_payment → paid
- [ ] payment.status: submitted → confirmed
- [ ] Earnings calculations accurate

================================================================================
END OF REPORT
================================================================================
