/**
 * Quick Start Guide for PromptPage Development
 * 
 * This script provides a quick reference for common development tasks.
 */

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            PromptPage - Ergo NFT Prompt Marketplace          ║
╚═══════════════════════════════════════════════════════════════╝

QUICK START GUIDE
─────────────────────────────────────────────────────────────────

1. Setup Environment
   ├─ Copy .env.example to .env
   ├─ Configure DATABASE_URL (MySQL connection string)
   ├─ Set PLATFORM_ERGO_ADDRESS (your testnet address)
   └─ Set ERGO_NETWORK=testnet

2. Install Dependencies
   └─ npm install

3. Setup Database
   └─ npm run db:migrate

4. Start Development Server
   └─ npm run dev

5. Testing Flow
   ├─ Install Nautilus wallet extension
   ├─ Switch Nautilus to testnet mode
   ├─ Get testnet ERG from faucet: https://testnet.ergofaucet.org/
   ├─ Visit http://localhost:3000
   ├─ Connect wallet
   ├─ Create and save a prompt
   └─ Mint NFT on prompt detail page

─────────────────────────────────────────────────────────────────
IMPORTANT FILES
─────────────────────────────────────────────────────────────────

Configuration:
  └─ src/lib/config.ts           # Ergo constants and config

Database:
  ├─ src/lib/db.ts               # Database connection pool
  ├─ src/lib/db-prompts.ts       # Prompt operations
  └─ db/schema.sql               # Database schema

Blockchain:
  ├─ src/lib/wallet.ts           # Nautilus connector
  ├─ src/lib/tx-builder.ts       # Transaction builder (Fleet SDK)
  └─ src/lib/crypto.ts           # Hashing utilities

API Routes:
  ├─ src/app/api/prompts/route.ts              # POST /api/prompts
  ├─ src/app/api/prompts/[id]/route.ts         # GET /api/prompts/[id]
  └─ src/app/api/prompts/[id]/confirm/route.ts # POST confirm

Pages:
  ├─ src/app/page.tsx            # Landing page + create prompt
  └─ src/app/p/[id]/page.tsx     # Prompt detail + mint NFT

─────────────────────────────────────────────────────────────────
ERGO TRANSACTION STRUCTURE
─────────────────────────────────────────────────────────────────

Inputs:  User's UTXOs (auto-selected)

Outputs:
  1. NFT Box → User Address
     ├─ Value: 0.002 ERG
     ├─ Token: 1 NFT (supply=1, decimals=0)
     └─ Registers:
        ├─ R4: promptHash (SHA-256 bytes)
        ├─ R5: promptId (integer)
        └─ R6: urlPath (UTF-8 bytes)

  2. Service Fee → Platform Address
     └─ Value: 0.05 ERG (configurable)

  3. Change → User Address
     └─ Value: Remaining funds

Fee: 0.001 ERG

─────────────────────────────────────────────────────────────────
TROUBLESHOOTING
─────────────────────────────────────────────────────────────────

"Database connection failed"
  → Check DATABASE_URL in .env
  → Run: npm run db:migrate

"Insufficient funds"
  → Get testnet ERG: https://testnet.ergofaucet.org/
  → Need at least 0.06 ERG

"Nautilus not found"
  → Install: chrome.google.com/webstore → Search "Nautilus Wallet"
  → Refresh page after install

"Network mismatch"
  → Nautilus: Settings → Switch to Testnet
  → .env: ERGO_NETWORK=testnet

─────────────────────────────────────────────────────────────────
NEXT STEPS (POST-MVP)
─────────────────────────────────────────────────────────────────

• Implement full on-chain verification
• Add marketplace features (bookable prompts)
• Build indexer for listing minted prompts
• Add prompt categories and search
• Implement rate limiting
• Set up monitoring and error tracking
• Professional security audit before mainnet

─────────────────────────────────────────────────────────────────

Happy Building! 🚀

Documentation: README.md
Support: https://discord.gg/kj7s7nb (Ergo Discord)

`);
