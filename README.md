# PromptPage - Ergo NFT Prompt Marketplace MVP

A non-custodial dApp for storing prompts and minting them as Ergo blockchain NFTs with proof of ownership.

## Overview

PromptPage allows users to:
1. Connect their Nautilus wallet (non-custodial)
2. Store prompt text on a backend server
3. Mint unique NFT tokens that prove ownership of their prompts
4. Pay a service fee to the platform in the same transaction
5. Verify prompt authenticity via on-chain metadata

**Key Features:**
- ✅ Non-custodial: No private keys stored or handled by the platform
- ✅ User pays all costs: Transaction fees, box values, and service fees
- ✅ Prompt metadata stored in NFT registers (R4: hash, R5: promptId, R6: urlPath)
- ✅ Fleet SDK for reliable Ergo transaction building
- ✅ MySQL database for prompt storage
- ✅ Next.js App Router with TypeScript

## Architecture

### Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: MySQL (Strato-hosted)
- **Blockchain**: Ergo (testnet/mainnet configurable)
- **Wallet**: Nautilus (dApp connector)
- **TX Building**: Fleet SDK (@fleet-sdk/core)

### Data Flow
```
User -> Nautilus Wallet -> Frontend
                            ↓
                    POST /api/prompts
                            ↓
                    MySQL (store prompt)
                            ↓
                    Frontend (build unsigned tx)
                            ↓
                    Nautilus (sign & submit tx)
                            ↓
                    POST /api/prompts/[id]/confirm
                            ↓
                    MySQL (update status)
```

### Transaction Structure
```
Inputs: User's UTXOs (sufficient for outputs + fees)

Outputs:
1. NFT Box to User
   - Value: 0.002 ERG (minimum for box)
   - Assets: 1 NFT token (supply=1, decimals=0)
   - Registers:
     R4: promptHash (bytes - SHA-256 hex)
     R5: promptId (int)
     R6: urlPath (bytes - UTF-8 string)

2. Service Fee Box to Platform
   - Value: 0.05 ERG (configurable via SERVICE_FEE_ERG)

3. Change Box to User
   - Value: Remaining funds
   - Assets: Remaining tokens (if any)

Fee: 0.001 ERG (standard transaction fee)
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm/yarn
- MySQL 8.0+ database (Strato or local)
- Nautilus Wallet browser extension installed
- ERG testnet funds (for testing)

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd promptpage
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DATABASE_URL=mysql://username:password@host:3306/promptpage

# Ergo Platform Configuration
ERGO_NETWORK=testnet
PLATFORM_ERGO_ADDRESS=9fPiW45mZwoTxSwTLLXaZcdekqi72emebENtefQFR8Pw52BpH6 # Your platform address
SERVICE_FEE_ERG=0.05

# Application Configuration
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000

# Ergo Explorer API
NEXT_PUBLIC_ERGO_EXPLORER_API=https://api-testnet.ergoplatform.com
```

**Important Configuration Notes:**
- `DATABASE_URL`: Full MySQL connection string
- `PLATFORM_ERGO_ADDRESS`: Your Ergo address where service fees will be sent
- `SERVICE_FEE_ERG`: Service fee amount in ERG (default: 0.05)
- `ERGO_NETWORK`: Use `testnet` for testing, `mainnet` for production
- `NEXT_PUBLIC_ERGO_EXPLORER_API`: 
  - Testnet: `https://api-testnet.ergoplatform.com`
  - Mainnet: `https://api.ergoplatform.com`

### 3. Database Migration
Run the database migration to create the schema:

```bash
npm run db:migrate
```

This will create the `prompts` table with the following structure:

