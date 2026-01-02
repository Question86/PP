/**
 * Database operations for prompts
 */
import { query } from './db';
import { Prompt, PromptStatus } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface PromptRow extends RowDataPacket {
  id: number;
  owner_address: string;
  prompt_text: string;
  prompt_hash: string;
  status: PromptStatus;
  mint_tx_id: string | null;
  token_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createPrompt(
  ownerAddress: string,
  promptText: string,
  promptHash: string
): Promise<number> {
  const sql = `
    INSERT INTO prompts (owner_address, prompt_text, prompt_hash, status)
    VALUES (?, ?, ?, 'stored')
  `;
  
  const result = await query<ResultSetHeader>(sql, [ownerAddress, promptText, promptHash]);
  return result.insertId;
}

export async function getPromptById(id: number): Promise<Prompt | null> {
  const sql = `
    SELECT * FROM prompts WHERE id = ?
  `;
  
  const rows = await query<PromptRow[]>(sql, [id]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return rows[0] as Prompt;
}

export async function getPromptsByOwner(ownerAddress: string): Promise<Prompt[]> {
  const sql = `
    SELECT * FROM prompts 
    WHERE owner_address = ?
    ORDER BY created_at DESC
  `;
  
  const rows = await query<PromptRow[]>(sql, [ownerAddress]);
  return rows as Prompt[];
}

export async function updatePromptMintStatus(
  id: number,
  status: PromptStatus,
  txId?: string,
  tokenId?: string
): Promise<void> {
  const sql = `
    UPDATE prompts
    SET status = ?, mint_tx_id = ?, token_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  await query(sql, [status, txId || null, tokenId || null, id]);
}

export async function getPromptByTokenId(tokenId: string): Promise<Prompt | null> {
  const sql = `
    SELECT * FROM prompts WHERE token_id = ?
  `;
  
  const rows = await query<PromptRow[]>(sql, [tokenId]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return rows[0] as Prompt;
}
