// Database access layer for V2 User Requests and Compositions
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db';

// =====================================================
// TYPES
// =====================================================

export interface Request {
  id: number;
  user_address: string;
  user_prompt: string;
  created_at: Date;
}

export interface Composition {
  id: number;
  request_id: number;
  user_address: string;
  status: 'proposed' | 'awaiting_payment' | 'paid' | 'failed';
  total_price_nanoerg: string;
  platform_fee_nanoerg: string;
  tx_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompositionItem {
  id: number;
  composition_id: number;
  snippet_version_id: number;
  creator_payout_address: string;
  price_nanoerg: string;
  position: number;
}

export interface Payment {
  id: number;
  composition_id: number;
  tx_id: string;
  status: 'submitted' | 'confirmed' | 'rejected';
  confirmed_at: Date | null;
  created_at: Date;
}

// Extended types with joined data
export interface CompositionWithItems extends Composition {
  items: (CompositionItem & {
    snippet_title: string;
    snippet_summary: string | null;
    creator_name: string;
    snippet_category: string;
  })[];
}

// =====================================================
// REQUEST OPERATIONS
// =====================================================

export async function createRequest(data: {
  user_address: string;
  user_prompt: string;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO requests (user_address, user_prompt) VALUES (?, ?)`,
    [data.user_address, data.user_prompt]
  );
  return result.insertId;
}

export async function getRequestById(id: number): Promise<Request | null> {
  const [rows] = await pool.execute<(Request & RowDataPacket)[]>(
    `SELECT * FROM requests WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getRequestsByUser(
  userAddress: string
): Promise<Request[]> {
  const [rows] = await pool.execute<(Request & RowDataPacket)[]>(
    `SELECT * FROM requests WHERE user_address = ? ORDER BY created_at DESC`,
    [userAddress]
  );
  return rows;
}

// =====================================================
// COMPOSITION OPERATIONS
// =====================================================

export async function createComposition(data: {
  request_id: number;
  user_address: string;
  total_price_nanoerg: bigint;
  platform_fee_nanoerg: bigint;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO compositions (request_id, user_address, status, total_price_nanoerg, platform_fee_nanoerg)
     VALUES (?, ?, 'proposed', ?, ?)`,
    [
      data.request_id,
      data.user_address,
      data.total_price_nanoerg.toString(),
      data.platform_fee_nanoerg.toString(),
    ]
  );
  return result.insertId;
}

export async function getCompositionById(
  id: number
): Promise<Composition | null> {
  const [rows] = await pool.execute<(Composition & RowDataPacket)[]>(
    `SELECT * FROM compositions WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getCompositionWithItems(
  id: number
): Promise<CompositionWithItems | null> {
  const [compRows] = await pool.execute<(Composition & RowDataPacket)[]>(
    `SELECT * FROM compositions WHERE id = ?`,
    [id]
  );

  if (!compRows[0]) return null;

  const [itemRows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
       ci.*,
       s.title as snippet_title,
       s.summary as snippet_summary,
       s.category as snippet_category,
       c.display_name as creator_name
     FROM composition_items ci
     INNER JOIN snippet_versions sv ON sv.id = ci.snippet_version_id
     INNER JOIN snippets s ON s.id = sv.snippet_id
     INNER JOIN creators c ON c.id = s.creator_id
     WHERE ci.composition_id = ?
     ORDER BY ci.position ASC`,
    [id]
  );

  return {
    ...compRows[0],
    items: itemRows as any,
  };
}

export async function getCompositionsByUser(
  userAddress: string
): Promise<Composition[]> {
  const [rows] = await pool.execute<(Composition & RowDataPacket)[]>(
    `SELECT * FROM compositions 
     WHERE user_address = ? 
     ORDER BY created_at DESC`,
    [userAddress]
  );
  return rows;
}

export async function updateCompositionStatus(
  id: number,
  status: Composition['status'],
  txId?: string
): Promise<void> {
  if (txId) {
    await pool.execute(
      `UPDATE compositions SET status = ?, tx_id = ? WHERE id = ?`,
      [status, txId, id]
    );
  } else {
    await pool.execute(`UPDATE compositions SET status = ? WHERE id = ?`, [
      status,
      id,
    ]);
  }
}

// =====================================================
// COMPOSITION ITEM OPERATIONS
// =====================================================

export async function createCompositionItems(
  items: Omit<CompositionItem, 'id'>[]
): Promise<void> {
  if (items.length === 0) return;

  const values = items
    .map(
      (item) =>
        `(${item.composition_id}, ${item.snippet_version_id}, '${item.creator_payout_address}', ${item.price_nanoerg}, ${item.position})`
    )
    .join(', ');

  await pool.execute(
    `INSERT INTO composition_items (composition_id, snippet_version_id, creator_payout_address, price_nanoerg, position)
     VALUES ${values}`
  );
}

export async function getCompositionItems(
  compositionId: number
): Promise<CompositionItem[]> {
  const [rows] = await pool.execute<(CompositionItem & RowDataPacket)[]>(
    `SELECT * FROM composition_items 
     WHERE composition_id = ? 
     ORDER BY position ASC`,
    [compositionId]
  );
  return rows;
}

// =====================================================
// PAYMENT OPERATIONS
// =====================================================

export async function createPayment(data: {
  composition_id: number;
  tx_id: string;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO payments (composition_id, tx_id, status)
     VALUES (?, ?, 'submitted')`,
    [data.composition_id, data.tx_id]
  );
  return result.insertId;
}

export async function getPaymentByTxId(txId: string): Promise<Payment | null> {
  const [rows] = await pool.execute<(Payment & RowDataPacket)[]>(
    `SELECT * FROM payments WHERE tx_id = ?`,
    [txId]
  );
  return rows[0] || null;
}

export async function getPaymentsByComposition(
  compositionId: number
): Promise<Payment[]> {
  const [rows] = await pool.execute<(Payment & RowDataPacket)[]>(
    `SELECT * FROM payments 
     WHERE composition_id = ? 
     ORDER BY created_at DESC`,
    [compositionId]
  );
  return rows;
}

export async function updatePaymentStatus(
  txId: string,
  status: 'confirmed' | 'rejected'
): Promise<void> {
  const confirmedAt = status === 'confirmed' ? new Date() : null;
  await pool.execute(
    `UPDATE payments SET status = ?, confirmed_at = ? WHERE tx_id = ?`,
    [status, confirmedAt, txId]
  );
}

// =====================================================
// AGGREGATION HELPERS (FOR PAYMENT INTENT)
// =====================================================

export interface CreatorPayout {
  creator_address: string;
  total_amount: string;
  snippet_count: number;
  snippet_version_ids: number[];
}

export async function getAggregatedCreatorPayouts(
  compositionId: number
): Promise<CreatorPayout[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
       creator_payout_address as creator_address,
       SUM(price_nanoerg) as total_amount,
       COUNT(*) as snippet_count,
       GROUP_CONCAT(snippet_version_id) as snippet_version_ids
     FROM composition_items
     WHERE composition_id = ?
     GROUP BY creator_payout_address`,
    [compositionId]
  );

  return rows.map((row) => ({
    creator_address: row.creator_address,
    total_amount: row.total_amount.toString(),
    snippet_count: row.snippet_count,
    snippet_version_ids: row.snippet_version_ids
      .split(',')
      .map((id: string) => parseInt(id)),
  }));
}

// =====================================================
// STATISTICS
// =====================================================

export async function getUserStats(userAddress: string): Promise<{
  total_compositions: number;
  paid_compositions: number;
  total_spent_nanoerg: string;
}> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
       COUNT(*) as total_compositions,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_compositions,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total_price_nanoerg ELSE 0 END), 0) as total_spent_nanoerg
     FROM compositions
     WHERE user_address = ?`,
    [userAddress]
  );

  return {
    total_compositions: rows[0]?.total_compositions || 0,
    paid_compositions: rows[0]?.paid_compositions || 0,
    total_spent_nanoerg: rows[0]?.total_spent_nanoerg?.toString() || '0',
  };
}