```sql
CREATE TABLE prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_address VARCHAR(255) NOT NULL,
  prompt_text LONGTEXT NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  status ENUM('stored', 'mint_pending', 'minted', 'failed'),
  mint_tx_id VARCHAR(64) NULL,
  token_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 5. Build for Production
```bash
npm run build
npm run start
```

## Testing the Minting Flow

### Testnet Testing Guide

1. **Install Nautilus Wallet**
   - Install the [Nautilus browser extension](https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
   - Create a wallet or import an existing one
   - Switch to **Testnet** mode in Nautilus settings

2. **Get Testnet ERG**
   - Visit the [Ergo Testnet Faucet](https://testnet.ergofaucet.org/)
   - Enter your testnet address from Nautilus
   - Request testnet funds (you'll need ~0.1 ERG for testing)

3. **Connect and Create Prompt**
   - Visit `http://localhost:3000`
   - Click "Connect Nautilus Wallet"
   - Approve the connection in Nautilus
   - Write a prompt (10-10,000 characters)
   - Click "Save Prompt"
   - You'll be redirected to `/p/[id]`

4. **Mint NFT**
   - On the prompt detail page, click "Mint NFT"
   - Review the transaction details in Nautilus:
     - Output 1: NFT to your address (0.002 ERG)
     - Output 2: Service fee to platform (0.05 ERG)
     - Transaction fee: 0.001 ERG
   - Sign and submit the transaction
   - Wait for confirmation (~2 minutes on testnet)

