import { compressImage } from '@/utils/image.utils';

const IMAGE_MIME_PREFIX = 'image/';

const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const GENERAL_MAX_BYTES = 30 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
  'application/acad',
  'application/dxf',
  'image/vnd.dwg',
  'model/vnd.dwf',
  'model/gltf+json',
  'model/gltf-binary',
  'model/stl',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'svg',
  'heic',
  'heif',
  'mp4',
  'webm',
  'mov',
  'mkv',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'rar',
  '7z',
  'dwg',
  'dxf',
  'rvt',
  'skp',
  'obj',
  'stl',
  'gltf',
  'glb',
]);

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; reason: 'file_too_large' | 'unsupported_file_type' };

export function getFileExtension(name: string): string {
  const ext = name.split('.').pop();
  return (ext || '').toLowerCase();
}

export function isImageMimeType(mime: string): boolean {
  return mime.startsWith(IMAGE_MIME_PREFIX);
}

export function validateUploadFile(file: File): UploadValidationResult {
  const ext = getFileExtension(file.name);
  const mimeAllowed = !file.type || ALLOWED_MIME_TYPES.has(file.type);
  const extAllowed = ALLOWED_EXTENSIONS.has(ext);

  if (!mimeAllowed && !extAllowed) {
    return { ok: false, reason: 'unsupported_file_type' };
  }

  const isImage = isImageMimeType(file.type) || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
  const maxSize = isImage ? IMAGE_MAX_BYTES : GENERAL_MAX_BYTES;

  if (file.size > maxSize) {
    return { ok: false, reason: 'file_too_large' };
  }

  return { ok: true };
}

function normalizeFileNameWithoutExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  return base.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'file';
}

export async function prepareFileForUpload(file: File): Promise<File> {
  if (!isImageMimeType(file.type)) return file;
  if (file.type === 'image/svg+xml') return file;

  const compressedBlob = await compressImage(file, 0.72, 1920, 1920, 'image/webp');
  const name = `${normalizeFileNameWithoutExtension(file.name)}.webp`;
  return new File([compressedBlob], name, { type: 'image/webp' });
}

export function makeStorageFileName(file: File): string {
  const safeBase = normalizeFileNameWithoutExtension(file.name);
  const ext = getFileExtension(file.name) || 'bin';
  const random = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}-${random}-${safeBase}.${ext}`;
}
