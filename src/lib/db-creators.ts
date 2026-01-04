// Database access layer for V2 Creator and Snippet operations
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db';
import type { SnippetCategory } from './config_v2';

// =====================================================
// TYPES
// =====================================================

export interface Creator {
  id: number;
  display_name: string;
  owner_address: string;
  payout_address: string;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Snippet {
  id: number;
  creator_id: number;
  title: string;
  summary: string | null;
  category: SnippetCategory;
  status: 'draft' | 'published' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface SnippetVersion {
  id: number;
  snippet_id: number;
  version: number;
  content: string;
  content_hash: string;
  price_nanoerg: string; // bigint stored as string
  created_at: Date;
}

export interface SnippetWithVersion extends Snippet {
  latest_version: number;
  latest_price_nanoerg: string;
  latest_content_hash: string;
}

// =====================================================
// CREATOR OPERATIONS
// =====================================================

export async function createCreator(data: {
  owner_address: string;
  display_name: string;
  payout_address: string;
  bio?: string;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO creators (owner_address, display_name, payout_address, bio)
     VALUES (?, ?, ?, ?)`,
    [data.owner_address, data.display_name, data.payout_address, data.bio || null]
  );
  return result.insertId;
}

export async function getCreatorById(id: number): Promise<Creator | null> {
  const [rows] = await pool.execute<(Creator & RowDataPacket)[]>(
    `SELECT * FROM creators WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getCreatorByPayoutAddress(
  address: string
): Promise<Creator | null> {
  const [rows] = await pool.execute<(Creator & RowDataPacket)[]>(
    `SELECT * FROM creators WHERE payout_address = ?`,
    [address]
  );
  return rows[0] || null;
}

export async function getCreatorByOwnerAddress(
  address: string
): Promise<Creator | null> {
  const [rows] = await pool.execute<(Creator & RowDataPacket)[]>(
    `SELECT * FROM creators WHERE owner_address = ?`,
    [address]
  );
  return rows[0] || null;
}

export async function updateCreator(
  id: number,
  data: Partial<Pick<Creator, 'display_name' | 'bio'>>
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.display_name !== undefined) {
    updates.push('display_name = ?');
    values.push(data.display_name);
  }
  if (data.bio !== undefined) {
    updates.push('bio = ?');
    values.push(data.bio);
  }

  if (updates.length === 0) return;

  values.push(id);
  await pool.execute(
    `UPDATE creators SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

// =====================================================
// SNIPPET OPERATIONS
// =====================================================

export async function createSnippet(data: {
  creator_id: number;
  title: string;
  summary?: string;
  category: SnippetCategory;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO snippets (creator_id, title, summary, category, status)
     VALUES (?, ?, ?, ?, 'draft')`,
    [data.creator_id, data.title, data.summary || null, data.category]
  );
  return result.insertId;
}

export async function getSnippetById(id: number): Promise<Snippet | null> {
  const [rows] = await pool.execute<(Snippet & RowDataPacket)[]>(
    `SELECT * FROM snippets WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getSnippetsByCreator(
  creatorId: number
): Promise<Snippet[]> {
  const [rows] = await pool.execute<(Snippet & RowDataPacket)[]>(
    `SELECT * FROM snippets WHERE creator_id = ? ORDER BY created_at DESC`,
    [creatorId]
  );
  return rows;
}

export async function getPublishedSnippets(
  category?: SnippetCategory
): Promise<SnippetWithVersion[]> {
  let query = `
    SELECT s.*, 
           MAX(sv.version) as latest_version,
           (SELECT price_nanoerg FROM snippet_versions WHERE snippet_id = s.id ORDER BY version DESC LIMIT 1) as latest_price_nanoerg,
           (SELECT content_hash FROM snippet_versions WHERE snippet_id = s.id ORDER BY version DESC LIMIT 1) as latest_content_hash
    FROM snippets s
    INNER JOIN snippet_versions sv ON sv.snippet_id = s.id
    WHERE s.status = 'published'
  `;
  const params: any[] = [];

  if (category) {
    query += ` AND s.category = ?`;
    params.push(category);
  }

  query += ` GROUP BY s.id ORDER BY s.created_at DESC`;

  const [rows] = await pool.execute<(SnippetWithVersion & RowDataPacket)[]>(
    query,
    params
  );
  return rows;
}

export async function updateSnippetStatus(
  id: number,
  status: 'draft' | 'published' | 'archived'
): Promise<void> {
  await pool.execute(`UPDATE snippets SET status = ? WHERE id = ?`, [
    status,
    id,
  ]);
}

// =====================================================
// SNIPPET VERSION OPERATIONS
// =====================================================

export async function createSnippetVersion(data: {
  snippet_id: number;
  content: string;
  content_hash: string;
  price_nanoerg: bigint;
}): Promise<number> {
  // Get next version number
  const [versionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(MAX(version), 0) + 1 as next_version 
     FROM snippet_versions WHERE snippet_id = ?`,
    [data.snippet_id]
  );
  const nextVersion = versionRows[0].next_version;

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.snippet_id,
      nextVersion,
      data.content,
      data.content_hash,
      data.price_nanoerg.toString(),
    ]
  );
  return result.insertId;
}

export async function getSnippetVersionById(
  id: number
): Promise<SnippetVersion | null> {
  const [rows] = await pool.execute<(SnippetVersion & RowDataPacket)[]>(
    `SELECT * FROM snippet_versions WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getSnippetVersionsBySnippet(
  snippetId: number
): Promise<SnippetVersion[]> {
  const [rows] = await pool.execute<(SnippetVersion & RowDataPacket)[]>(
    `SELECT * FROM snippet_versions WHERE snippet_id = ? ORDER BY version DESC`,
    [snippetId]
  );
  return rows;
}

export async function getLatestSnippetVersion(
  snippetId: number
): Promise<SnippetVersion | null> {
  const [rows] = await pool.execute<(SnippetVersion & RowDataPacket)[]>(
    `SELECT * FROM snippet_versions 
     WHERE snippet_id = ? 
     ORDER BY version DESC 
     LIMIT 1`,
    [snippetId]
  );
  return rows[0] || null;
}

// =====================================================
// CREATOR REVENUE QUERIES
// =====================================================

export async function getCreatorEarnings(
  creatorId: number
): Promise<{
  total_earned: string;
  confirmed_payments: number;
  pending_payments: number;
}> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
       COALESCE(SUM(CASE WHEN p.status = 'confirmed' THEN ci.price_nanoerg ELSE 0 END), 0) as total_earned,
       COUNT(DISTINCT CASE WHEN p.status = 'confirmed' THEN p.id END) as confirmed_payments,
       COUNT(DISTINCT CASE WHEN p.status = 'submitted' THEN p.id END) as pending_payments
     FROM composition_items ci
     INNER JOIN compositions c ON c.id = ci.composition_id
     INNER JOIN payments p ON p.composition_id = c.id
     INNER JOIN snippet_versions sv ON sv.id = ci.snippet_version_id
     INNER JOIN snippets s ON s.id = sv.snippet_id
     WHERE s.creator_id = ?`,
    [creatorId]
  );

  return {
    total_earned: rows[0]?.total_earned?.toString() || '0',
    confirmed_payments: rows[0]?.confirmed_payments || 0,
    pending_payments: rows[0]?.pending_payments || 0,
  };
}

export async function getSnippetUsageStats(snippetId: number): Promise<{
  usage_count: number;
  total_earned: string;
}> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
       COUNT(DISTINCT ci.composition_id) as usage_count,
       COALESCE(SUM(ci.price_nanoerg), 0) as total_earned
     FROM composition_items ci
     INNER JOIN snippet_versions sv ON sv.id = ci.snippet_version_id
     INNER JOIN compositions c ON c.id = ci.composition_id
     INNER JOIN payments p ON p.composition_id = c.id
     WHERE sv.snippet_id = ? AND p.status = 'confirmed'`,
    [snippetId]
  );

  return {
    usage_count: rows[0]?.usage_count || 0,
    total_earned: rows[0]?.total_earned?.toString() || '0',
  };
}