5. **Verify Minting**
   - Check the prompt status updates to "mint_pending" or "minted"
   - View transaction on [Testnet Explorer](https://testnet.ergoplatform.com/)
   - Search for your NFT token ID

### Expected Costs
- **Minimum wallet balance needed**: ~0.06 ERG
  - NFT box: 0.002 ERG
  - Service fee: 0.05 ERG (configurable)
  - Transaction fee: 0.001 ERG
  - Plus buffer for change output

## API Documentation

### POST /api/prompts
Create a new prompt and store it in the database.

**Request:**
```json
{
  "ownerAddress": "9f...", // User's Ergo address
  "promptText": "Your prompt text here"
}
```

**Response (201):**
```json
{
  "promptId": 1,
  "promptHashHex": "abc123...",
  "urlPath": "/p/1"
}
```

**Validations:**
- `ownerAddress` must be a valid string
- `promptText` must be 10-10,000 characters
- Prompt text is trimmed and sanitized

### GET /api/prompts/[id]
Retrieve a prompt by ID.

**Response (200):**
```json
{
  "id": 1,
  "owner_address": "9f...",
  "prompt_text": "Your prompt",
  "prompt_hash": "abc123...",
  "status": "stored",
  "mint_tx_id": null,
  "token_id": null,
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z"
}
```

### POST /api/prompts/[id]/confirm
Confirm a minting transaction.

**Request:**
```json
{
  "txId": "abc123...",
  "tokenId": "def456..." // Optional
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Notes:**
- Sets status to `mint_pending`
- In production, should verify transaction on-chain before setting to `minted`

## Project Structure

```
promptpage/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── prompts/
│   │   │       ├── route.ts              # POST /api/prompts
│   │   │       └── [id]/
│   │   │           ├── route.ts          # GET /api/prompts/[id]
│   │   │           └── confirm/
│   │   │               └── route.ts      # POST /api/prompts/[id]/confirm
│   │   ├── p/
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Prompt detail & mint page
│   │   ├── page.tsx                      # Landing page
│   │   ├── layout.tsx                    # Root layout
│   │   └── globals.css                   # Global styles
│   ├── lib/
│   │   ├── config.ts                     # Configuration constants
│   │   ├── crypto.ts                     # Hashing utilities
│   │   ├── db.ts                         # Database connection
│   │   ├── db-prompts.ts                 # Prompt DB operations
│   │   ├── tx-builder.ts                 # Ergo transaction builder (Fleet SDK)
│   │   └── wallet.ts                     # Nautilus wallet connector
│   └── types/
│       └── index.ts                      # TypeScript type definitions
├── db/
│   └── schema.sql                        # Database schema
├── scripts/
│   └── migrate.js                        # Database migration script
├── .env.example                          # Environment variables template
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript configuration
├── tailwind.config.ts                    # Tailwind CSS configuration
├── next.config.js                        # Next.js configuration
└── README.md                             # This file
```

## Key Implementation Details

### Non-Custodial Design
- No private keys are ever stored or transmitted to the backend
- All transactions are built client-side and signed in the user's browser via Nautilus
- Backend only stores public data (prompt text, hashes, transaction IDs)

### Transaction Building (Fleet SDK)
The `buildMintTransaction` function in `src/lib/tx-builder.ts`:
1. Selects sufficient UTXOs from user's wallet
2. Mints an NFT token (tokenId = first input box ID)
3. Creates NFT output box with registers containing prompt metadata
4. Creates service fee output box to platform address
5. Calculates change and returns to user
6. Sets transaction fee

### Register Encoding
Prompt metadata is stored in NFT box registers:
- **R4**: Prompt hash (SHA-256) as bytes
- **R5**: Prompt ID as integer (SInt)
- **R6**: URL path as UTF-8 bytes

### Security Considerations
- Prompt text length is capped at 10,000 characters
- Input validation on all API endpoints
- SQL injection protection via parameterized queries
- XSS protection via React's built-in escaping

## Future Extensions (Not Implemented in MVP)

### Bookable Prompts Marketplace
- Add `purchases` table to track prompt purchases
- Implement payment flow where buyers pay a price
- Unlock prompt text for buyers after payment verification
- Payment proof via transaction outputs with promptId in registers

### Enhanced Verification
- Implement full on-chain verification by querying explorer API
- Fetch NFT box by token ID
- Read and decode R4 register
- Compare hash with locally computed hash
- Display verification status with visual indicators

### Prompt Privacy
- Add optional encryption for private prompts
- Store encrypted text in database
- Include decryption instructions for NFT holder

### Indexer Integration
- Build custom indexer to track all minted tokens
- List prompts by owner address
- Display marketplace statistics

### Advanced Features
- Edit prompts (with new hash and re-mint)
- Transfer ownership (via NFT transfer)
- Prompt categories and tagging
- Search and discovery
- Social features (likes, comments)

## Troubleshooting

### Common Issues

**1. "Nautilus wallet is not installed"**
- Install the Nautilus extension from Chrome Web Store
- Refresh the page after installation

**2. "Insufficient funds" error during minting**
- Ensure your wallet has at least 0.06 ERG on testnet
- Visit the testnet faucet to get more funds

**3. "Failed to connect to database" error**
- Verify `DATABASE_URL` in `.env` is correct
- Check that MySQL is running and accessible
- Run `npm run db:migrate` to ensure tables exist

**4. Transaction fails with "Box value too low"**
- The NFT box and service fee outputs must meet minimum box value requirements
- Adjust `NFT_BOX_VALUE` in `src/lib/config.ts` if needed (minimum 0.001 ERG)

**5. "Network type mismatch"**
- Ensure Nautilus is set to the same network as `ERGO_NETWORK` in `.env`
- For testing, both should be set to `testnet`

### Debug Mode
Enable verbose logging:
```bash
NODE_ENV=development npm run dev
```

Check browser console for detailed error messages during wallet operations.

## Production Deployment Checklist

Before deploying to mainnet:

- [ ] Set `ERGO_NETWORK=mainnet` in environment variables
- [ ] Update `NEXT_PUBLIC_ERGO_EXPLORER_API` to mainnet URL
- [ ] Verify `PLATFORM_ERGO_ADDRESS` is correct mainnet address
- [ ] Test all flows thoroughly on testnet first
- [ ] Set up database backups
- [ ] Configure proper error monitoring (e.g., Sentry)
- [ ] Add rate limiting to API endpoints (e.g., express-rate-limit)
- [ ] Set up HTTPS with valid SSL certificate
- [ ] Review and audit smart contract logic
- [ ] Consider professional security audit for production
- [ ] Set up monitoring for failed transactions
- [ ] Implement automatic tx verification via explorer API
- [ ] Add comprehensive logging for debugging

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Ergo Discord: https://discord.gg/kj7s7nb
- Ergo Forum: https://www.ergoforum.org/

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Acknowledgments

- Ergo Platform team for the blockchain and tooling
- Fleet SDK developers for the excellent transaction builder
- Nautilus Wallet team for the dApp connector
- Community contributors and testers
