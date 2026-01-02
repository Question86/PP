// Composition Selection Algorithm
// This module contains the PRIVATE algorithm for snippet selection
// MVP Implementation: Baseline keyword matching
// Production: Replace with sophisticated NLP/ML-based selection

import {
  getPublishedSnippets,
  type SnippetWithVersion,
} from './db-creators';
import { LIMITS, type SnippetCategory } from './config_v2';

// =====================================================
// TYPES
// =====================================================

export interface SelectionCandidate {
  snippet_version_id: number;
  snippet_id: number;
  snippet_title: string;
  snippet_summary: string | null;
  snippet_category: SnippetCategory;
  price_nanoerg: string;
  creator_payout_address: string;
  score: number; // Internal score (NOT exposed to users)
  rationale?: string; // Optional user-facing explanation
}

export interface SelectionResult {
  candidates: SelectionCandidate[];
  total_count: number;
  total_price_nanoerg: bigint;
}

// =====================================================
// BASELINE SELECTOR (MVP)
// =====================================================

/**
 * Baseline selection algorithm using keyword matching
 * This is a simple MVP implementation - replace with sophisticated logic
 */
export async function proposeComposition(
  userPrompt: string
): Promise<SelectionResult> {
  // Normalize prompt
  const normalizedPrompt = userPrompt.toLowerCase().trim();

  // Get all published snippets with latest versions
  const allSnippets = await getPublishedSnippets();

  // Score each snippet
  const scoredCandidates: SelectionCandidate[] = [];

  for (const snippet of allSnippets) {
    const score = calculateRelevanceScore(normalizedPrompt, snippet);

    if (score > 0) {
      scoredCandidates.push({
        snippet_version_id: snippet.id, // Using latest version
        snippet_id: snippet.id,
        snippet_title: snippet.title,
        snippet_summary: snippet.summary,
        snippet_category: snippet.category,
        price_nanoerg: snippet.latest_price_nanoerg,
        creator_payout_address: '', // Will be fetched when building composition
        score,
        rationale: generateRationale(normalizedPrompt, snippet),
      });
    }
  }

  // Sort by score (descending) then by price (ascending)
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      Number(BigInt(a.price_nanoerg)) - Number(BigInt(b.price_nanoerg))
    );
  });

  // Limit to MAX_SNIPPETS_PER_COMPOSITION
  const selected = scoredCandidates.slice(
    0,
    LIMITS.MAX_SNIPPETS_PER_COMPOSITION
  );

  // Calculate total price
  const totalPrice = selected.reduce(
    (sum, candidate) => sum + BigInt(candidate.price_nanoerg),
    0n
  );

  return {
    candidates: selected,
    total_count: selected.length,
    total_price_nanoerg: totalPrice,
  };
}

// =====================================================
// SCORING LOGIC (PRIVATE - Baseline)
// =====================================================

/**
 * Calculate relevance score for a snippet based on user prompt
 * Returns 0-100 score
 */
function calculateRelevanceScore(
  prompt: string,
  snippet: SnippetWithVersion
): number {
  let score = 0;

  // Category-based scoring
  const categoryKeywords: Record<SnippetCategory, string[]> = {
    guardrail: ['safe', 'protect', 'prevent', 'block', 'filter', 'secure'],
    format: [
      'json',
      'xml',
      'markdown',
      'format',
      'structure',
      'output',
      'table',
    ],
    tone: [
      'professional',
      'casual',
      'friendly',
      'formal',
      'tone',
      'style',
      'voice',
    ],
    eval: ['evaluate', 'assess', 'score', 'rate', 'quality', 'check'],
    tooling: ['tool', 'function', 'api', 'execute', 'call', 'integrate'],
    context: ['context', 'background', 'system', 'role', 'persona'],
    other: [],
  };

  // Check category keywords
  const keywords = categoryKeywords[snippet.category] || [];
  for (const keyword of keywords) {
    if (prompt.includes(keyword)) {
      score += 20;
      break; // Only add category bonus once
    }
  }

  // Check title match
  const titleWords = snippet.title.toLowerCase().split(/\s+/);
  for (const word of titleWords) {
    if (word.length > 3 && prompt.includes(word)) {
      score += 15;
    }
  }

  // Check summary match
  if (snippet.summary) {
    const summaryWords = snippet.summary.toLowerCase().split(/\s+/);
    for (const word of summaryWords) {
      if (word.length > 4 && prompt.includes(word)) {
        score += 10;
      }
    }
  }

  // Base relevance for published snippets
  if (score === 0) {
    score = 5; // Minimum score for any published snippet
  }

  return Math.min(score, 100);
}

// =====================================================
// RATIONALE GENERATION (User-Facing)
// =====================================================

/**
 * Generate user-friendly explanation for why snippet was selected
 * This is shown to users - keep it generic, don't reveal algorithm details
 */
function generateRationale(
  prompt: string,
  snippet: SnippetWithVersion
): string {
  const category = snippet.category;

  const rationaleTemplates: Record<SnippetCategory, string> = {
    guardrail:
      'Recommended for safety and content filtering based on your requirements',
    format:
      'Helps structure output in the desired format mentioned in your prompt',
    tone: 'Matches the communication style you described',
    eval: 'Useful for quality assessment and evaluation tasks',
    tooling: 'Provides capabilities for tool integration and execution',
    context: 'Sets up the appropriate context for your use case',
    other: 'Relevant to your request based on content analysis',
  };

  return rationaleTemplates[category] || 'Recommended based on your prompt';
}

// =====================================================
// CONFLICT DETECTION (Phase 2+)
// =====================================================

/**
 * Detect conflicting snippets in selection
 * Example: "strict_json" conflicts with "freeform_text"
 * This is a placeholder for future sophisticated conflict detection
 */
export function detectConflicts(
  candidates: SelectionCandidate[]
): { conflict: boolean; message?: string } {
  // MVP: No conflict detection
  // Phase 2: Implement category-based rules
  // Example: Can't have both 'strict format' and 'creative format'

  const categories = new Set(candidates.map((c) => c.category));

  // Simple rule: Only one format snippet allowed (for MVP demonstration)
  const formatSnippets = candidates.filter((c) => c.category === 'format');
  if (formatSnippets.length > 2) {
    return {
      conflict: true,
      message: 'Multiple formatting requirements detected - using highest scored',
    };
  }

  return { conflict: false };
}

// =====================================================
// ADVANCED FEATURES (Placeholders for Phase 2+)
// =====================================================

/**
 * Score adjustment based on snippet usage history
 * Popular snippets get slight boost
 */
export function adjustScoreByPopularity(
  score: number,
  usageCount: number
): number {
  // Phase 2: Implement popularity boosting
  // For MVP: No adjustment
  return score;
}

/**
 * Diversify selection to include snippets from multiple creators
 * Prevents over-reliance on single creator
 */
export function diversifyByCreator(
  candidates: SelectionCandidate[]
): SelectionCandidate[] {
  // Phase 2: Implement creator diversity
  // For MVP: No diversification
  return candidates;
}

/**
 * Price-aware selection
 * Balance quality vs cost based on user preferences
 */
export function optimizeByPrice(
  candidates: SelectionCandidate[],
  maxBudget?: bigint
): SelectionCandidate[] {
  if (!maxBudget) return candidates;

  // Filter to stay under budget
  let total = 0n;
  const withinBudget: SelectionCandidate[] = [];

  for (const candidate of candidates) {
    const newTotal = total + BigInt(candidate.price_nanoerg);
    if (newTotal <= maxBudget) {
      withinBudget.push(candidate);
      total = newTotal;
    }
  }

  return withinBudget;
}
