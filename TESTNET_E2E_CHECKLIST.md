# End-to-End Testnet Payment Flow - Command Checklist

## Step 1: Verify Environment
```powershell
Get-Content .env.local | Select-String "ERGO_NETWORK|PLATFORM_ERGO_ADDRESS"
```
**EXPECTED:** `ERGO_NETWORK=testnet` and `PLATFORM_ERGO_ADDRESS=3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ`

---

## Step 2: Load Test Data
```powershell
node scripts/setup-test-data.js
```
**EXPECTED:** Console table showing 3 snippets with real testnet addresses

---

## Step 3: Start Dev Server
```powershell
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd D:\Ergo\promptpage; npm run dev"
```
**EXPECTED:** New terminal window opens, shows `✓ Ready in ~1600ms`

---

## Step 4: Verify Creators API
```powershell
Start-Sleep -Seconds 3; Invoke-RestMethod "http://localhost:3000/api/creators" | ConvertTo-Json -Depth 5
```
**EXPECTED:** JSON array with 2 creators, payout_address fields match testnet addresses

---

## Step 5: Create User Request
```powershell
$body = @{ prompt = "Help me with Python data analysis and code review" } | ConvertTo-Json; $response = Invoke-RestMethod -Uri "http://localhost:3000/api/requests" -Method POST -Body $body -ContentType "application/json"; $requestId = $response.id; Write-Host "Request ID: $requestId"; $response | ConvertTo-Json -Depth 5
```
**EXPECTED:** JSON with `id` field (save as `$requestId`)

---

## Step 6: Propose Composition
```powershell
$body = @{ requestId = $requestId } | ConvertTo-Json; $response = Invoke-RestMethod -Uri "http://localhost:3000/api/compositions/propose" -Method POST -Body $body -ContentType "application/json"; $compositionId = $response.id; Write-Host "Composition ID: $compositionId"; $response | ConvertTo-Json -Depth 5
```
**EXPECTED:** JSON with `id`, `total_price_nanoerg`, `selected_snippets` array

---

## Step 7: Lock Composition (Get Payment Intent)
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/compositions/$compositionId/lock" -Method POST -ContentType "application/json"; $paymentIntent = $response.paymentIntent; Write-Host "`n=== PAYMENT INTENT ==="; Write-Host "Platform: $($paymentIntent.platformOutput.amount) nanoERG -> $($paymentIntent.platformOutput.address)"; Write-Host "Creator: $($paymentIntent.creatorOutputs[0].amount) nanoERG -> $($paymentIntent.creatorOutputs[0].address)"; Write-Host "Total Required: $($paymentIntent.totalRequired) nanoERG"; $response | ConvertTo-Json -Depth 10
```
**EXPECTED:** 
- `platformOutput.amount = "1250000"` → Address 1
- `creatorOutputs[0].amount = "25000000"` → Address 2 (aggregated from snippets 1+2)
- `totalRequired = "26250000"`

---

## Step 8: Sign and Submit Transaction

### Option A: Via Browser UI
1. Open `http://localhost:3000/composition/$compositionId` in browser
2. Click "Pay with Nautilus" button
3. Sign transaction in Nautilus popup
4. Wait for transaction submission
**EXPECTED:** Page shows `txId` (64-character hex string)

### Option B: Via Script (Direct Nautilus API)
```powershell
# Get UTXOs from payer address (Address 3)
$utxos = Invoke-RestMethod -Uri "http://127.0.0.1:9052/wallet/boxes/unspent?minConfirmations=0&minInclusionHeight=0" -Method GET

# Build and sign transaction (requires Nautilus running)
# This is placeholder - actual implementation requires Nautilus dApp connector
Write-Host "Open Nautilus wallet, connect to testnet, and sign the transaction"
```
**EXPECTED:** Nautilus shows transaction preview, user approves, returns `txId`

---

## Step 9: Wait for On-Chain Confirmation
```powershell
# Replace TX_ID_HERE with actual transaction ID from Step 8
$txId = "TX_ID_HERE"; do { Start-Sleep -Seconds 10; try { $tx = Invoke-RestMethod "https://api-testnet.ergoplatform.com/api/v1/transactions/$txId"; Write-Host "Confirmations: $($tx.numConfirmations)"; $confirmed = $tx.numConfirmations -ge 1 } catch { Write-Host "Transaction not found yet, waiting..."; $confirmed = $false } } while (-not $confirmed); Write-Host "Transaction confirmed!"
```
**EXPECTED:** Loop exits when `numConfirmations >= 1`, outputs `Transaction confirmed!`

---

## Step 10: Confirm Payment in Backend
```powershell
$body = @{ txId = $txId } | ConvertTo-Json; $response = Invoke-RestMethod -Uri "http://localhost:3000/api/compositions/$compositionId/confirm" -Method POST -Body $body -ContentType "application/json"; Write-Host "`n=== CONFIRMATION RESULT ==="; $response | ConvertTo-Json -Depth 10
```
**EXPECTED:** 
- `status = "paid"`
- `verificationDetails.platformOutputValid = true`
- `verificationDetails.creatorOutputsValid = true`
- `verificationDetails.utxoVerificationPassed = true`

---

## Verification via Explorer API
```powershell
$tx = Invoke-RestMethod "https://api-testnet.ergoplatform.com/api/v1/transactions/$txId"; Write-Host "`n=== ON-CHAIN OUTPUTS ==="; $tx.outputs | ForEach-Object { if ($_.address -eq "3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ") { Write-Host "Platform: $($_.value) nanoERG -> $($_.address)" } elseif ($_.address -eq "3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz") { Write-Host "Creator: $($_.value) nanoERG -> $($_.address)" } }
```
**EXPECTED:** 
- Platform output: `1250000` nanoERG → Address 1
- Creator output: `25000000` nanoERG → Address 2
- Change output: Remaining funds → Address 3 (payer)

---

## PASS CONDITION
Confirm endpoint returns `status: "paid"` with all verification flags `true`, AND explorer API shows exact amounts:
- Platform: `1250000` nanoERG → `3Ww6...vmZ`
- Creator: `25000000` nanoERG → `3WwFv...aPz`
- Total paid: `26250000` nanoERG (excluding tx fee and change)

---

## Quick Reference: Expected Values

| Field | Value | Address |
|-------|-------|---------|
| Platform Fee | 1,250,000 nanoERG (5%) | 3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ |
| Creator Payout | 25,000,000 nanoERG (95%) | 3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz |
| Total Required | 26,250,000 nanoERG | - |
| Snippet 1 Price | 10,000,000 nanoERG | TestCreator1 |
| Snippet 2 Price | 15,000,000 nanoERG | TestCreator1 |

**Note:** Transaction will include miner fee (~1,100,000 nanoERG) deducted from payer's inputs, plus change output back to payer.
