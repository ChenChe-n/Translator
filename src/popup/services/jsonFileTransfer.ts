/**
 * 下载 JSON 文件。
 *
 * @param json JSON 文本。
 * @param prefix 文件名前缀。
 * @returns 无返回值。
 */
export function downloadJsonFile(json: string, prefix: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${formatTimestamp(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
