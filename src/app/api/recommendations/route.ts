/**
 * POST /api/recommendations
 * Generate snippet recommendations based on user prompt
 * Uses deterministic keyword matching and scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface RecommendationRequest {
  userPrompt: string;
  limit?: number;
}

interface SnippetRecommendation {
  snippetId: number;
  versionId: number;
  title: string;
  summary: string | null;
  category: string;
  tags: string | null;
  priceNanoerg: string;
  creatorDisplayName: string;
  creatorPayoutAddress: string;
  score: number;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendationRequest = await request.json();

    // Validate input
    if (!body.userPrompt || body.userPrompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'userPrompt is required' },
        { status: 400 }
      );
    }

    const userPrompt = body.userPrompt.trim();
    const limit = body.limit && body.limit > 0 ? body.limit : 10;

    console.log(`[Recommendations] Searching for: "${userPrompt.substring(0, 100)}..."`);

    // Extract keywords from user prompt
    const keywords = extractKeywords(userPrompt);
    console.log(`[Recommendations] Keywords:`, keywords);

    // Build search query using MySQL MATCH AGAINST for fulltext search
    // Scoring algorithm:
    // - Fulltext relevance score (MySQL native): up to 10 points
    // - Category boost: +5 if category keywords match
    // - Popularity boost: +usage_count * 0.1
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         s.id as snippetId,
         sv.id as versionId,
         s.title,
         s.summary,
         s.category,
         s.tags,
         sv.price_nanoerg as priceNanoerg,
         c.display_name as creatorDisplayName,
         c.payout_address as creatorPayoutAddress,
         COALESCE(sus.usage_count, 0) as usage_count,
         MATCH(s.title, s.summary, s.tags) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance_score
       FROM snippets s
       INNER JOIN snippet_versions sv ON sv.snippet_id = s.id
       INNER JOIN creators c ON c.id = s.creator_id
       LEFT JOIN snippet_usage_stats sus ON sus.snippet_version_id = sv.id
       WHERE s.status = 'published'
         AND sv.version = (SELECT MAX(version) FROM snippet_versions WHERE snippet_id = s.id)
         AND (
           MATCH(s.title, s.summary, s.tags) AGAINST(? IN NATURAL LANGUAGE MODE)
           OR s.category IN (?)
           OR s.title LIKE ?
         )
       ORDER BY relevance_score DESC, usage_count DESC
       LIMIT ?`,
      [userPrompt, userPrompt, getCategoryKeywords(), `%${keywords[0] || ''}%`, limit]
    );

    console.log(`[Recommendations] Found ${rows.length} matches`);

    // Calculate final scores and reasons
    const recommendations: SnippetRecommendation[] = rows.map((row) => {
      const baseScore = row.relevance_score * 10; // MySQL relevance score
      const categoryBoost = matchesCategoryKeywords(row.category, keywords) ? 5 : 0;
      const popularityBoost = row.usage_count * 0.1;
      
      const totalScore = baseScore + categoryBoost + popularityBoost;
      
      // Generate explanation
      const reasons: string[] = [];
      if (row.relevance_score > 0.5) reasons.push('high relevance');
      if (categoryBoost > 0) reasons.push(`${row.category} match`);
      if (row.usage_count > 10) reasons.push('popular');
      
      const reason = reasons.length > 0 ? reasons.join(', ') : 'keyword match';

      return {
        snippetId: row.snippetId,
        versionId: row.versionId,
        title: row.title,
        summary: row.summary,
        category: row.category,
        tags: row.tags,
        priceNanoerg: row.priceNanoerg.toString(),
        creatorDisplayName: row.creatorDisplayName,
        creatorPayoutAddress: row.creatorPayoutAddress,
        score: Math.round(totalScore * 100) / 100,
        reason,
      };
    });

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      suggestions: recommendations,
      count: recommendations.length,
      keywords,
    });

  } catch (error: any) {
    console.error('[Recommendations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations', details: error.message },
      { status: 500 }
    );
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract meaningful keywords from user prompt
 * Simple tokenization: lowercase, split on non-alphanumeric, remove stopwords
 */
function extractKeywords(prompt: string): string[] {
  const stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'want', 'need', 'help', 'me',
    'my', 'we', 'you', 'can', 'could', 'should', 'would'
  ]);

  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 2 && !stopwords.has(word));

  // Return unique keywords, limit to 10
  return [...new Set(words)].slice(0, 10);
}

/**
 * Get category keywords for matching
 */
function getCategoryKeywords(): string[] {
  return ['guardrail', 'format', 'tone', 'eval', 'tooling', 'context'];
}

/**
 * Check if any keywords match the category
 */
function matchesCategoryKeywords(category: string, keywords: string[]): boolean {
  const categoryLower = category.toLowerCase();
  return keywords.some(kw => categoryLower.includes(kw) || kw.includes(categoryLower));
}
