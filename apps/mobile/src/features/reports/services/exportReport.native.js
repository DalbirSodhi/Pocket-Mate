import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportReportFile({ fileName, contents }) {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error('File sharing is not available on this device.');
  }

  const file = new File(Paths.cache, fileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(`\uFEFF${contents}`);

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Export Pocket-Mate report',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });

  return { method: 'share', uri: file.uri };
}
