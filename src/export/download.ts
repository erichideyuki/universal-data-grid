/**
 * Baixa `blob` como `fileName`: `<a download>` com URL de objeto, revogada
 * logo depois (revogar na hora pode cortar o download em alguns
 * navegadores; o timer só segura a URL, não o grid).
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
