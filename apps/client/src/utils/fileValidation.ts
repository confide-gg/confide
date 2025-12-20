const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_TYPES = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 100MB)' };
  }

  if (!ALLOWED_TYPES.some(type => file.type.startsWith(type))) {
    return { valid: false, error: 'File type not allowed' };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}
