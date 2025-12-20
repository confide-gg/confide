const MAX_FILE_SIZE = 100 * 1024 * 1024;

const BLOCKED_EXTENSIONS = [
  '.exe', '.dmg', '.app', '.bat', '.cmd', '.com', '.msi',
  '.scr', '.vbs', '.jar', '.deb', '.rpm', '.apk', '.ipa',
  '.dll', '.so', '.dylib', '.sys'
];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 100MB)' };
  }

  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Executable files are not allowed' };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}
