export function getOptimizedImageUrl(
  url: string | null | undefined,
  options?: { width?: number; height?: number; quality?: number; format?: 'webp' | 'origin' }
): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes('/storage/v1/object/public/')) return url;

    if (options?.width) parsed.searchParams.set('width', String(options.width));
    if (options?.height) parsed.searchParams.set('height', String(options.height));
    if (options?.quality) parsed.searchParams.set('quality', String(options.quality));
    if (options?.format && options.format !== 'origin') {
      parsed.searchParams.set('format', options.format);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
