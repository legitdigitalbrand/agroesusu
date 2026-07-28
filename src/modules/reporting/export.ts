// ============================================================================
// Export Infrastructure
// 
// Report generation and export mechanism.
// Supports CSV and JSON export. Every export is logged in report_generations
// for audit trail — who exported what, when, with what parameters.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Convert an array of objects to CSV format.
 */
export function toCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvLines = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Escape CSV: wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(','));
  }
  
  return csvLines.join('\n');
}

/**
 * Generate and log a report export.
 * 
 * Returns the report content (CSV or JSON) and logs the generation
 * in report_generations for audit trail.
 */
export async function exportReport(
  reportKey: string,
  reportName: string,
  data: Record<string, unknown>[],
  format: 'csv' | 'json',
  generatedBy: string,
  parameters?: Record<string, unknown>,
): Promise<{ content: string; format: string; row_count: number }> {
  const supabase = getServiceClient();

  const content = format === 'csv' ? toCSV(data) : JSON.stringify(data, null, 2);

  // Log the report generation for audit trail
  const { error } = await supabase.from('report_generations').insert({
    report_type: reportKey,
    report_name: reportName,
    generated_by: generatedBy,
    parameters: parameters || {},
    file_format: format,
    row_count: data.length,
    metadata: { generated_at: new Date().toISOString() },
  });

  if (error) {
    console.error('Failed to log report generation:', error.message);
    // Don't fail the export if logging fails — but surface the error
  }

  return {
    content,
    format,
    row_count: data.length,
  };
}

/**
 * Get report generation history (audit trail of exports).
 */
export async function getReportGenerationHistory(limit: number = 50): Promise<unknown[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('report_generations')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to get report generation history: ${error.message}`);
  return data || [];
}
