# Creator Ownership Test Commands

## 1. Test Creator Registration

### Test 1: Register new creator (should succeed with 201)
```powershell
$body = @{
  ownerAddress = "9fTestOwner1234567890123456789012345678901234567890abcdef"
  payoutAddress = "9fTestPayout1234567890123456789012345678901234567890abcdef"
  displayName = "Test Creator One"
  bio = "Testing creator ownership system"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/creators" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Expected: `{ "creatorId": 3, "status": "created", "message": "Creator registered successfully" }`

### Test 2: Register duplicate (should fail with 409)
```powershell
# Same owner address as Test 1
Invoke-RestMethod -Uri "http://localhost:3000/api/creators" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Expected: `{ "error": "Creator already registered with this owner address", "creatorId": 3 }`

### Test 3: Invalid address format (should fail with 400)
```powershell
$invalidBody = @{
  ownerAddress = "invalid"
  payoutAddress = "9fTestPayout1234567890123456789012345678901234567890abcdef"
  displayName = "Test"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/creators" `
  -Method POST `
  -ContentType "application/json" `
  -Body $invalidBody
```

Expected: `{ "error": "Invalid ownerAddress format" }`

---

## 2. Test Creator Dashboard

### Test: Get dashboard for registered creator
```powershell
$ownerAddr = "9fTestOwner1234567890123456789012345678901234567890abcdef"
Invoke-RestMethod -Uri "http://localhost:3000/api/creators/me?ownerAddress=$ownerAddr"
```

Expected:
```json
{
  "creator": {
    "id": 3,
    "display_name": "Test Creator One",
    "owner_address": "9fTestOwner...",
    "payout_address": "9fTestPayout...",
    "bio": "Testing creator ownership system"
  },
  "snippets": [],
  "earnings": {
    "total_earned_nanoerg": "0",
    "total_earned_erg": "0.000000",
    "confirmed_payments": 0,
    "pending_payments": 0
  }
}
```

---

## 3. Test Snippet Creation with Ownership

### Step 1: Create snippet
```powershell
$ownerAddr = "9fTestOwner1234567890123456789012345678901234567890abcdef"

$snippetBody = @{
  ownerAddress = $ownerAddr
  title = "JSON Output Enforcer"
  summary = "Forces JSON-only output"
  category = "format"
} | ConvertTo-Json

$snippet = Invoke-RestMethod -Uri "http://localhost:3000/api/creators/snippets" `
  -Method POST `
  -ContentType "application/json" `
  -Body $snippetBody

$snippetId = $snippet.snippetId
Write-Host "Created snippet ID: $snippetId"
```

### Step 2: Add version
```powershell
$versionBody = @{
  ownerAddress = $ownerAddr
  content = "You must output valid JSON only. Never include explanatory text."
  price_nanoerg = "10000000"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/creators/snippets/$snippetId/versions" `
  -Method POST `
  -ContentType "application/json" `
  -Body $versionBody
```

### Step 3: Publish snippet
```powershell
$publishBody = @{
  ownerAddress = $ownerAddr
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/creators/snippets/$snippetId/publish" `
  -Method POST `
  -ContentType "application/json" `
  -Body $publishBody
```

---

## 4. Test Authorization (Ownership Check)

### Setup: Register second user
```powershell
$user2Body = @{
  ownerAddress = "9fTestOwner2_DIFFERENT_ADDRESS_567890123456789012345678"
  payoutAddress = "9fTestPayout2_DIFFERENT_ADDRESS_567890123456789012345678"
  displayName = "Test Creator Two"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/creators" `
  -Method POST `
  -ContentType "application/json" `
  -Body $user2Body
```

### Test: User2 tries to modify User1's snippet (should fail)
```powershell
$user2Owner = "9fTestOwner2_DIFFERENT_ADDRESS_567890123456789012345678"
$user1SnippetId = $snippetId  # From step 3 above

$maliciousBody = @{
  ownerAddress = $user2Owner
  content = "Malicious content injection attempt"
  price_nanoerg = "1000000"
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/creators/snippets/$user1SnippetId/versions" `
    -Method POST `
    -ContentType "application/json" `
    -Body $maliciousBody
  Write-Host "❌ ERROR: Authorization bypass! Should have returned 403/404"
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -eq 403 -or $statusCode -eq 404) {
    Write-Host "✅ PASS: Authorization check works (status $statusCode)"
  } else {
    Write-Host "⚠️  Unexpected status: $statusCode"
  }
}
```

---

## 5. Verify Database State

```powershell
node -e "const mysql = require('mysql2/promise'); require('dotenv').config({ path: '.env.local' }); (async () => { const conn = await mysql.createConnection(process.env.DATABASE_URL); const [rows] = await conn.execute('SELECT id, display_name, owner_address, payout_address FROM creators ORDER BY id'); console.table(rows); await conn.end(); })()"
```

Expected: All creators have distinct owner_address and payout_address

---

## 6. Test Existing Payment Flow (Backward Compatibility)

### Verify customer can still purchase and unlock content
```powershell
# This tests that payout_address is still used for payments (not owner_address)
node scripts/test-payment-flow.ts
```

Expected: Payment flow completes successfully using payout_address for creator payouts
