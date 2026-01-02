# AI Agent Instructions for ErgoScript Smart Contract Development

## Project Overview
This workspace is for developing **ErgoScript smart contracts** on the Ergo blockchain using the **eUTXO (extended UTXO) model**. Contracts are compiled to ErgoTree and stored in boxes (UTXOs).

## Architecture: eUTXO Model

### Box Structure
- **Box** = transaction output (UTXO) containing:
  - **R0**: Value in nanoErgs (1 ERG = 1,000,000,000 nanoErgs)
  - **R1**: Guard script (the smart contract - ErgoScript)
  - **R2**: Tokens (optional)
  - **R3**: Transaction creation info
  - **R4-R9**: Custom registers for contract-specific data
- **State transitions** occur through box spending/creation
- **Data inputs**: Read-only boxes in transactions for oracle data

### Contract Language
- **ErgoScript**: Typed, functional language compiling to ErgoTree
- **Execution**: All spending paths must evaluate to `sigmaProp(true)`
- **Context**: Access to `SELF`, `INPUTS`, `OUTPUTS`, `HEIGHT`, etc.

## Development Workflow

### Setup
```scala
// Import Ergo Playground libraries
import org.ergoplatform.compiler.ErgoScalaCompiler._
import org.ergoplatform.playgroundenv.utils.ErgoScriptCompiler
import org.ergoplatform.playground._

// Create simulation environment
val blockchainSim = newBlockChainSimulationScenario("MyContract")
val nanoergsInErg = 1000000000L
```

### Contract Compilation
```scala
// Compile with parameter substitution
val contract = ErgoScriptCompiler.compile(
  Map("deadline" -> 1000, "ownerPK" -> party.wallet.getAddress.pubKey),
  contractScript
)

// Get P2S address for mainnet deployment
val contractAddress = Pay2SAddress(contract.ergoTree)
```

### Testing
```scala
// Generate test funds
party.generateUnspentBoxes(toSpend = 100000000)

// Create boxes and transactions
val outputBox = Box(value = amount, script = contract, registers = Map(R4 -> data))
val tx = Transaction(inputs = inputBoxes, outputs = List(outputBox), fee = MinTxFee)

// Sign and submit
val signedTx = party.wallet.sign(tx)
blockchainSim.send(signedTx)
```

## Secure Patterns (CRITICAL)

### 1. Commit-Reveal Pattern
```scala
// Commit phase: store hash in R4
val hashedChoice = blake2b256(choice)
val commitBox = Box(registers = Map(R4 -> hashedChoice))

// Reveal phase: verify hash matches revealed value
sigmaProp(blake2b256(OUTPUTS(0).R4[Coll[Byte]].get) == SELF.R4[Coll[Byte]].get)
```

### 2. Token Preservation
```scala
// ALWAYS preserve tokens across state transitions
val tokensPreserved = OUTPUTS(0).tokens(0)._1 == SELF.tokens(0)._1 &&
                      OUTPUTS(0).tokens(0)._2 == SELF.tokens(0)._2
```

### 3. State Continuation (Self-Replication)
```scala
// Next box must use same contract
val selfReplication = OUTPUTS(0).propositionBytes == SELF.propositionBytes

// Validate register evolution
val correctStateUpdate = OUTPUTS(0).R4[Long].get == SELF.R4[Long].get + 1
```

### 4. Script Hash Verification
```scala
// Verify output is protected by specific contract
val gameScriptHash = blake2b256(gameContract.ergoTree.bytes)
sigmaProp(blake2b256(OUTPUTS(0).propositionBytes) == gameScriptHash)
```

## Known Issues & Anti-Patterns

### ❌ Unvalidated Data Inputs
```scala
// BAD: No validation of register contents
val data = SELF.R4[Long].get  // Can be manipulated!

// GOOD: Validate against known source
val trustedBox = CONTEXT.dataInputs(0)
val isValidOracle = trustedBox.tokens(0)._1 == oracleNFT
```

### ❌ OR-Branch Bypass
```scala
// BAD: Attacker can bypass via second condition
ownerPK || sigmaProp(OUTPUTS(0).value > 100)

// GOOD: Use AND for constraints, OR only for authorized signers
ownerPK || (authorizedPK && validConstraints)
```

### ❌ Missing Signature Checks
```scala
// BAD: Missing authentication
sigmaProp(OUTPUTS(0).value >= minValue)

// GOOD: Always gate with signatures
ownerPK && sigmaProp(OUTPUTS(0).value >= minValue)
```

### ❌ HEIGHT Misuse
```scala
// BAD: Using HEIGHT without proper bounds
sigmaProp(HEIGHT > deadline)  // Can be gamed with future blocks

// GOOD: Use HEIGHT with proper context
sigmaProp(HEIGHT > deadline && HEIGHT < deadline + 100)
```

### ❌ Token Loss
```scala
// BAD: Tokens not accounted for
// Missing: OUTPUTS(0).tokens check

// GOOD: Explicit token preservation or distribution
val tokenAccounted = OUTPUTS.fold(0L, { (acc, box) => 
  acc + box.tokens(0)._2 
}) == SELF.tokens(0)._2
```

## Code Conventions

### Naming
- **PK/pubKey**: Public keys (e.g., `ownerPK`, `alicePK`)
- **Script suffix**: For ErgoScript strings (e.g., `pinLockScript`)
- **Contract suffix**: For compiled contracts (e.g., `pinLockContract`)
- **Box suffix**: For box instances (e.g., `depositBox`, `outputBox`)
- **Transaction suffix**: For transaction objects (e.g., `depositTransaction`)

### Register Usage
- **R4**: Primary data (hash, identifier, or state value)
- **R5-R9**: Additional state, signatures, or metadata
- Always use `.get` with type annotation: `SELF.R4[Long].get`

### Value Handling
- Use `nanoergsInErg = 1000000000L` constant
- Account for `MinTxFee` in all transactions
- Subtract fee from output values: `value = amount - MinTxFee`

## Integration Points

### Core References
- **LangSpec**: ErgoScript language specification and type system
- **ergoscript-by-example**: 10+ contract examples (pin locks, swaps, escrow, games)
- **Ergo Playground**: Scastie-based testing environment
- **Appkit/Fleet**: SDK for production contract deployment

### Key Libraries
```scala
import scorex.crypto.hash.{Blake2b256, Digest32}  // Hashing
import org.ergoplatform.ErgoBox                   // Box types
import sigmastate.eval.Extensions._               // Utility extensions
```

## Important Workflows

### Contract Design Checklist
1. Define all spend paths (happy path + refunds/cancellation)
2. Verify token preservation if contract holds tokens
3. Add signature checks for all authenticated actions
4. Validate register data against trusted sources
5. Use HEIGHT carefully with upper/lower bounds
6. Document commit-reveal phases if applicable
7. Test state transitions through multiple rounds

### Audit Checklist
1. Check all registers (R4-R9) are validated
2. Verify no OR-branch bypasses exist
3. Confirm token/ERG conservation across all paths
4. Validate HEIGHT usage patterns
5. Ensure signatures gate critical operations
6. Test with malicious inputs and edge cases

## Key Examples
- **Pin Lock**: [ergoscript-by-example/pinLockContract.md](https://github.com/ergoplatform/ergoscript-by-example/blob/main/pinLockContract.md)
- **Heads or Tails**: Multi-stage commit-reveal game with refunds
- **Token Sales**: Self-replicating contract maintaining state
- **Escrow**: Three-party contract with validator and deadlines
