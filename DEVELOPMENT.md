# PromptPage Development Notes

## Architecture Decisions

### Why Fleet SDK over ergo-lib-wasm?
- Fleet SDK is actively maintained with better TypeScript support
- More ergonomic API for transaction building
- Better documentation and examples
- Smaller bundle size for browser usage

### Why Next.js API Routes?
- Serverless deployment ready (Vercel, etc.)
- Collocated with frontend code
- Built-in API route handling
- TypeScript support out of the box

### Why SHA-256 instead of Blake2b?
- Native Node.js crypto support (no additional dependencies)
- Sufficient for MVP hash comparison
- Can upgrade to Blake2b in production with a library

### Non-Custodial Design Principles
1. **Never store private keys** - All signing happens client-side in Nautilus
2. **User controls funds** - Backend only stores public data
3. **Transparent transactions** - All costs visible before signing
4. **Open verification** - Anyone can verify prompt authenticity on-chain

## Transaction Building Logic

### Input Selection (Greedy Algorithm)
```typescript
// Simple greedy selection for MVP
// Production should use more sophisticated coin selection:
// - Minimize number of inputs (lower tx size/fee)
// - Prioritize older UTXOs (better for privacy)
// - Consider UTXO consolidation strategies
```

### Token ID Derivation
The NFT token ID is deterministically derived from the first input box ID:
```
tokenId = firstInputBox.boxId
```
This is an Ergo protocol rule for NFT minting.

### Register Encoding
Registers are encoded using Fleet SDK's type system:
- **R4**: `SConstant(SColl(SByte, Array.from(bytes)))` for hash bytes
- **R5**: `SConstant(SInt(promptId))` for integer
- **R6**: `SConstant(SColl(SByte, Array.from(utf8Bytes)))` for strings

## Database Design

### Status States
```
stored       → Prompt saved, ready to mint
mint_pending → Transaction submitted, awaiting confirmation
minted       → Transaction confirmed on-chain
failed       → Transaction failed or rejected
```

### Why LONGTEXT for prompt_text?
- Supports up to 4GB of text (way beyond our 10k limit)
- Future-proof for expanded use cases
- Minimal storage overhead for small prompts

## Security Considerations

### Input Validation
- Prompt length: 10-10,000 characters
- Address validation: Basic string checks (could be enhanced)
- SQL injection: Prevented via parameterized queries
- XSS: React auto-escaping + server-side sanitization

### Rate Limiting (TODO)
MVP does not include rate limiting. Production should add:
```typescript
// Example: 10 prompts per hour per IP
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10
});
```

### CORS (TODO)
MVP allows all origins. Production should restrict:
```typescript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' }
      ]
    }
  ];
}
```

## Performance Optimization Ideas

### Database Indexing
Current indexes on:
- `owner_address` - for listing user's prompts
- `token_id` - for looking up by NFT
- `status` - for filtering by mint status
- `created_at` - for chronological sorting

### Caching Strategy (Future)
- Cache prompt lookups (Redis)
- Cache blockchain height (update every 2 minutes)
- Cache token metadata

### Frontend Optimization
- Implement React Query for data fetching
- Add loading skeletons
- Lazy load transaction builder (code splitting)
- Add service worker for offline support

## Testing Strategy

### Manual Testing Checklist
- [ ] Connect wallet successfully
- [ ] Create prompt with valid text
- [ ] Reject prompt with invalid length
- [ ] Mint NFT successfully on testnet
- [ ] Verify transaction on explorer
- [ ] Check database status updates
- [ ] Test with insufficient funds (should fail gracefully)
- [ ] Test with network disconnect (should show error)

### Automated Testing (Future)
```typescript
// Unit tests for crypto utilities
// Integration tests for API routes
// E2E tests with Playwright for wallet flow
```

## Deployment Considerations

### Environment Variables per Environment
```
Development: .env.local
Staging:     .env.staging (testnet)
Production:  .env.production (mainnet)
```

### Database Migrations
Current approach: Single SQL file
Production should use: Sequelize/Prisma migrations or Flyway

### Monitoring & Logging
- Add Sentry for error tracking
- Add LogRocket for session replay
- Monitor failed transactions
- Alert on database errors
- Track service fee collection

## Known Limitations (MVP)

1. **No transaction verification** - Backend trusts client-provided txId
   - Fix: Query explorer API to verify transaction exists and is valid

2. **No UTXO optimization** - Uses simple greedy selection
   - Fix: Implement proper coin selection algorithm

3. **No retry mechanism** - Failed transactions require manual retry
   - Fix: Add transaction queue with retry logic

4. **No pagination** - All prompts loaded at once
   - Fix: Add pagination to API and UI

5. **No search** - Can't search prompts by text
   - Fix: Add full-text search (MySQL FULLTEXT or Elasticsearch)

## Future Extension: Bookable Prompts Marketplace

### Additional Database Tables
```sql
CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prompt_id INT NOT NULL,
  buyer_address VARCHAR(255) NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  purchase_tx_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'confirmed', 'failed'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id),
  INDEX idx_buyer (buyer_address),
  INDEX idx_prompt (prompt_id)
);

ALTER TABLE prompts ADD COLUMN price_nanoerg BIGINT NULL;
ALTER TABLE prompts ADD COLUMN is_public BOOLEAN DEFAULT TRUE;
```

### Purchase Flow
1. Buyer browses marketplace
2. Buyer initiates purchase
3. Backend generates payment address with promptId in R4
4. Buyer sends payment transaction
5. Backend verifies payment on-chain
6. Backend unlocks prompt text for buyer
7. Buyer can view/copy prompt

### Payment Verification
```typescript
// Verify payment transaction:
// 1. Check transaction exists on-chain
// 2. Check output box has correct value
// 3. Check output box R4 contains promptId
// 4. Check output goes to seller's address
// 5. Mark purchase as confirmed
```

## Resources & References

### Ergo Documentation
- [Ergo Platform Docs](https://docs.ergoplatform.com/)
- [ErgoScript Guide](https://docs.ergoplatform.com/dev/scs/ergoscript/)
- [Fleet SDK](https://fleet-sdk.github.io/docs/)

### Explorer APIs
- Testnet: https://api-testnet.ergoplatform.com/api/v1/docs
- Mainnet: https://api.ergoplatform.com/api/v1/docs

### Community
- [Ergo Discord](https://discord.gg/kj7s7nb)
- [Ergo Forum](https://www.ergoforum.org/)
- [Ergo Reddit](https://reddit.com/r/ergonauts)

### Development Tools
- [Nautilus Wallet](https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
- [Testnet Faucet](https://testnet.ergofaucet.org/)
- [Testnet Explorer](https://testnet.ergoplatform.com/)
- [Ergo Playground](https://scastie.scala-lang.org/)

## Contributing Guidelines

### Code Style
- Use TypeScript strict mode
- Follow Airbnb style guide
- Use Prettier for formatting
- Add JSDoc comments for exported functions

### Git Commit Messages
```
feat: Add wallet connection UI
fix: Handle insufficient funds error
docs: Update README with deployment steps
refactor: Extract tx building logic
test: Add unit tests for crypto utils
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with tests
3. Update documentation
4. Submit PR with description
5. Wait for review and CI checks
6. Merge after approval

---

Last Updated: 2026-01-02
