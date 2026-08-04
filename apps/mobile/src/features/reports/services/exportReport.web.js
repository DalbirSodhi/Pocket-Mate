export async function exportReportFile({ fileName, contents }) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('File downloads are not available in this browser.');
  }

  const blob = new Blob([`\uFEFF${contents}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return { method: 'download' };
}
