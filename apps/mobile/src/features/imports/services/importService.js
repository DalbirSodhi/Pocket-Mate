import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Papa from 'papaparse';

import { supabase } from '../../../infrastructure/supabase/client';
import { normalizeCsvTransactions } from '../utils/csvTransactionNormalizer.cjs';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

export async function chooseAndParseCsv(userId) {
  const selection = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  const text = await new File(asset.uri).text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0].message || 'Unable to parse this CSV file.');
  }
  const fingerprintResponse = await supabase
    .from('transaction_import_rows')
    .select('fingerprint')
    .eq('user_id', userId)
    .eq('status', 'posted')
    .limit(10000);
  const existingFingerprints = unwrap(fingerprintResponse).map((row) => row.fingerprint);
  return {
    fileName: asset.name || 'transactions.csv',
    ...normalizeCsvTransactions(parsed.data, { existingFingerprints }),
    parserWarnings: parsed.errors.map((error) => error.message),
  };
}

export async function importTransactions({ userId, preview, categoryId, accountId }) {
  const rows = preview.transactions.map((row) => ({
    ...row,
    categoryId: row.categoryId || (row.type === 'expense' ? categoryId : null),
    accountId: Object.prototype.hasOwnProperty.call(row, 'accountId')
      ? row.accountId
      : accountId || null,
  }));
  const missingCategoryRow = rows.find(
    (row) => row.type === 'expense' && !row.categoryId,
  );

  if (missingCategoryRow) {
    throw new Error(`Choose a category for row ${missingCategoryRow.sourceRowNumber}.`);
  }

  const batchResponse = await supabase
    .from('transaction_import_batches')
    .insert({ user_id: userId, file_name: preview.fileName, row_count: preview.acceptedCount + preview.rejectedCount })
    .select('id')
    .single();
  if (batchResponse.error) throw batchResponse.error;
  const batchId = batchResponse.data.id;
  const importRows = rows.map((row) => ({
    batch_id: batchId,
    user_id: userId,
    row_number: row.sourceRowNumber,
    transaction_type: row.type,
    amount_cents: row.amountCents,
    occurred_on: row.date,
    description: row.description,
    category_id: row.type === 'expense' ? row.categoryId : null,
    account_id: row.accountId,
    fingerprint: row.fingerprint,
    raw_data: row,
  }));
  if (importRows.length) {
    const rowResponse = await supabase.from('transaction_import_rows').insert(importRows);
    if (rowResponse.error) {
      await supabase.from('transaction_import_batches').delete().eq('id', batchId).eq('user_id', userId);
      throw rowResponse.error;
    }
  }
  const commitResponse = await supabase.rpc('commit_transaction_import', { p_batch_id: batchId });
  if (commitResponse.error) throw commitResponse.error;
  return { batchId, postedCount: Number(commitResponse.data || 0) };
}

export async function getImportHistory(userId) {
  const response = await supabase
    .from('transaction_import_batches')
    .select('id, file_name, status, row_count, posted_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return unwrap(response);
}

export async function rollbackImport(batchId) {
  const response = await supabase.rpc('rollback_transaction_import', { p_batch_id: batchId });
  if (response.error) throw response.error;
  return Number(response.data || 0);
}
