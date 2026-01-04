/**
 * Seed Test Data: Create snippets for recommendation testing
 */

import { pool } from '../src/lib/db';
import { createHash } from 'crypto';

interface TestSnippet {
  title: string;
  summary: string;
  category: string;
  tags: string;
  content: string;
  priceNanoerg: number;
}

const TEST_SNIPPETS: TestSnippet[] = [
  {
    title: 'Professional Tone Enforcer',
    summary: 'Ensures all responses maintain a formal, professional tone suitable for business communications',
    category: 'tone',
    tags: 'professional, formal, business, corporate, polite',
    content: `You must maintain a professional, formal tone in all responses. Guidelines:
- Use proper grammar and complete sentences
- Avoid slang, colloquialisms, and casual language
- Address users respectfully (e.g., "you" not "u")
- Use professional vocabulary appropriate for business contexts
- Maintain objectivity and avoid emotional language
- When uncertain, default to more formal rather than less formal`,
    priceNanoerg: 10_000_000, // 0.01 ERG
  },
  {
    title: 'JSON Output Format Enforcer',
    summary: 'Forces structured JSON output format for programmatic consumption',
    category: 'format',
    tags: 'json, structured, output, format, api, data',
    content: `You must output valid JSON only. Rules:
- NEVER include explanatory text before or after JSON
- Use proper JSON syntax (double quotes, no trailing commas)
- Structure: { "result": <your response>, "metadata": {...} }
- For errors: { "error": "message", "code": 400 }
- Always validate JSON before outputting
- If user asks a question, put answer in "result" field`,
    priceNanoerg: 8_000_000, // 0.008 ERG
  },
  {
    title: 'Customer Escalation Handler',
    summary: 'Manages customer escalation scenarios with empathy and clear protocols',
    category: 'guardrail',
    tags: 'escalation, customer support, conflict, resolution, protocol',
    content: `When customer issues escalate, follow this protocol:
1. ACKNOWLEDGE: Recognize their concern immediately ("I understand your frustration...")
2. EMPATHIZE: Show genuine understanding without making excuses
3. ASSESS: Determine severity (low/medium/high)
4. ACTION: 
   - Low: Provide solution directly
   - Medium: Offer supervisor callback within 24h
   - High: Escalate immediately to manager
5. DOCUMENT: Note all details for follow-up
6. FOLLOW-UP: Confirm resolution within 48 hours
NEVER: blame customer, make promises you can't keep, end conversation without resolution path`,
    priceNanoerg: 15_000_000, // 0.015 ERG
  },
  {
    title: 'Context Preservation System',
    summary: 'Maintains conversation context across multiple interactions',
    category: 'context',
    tags: 'context, memory, conversation, history, continuity',
    content: `Maintain conversation context throughout the interaction:
- Track key user information (name, issue, preferences)
- Reference previous statements naturally ("As you mentioned earlier...")
- Build on prior responses rather than repeating
- If context is lost, ask clarifying questions
- Summarize periodically for complex topics
- Store important facts for later reference`,
    priceNanoerg: 12_000_000, // 0.012 ERG
  },
  {
    title: 'Accuracy Verification Guard',
    summary: 'Ensures factual accuracy and prevents hallucinations',
    category: 'eval',
    tags: 'accuracy, verification, facts, hallucination, validation',
    content: `Before providing factual information:
1. Assess confidence level (high/medium/low)
2. If low confidence: State uncertainty explicitly
3. Provide sources when available
4. Distinguish between facts and opinions
5. Never invent data, statistics, or citations
6. If unsure, say "I don't have verified information on this"
7. Offer to help find authoritative sources
CRITICAL: Better to admit uncertainty than provide false information`,
    priceNanoerg: 18_000_000, // 0.018 ERG
  },
];

async function seedSnippets() {
  console.log('================================================================================');
  console.log('SEEDING TEST SNIPPETS');
  console.log('================================================================================\n');

  try {
    // Check if creator exists
    const [creatorRows] = await pool.execute(
      'SELECT id, display_name, payout_address FROM creators LIMIT 1'
    );

    let creatorId: number;
    let payoutAddress: string;

    if ((creatorRows as any[]).length === 0) {
      // Create test creator
      console.log('Creating test creator...');
      const testPayoutAddress = '3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz';
      const testOwnerAddress = '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB';
      
      const [result] = await pool.execute(
        'INSERT INTO creators (display_name, payout_address, owner_address, bio) VALUES (?, ?, ?, ?)',
        ['Test Creator', testPayoutAddress, testOwnerAddress, 'Test creator for snippet recommendations']
      );
      
      creatorId = (result as any).insertId;
      payoutAddress = testPayoutAddress;
      console.log(`✓ Created creator ID ${creatorId}\n`);
    } else {
      const creator = (creatorRows as any[])[0];
      creatorId = creator.id;
      payoutAddress = creator.payout_address;
      console.log(`✓ Using existing creator: ${creator.display_name} (ID ${creatorId})\n`);
    }

    // Insert snippets
    for (const snippet of TEST_SNIPPETS) {
      console.log(`Creating snippet: ${snippet.title}`);

      // Insert snippet
      const [snippetResult] = await pool.execute(
        `INSERT INTO snippets (creator_id, title, summary, category, tags, status)
         VALUES (?, ?, ?, ?, ?, 'published')`,
        [creatorId, snippet.title, snippet.summary, snippet.category, snippet.tags]
      );

      const snippetId = (snippetResult as any).insertId;

      // Compute content hash
      const contentHash = createHash('sha256').update(snippet.content).digest('hex');

      // Insert snippet version
      await pool.execute(
        `INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg)
         VALUES (?, 1, ?, ?, ?)`,
        [snippetId, snippet.content, contentHash, snippet.priceNanoerg]
      );

      console.log(`  ✓ Snippet ID ${snippetId}, Version 1, ${(snippet.priceNanoerg / 1e9).toFixed(3)} ERG`);
    }

    console.log('\n================================================================================');
    console.log('SEED COMPLETE');
    console.log('================================================================================');
    console.log(`Created ${TEST_SNIPPETS.length} snippets`);
    console.log(`Total value: ${(TEST_SNIPPETS.reduce((sum, s) => sum + s.priceNanoerg, 0) / 1e9).toFixed(3)} ERG\n`);

    console.log('Test the recommendations API:');
    console.log('  curl -X POST http://localhost:3000/api/recommendations \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"userPrompt":"professional customer support with JSON output","limit":5}\'\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ SEED FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedSnippets();
