/**
 * Turn an on-screen SVG into a PNG (same approach as downloadCardPng in components/id-card.tsx):
 * clone it, inline every <image> as a data URL so the canvas isn't tainted, draw it, export.
 */

export async function urlToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  const response = await fetch(new URL(url, window.location.href).href, { mode: 'cors' });
  if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  for (const img of Array.from(clone.querySelectorAll('image'))) {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
    try { img.setAttribute('href', await urlToDataUrl(href)); } catch { /* leave as is; it may still draw */ }
  }
  const view = svg.viewBox.baseVal;
  const width = Math.round((view && view.width ? view.width : svg.clientWidth) * scale);
  const height = Math.round((view && view.height ? view.height : svg.clientHeight) * scale);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render the image.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the PNG.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mypetid';
}
