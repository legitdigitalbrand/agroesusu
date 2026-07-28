// ============================================================================
// Journal Entry Management
// 
// Functions for creating, posting, and reversing journal entries.
// The Orchestrator is the ONLY caller of these functions — no other module
// should write to journal_entries or journal_lines.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { JournalLineInput } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Create a draft journal entry.
 * Lines are added separately via addJournalLines().
 * The entry stays as 'draft' until postJournalEntry() is called.
 */
export async function createJournalEntry(
  description: string,
  sourceModule: string = 'orchestrator',
  transactionId?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      entry_type: 'standard',
      status: 'draft',
      description,
      source_module: sourceModule,
      transaction_id: transactionId || null,
      metadata: metadata || {},
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create journal entry: ${error.message}`);
  return data.id;
}

/**
 * Add journal lines to a draft entry.
 * The entry must be in 'draft' status (enforced by DB trigger).
 */
export async function addJournalLines(
  entryId: string,
  lines: JournalLineInput[]
): Promise<void> {
  const supabase = getServiceClient();

  const rows = lines.map((line, index) => ({
    journal_entry_id: entryId,
    account_id: line.account_id,
    entry_type: line.entry_type,
    amount: line.amount,
    description: line.description || null,
    line_order: index + 1,
  }));

  const { error } = await supabase.from('journal_lines').insert(rows);

  if (error) {
    throw new Error(`Failed to add journal lines: ${error.message}`);
  }
}

/**
 * Post a journal entry.
 * Validates that lines sum to zero (debits = credits) before posting.
 * If validation fails, the entry stays as 'draft' and an error is thrown.
 */
export async function postJournalEntry(entryId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase.rpc('post_journal_entry', { p_entry_id: entryId });

  if (error) {
    throw new Error(`Failed to post journal entry ${entryId}: ${error.message}`);
  }
}

/**
 * Reverse a posted journal entry.
 * Creates a new entry with opposite debits/credits and marks the original as 'reversed'.
 * Returns the reversal entry's ID.
 */
export async function reverseJournalEntry(
  originalEntryId: string,
  reason: string,
  createdBy?: string
): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('reverse_journal_entry', {
    p_original_id: originalEntryId,
    p_reason: reason,
    p_created_by: createdBy || null,
  });

  if (error) {
    throw new Error(`Failed to reverse journal entry ${originalEntryId}: ${error.message}`);
  }

  return data as string;
}

/**
 * Get a journal entry with its lines (for audit/display).
 */
export async function getJournalEntryWithLines(entryId: string): Promise<{
  entry: Record<string, unknown>;
  lines: Record<string, unknown>[];
}> {
  const supabase = getServiceClient();

  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (entryError) throw new Error(`Entry not found: ${entryError.message}`);

  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .select('*')
    .eq('journal_entry_id', entryId)
    .order('line_order', { ascending: true });

  if (linesError) throw new Error(`Failed to fetch lines: ${linesError.message}`);

  return { entry, lines: lines || [] };
}
