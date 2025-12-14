export type Theme = 'dark' | 'light' | 'amoled';

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  bgElevated: string;
  online: string;
}

export const THEMES: Record<Theme, { name: string; description: string; colors: ThemeColors }> = {
  dark: {
    name: 'Dark',
    description: 'Default theme in dark',
    colors: {
      background: '#18181b',
      foreground: '#e4e4e7',
      card: '#1e1e21',
      cardForeground: '#e4e4e7',
      popover: '#1e1e21',
      popoverForeground: '#e4e4e7',
      primary: '#c9ed7b',
      primaryForeground: '#18181b',
      secondary: '#27272a',
      secondaryForeground: '#e4e4e7',
      muted: '#52525b',
      mutedForeground: '#a1a1aa',
      accent: '#27272a',
      accentForeground: '#e4e4e7',
      destructive: '#ef4444',
      destructiveForeground: '#fafafa',
      border: '#27272a',
      input: '#27272a',
      ring: '#c9ed7b',
      bgElevated: '#1e1e21',
      online: '#22c55e',
    },
  },
  light: {
    name: 'Light',
    description: 'Default theme in light',
    colors: {
      background: '#ffffff',
      foreground: '#09090b',
      card: '#f4f4f5',
      cardForeground: '#09090b',
      popover: '#ffffff',
      popoverForeground: '#09090b',
      primary: '#8bc34a',
      primaryForeground: '#ffffff',
      secondary: '#f4f4f5',
      secondaryForeground: '#09090b',
      muted: '#a1a1aa',
      mutedForeground: '#71717a',
      accent: '#f4f4f5',
      accentForeground: '#09090b',
      destructive: '#ef4444',
      destructiveForeground: '#fafafa',
      border: '#e4e4e7',
      input: '#e4e4e7',
      ring: '#8bc34a',
      bgElevated: '#fafafa',
      online: '#22c55e',
    },
  },
  amoled: {
    name: 'AMOLED',
    description: 'Pure black for AMOLED displays',
    colors: {
      background: '#000000',
      foreground: '#e4e4e7',
      card: '#0a0a0a',
      cardForeground: '#e4e4e7',
      popover: '#0a0a0a',
      popoverForeground: '#e4e4e7',
      primary: '#c9ed7b',
      primaryForeground: '#000000',
      secondary: '#1a1a1a',
      secondaryForeground: '#e4e4e7',
      muted: '#52525b',
      mutedForeground: '#a1a1aa',
      accent: '#1a1a1a',
      accentForeground: '#e4e4e7',
      destructive: '#ef4444',
      destructiveForeground: '#fafafa',
      border: '#1a1a1a',
      input: '#1a1a1a',
      ring: '#c9ed7b',
      bgElevated: '#0a0a0a',
      online: '#22c55e',
    },
  },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const colors = THEMES[theme].colors;

  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--destructive', colors.destructive);
  root.style.setProperty('--destructive-foreground', colors.destructiveForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);
  root.style.setProperty('--ring', colors.ring);
  root.style.setProperty('--bg-elevated', colors.bgElevated);
  root.style.setProperty('--online', colors.online);
}
