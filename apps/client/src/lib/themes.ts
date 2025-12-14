export type Theme =
  | 'dark'
  | 'light'
  | 'amoled'
  | 'nord'
  | 'catppuccin-mocha'
  | 'catppuccin-macchiato'
  | 'catppuccin-frappe'
  | 'catppuccin-latte'
  | 'dracula'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'tokyo-night'
  | 'solarized-dark'
  | 'solarized-light'
  | 'glass-dark'
  | 'glass-light';

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
  nord: {
    name: 'Nord',
    description: 'Arctic, north-bluish color palette',
    colors: {
      background: '#2e3440',
      foreground: '#eceff4',
      card: '#3b4252',
      cardForeground: '#eceff4',
      popover: '#3b4252',
      popoverForeground: '#eceff4',
      primary: '#88c0d0',
      primaryForeground: '#2e3440',
      secondary: '#434c5e',
      secondaryForeground: '#eceff4',
      muted: '#4c566a',
      mutedForeground: '#d8dee9',
      accent: '#5e81ac',
      accentForeground: '#eceff4',
      destructive: '#bf616a',
      destructiveForeground: '#eceff4',
      border: '#434c5e',
      input: '#434c5e',
      ring: '#88c0d0',
      bgElevated: '#3b4252',
      online: '#a3be8c',
    },
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    description: 'Soothing pastel theme - Mocha variant',
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      card: '#313244',
      cardForeground: '#cdd6f4',
      popover: '#313244',
      popoverForeground: '#cdd6f4',
      primary: '#89b4fa',
      primaryForeground: '#1e1e2e',
      secondary: '#45475a',
      secondaryForeground: '#cdd6f4',
      muted: '#585b70',
      mutedForeground: '#bac2de',
      accent: '#f5c2e7',
      accentForeground: '#1e1e2e',
      destructive: '#f38ba8',
      destructiveForeground: '#1e1e2e',
      border: '#45475a',
      input: '#45475a',
      ring: '#89b4fa',
      bgElevated: '#313244',
      online: '#a6e3a1',
    },
  },
  'catppuccin-macchiato': {
    name: 'Catppuccin Macchiato',
    description: 'Soothing pastel theme - Macchiato variant',
    colors: {
      background: '#24273a',
      foreground: '#cad3f5',
      card: '#363a4f',
      cardForeground: '#cad3f5',
      popover: '#363a4f',
      popoverForeground: '#cad3f5',
      primary: '#8aadf4',
      primaryForeground: '#24273a',
      secondary: '#494d64',
      secondaryForeground: '#cad3f5',
      muted: '#5b6078',
      mutedForeground: '#b8c0e0',
      accent: '#f5bde6',
      accentForeground: '#24273a',
      destructive: '#ed8796',
      destructiveForeground: '#24273a',
      border: '#494d64',
      input: '#494d64',
      ring: '#8aadf4',
      bgElevated: '#363a4f',
      online: '#a6da95',
    },
  },
  'catppuccin-frappe': {
    name: 'Catppuccin Frappé',
    description: 'Soothing pastel theme - Frappé variant',
    colors: {
      background: '#303446',
      foreground: '#c6d0f5',
      card: '#414559',
      cardForeground: '#c6d0f5',
      popover: '#414559',
      popoverForeground: '#c6d0f5',
      primary: '#8caaee',
      primaryForeground: '#303446',
      secondary: '#51576d',
      secondaryForeground: '#c6d0f5',
      muted: '#626880',
      mutedForeground: '#b5bfe2',
      accent: '#f4b8e4',
      accentForeground: '#303446',
      destructive: '#e78284',
      destructiveForeground: '#303446',
      border: '#51576d',
      input: '#51576d',
      ring: '#8caaee',
      bgElevated: '#414559',
      online: '#a6d189',
    },
  },
  'catppuccin-latte': {
    name: 'Catppuccin Latte',
    description: 'Soothing pastel theme - Latte variant',
    colors: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      card: '#e6e9ef',
      cardForeground: '#4c4f69',
      popover: '#e6e9ef',
      popoverForeground: '#4c4f69',
      primary: '#1e66f5',
      primaryForeground: '#eff1f5',
      secondary: '#ccd0da',
      secondaryForeground: '#4c4f69',
      muted: '#9ca0b0',
      mutedForeground: '#5c5f77',
      accent: '#ea76cb',
      accentForeground: '#eff1f5',
      destructive: '#d20f39',
      destructiveForeground: '#eff1f5',
      border: '#ccd0da',
      input: '#ccd0da',
      ring: '#1e66f5',
      bgElevated: '#e6e9ef',
      online: '#40a02b',
    },
  },
  dracula: {
    name: 'Dracula',
    description: 'Dark theme with vibrant colors',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      card: '#343746',
      cardForeground: '#f8f8f2',
      popover: '#343746',
      popoverForeground: '#f8f8f2',
      primary: '#bd93f9',
      primaryForeground: '#282a36',
      secondary: '#44475a',
      secondaryForeground: '#f8f8f2',
      muted: '#6272a4',
      mutedForeground: '#f8f8f2',
      accent: '#ff79c6',
      accentForeground: '#282a36',
      destructive: '#ff5555',
      destructiveForeground: '#f8f8f2',
      border: '#44475a',
      input: '#44475a',
      ring: '#bd93f9',
      bgElevated: '#343746',
      online: '#50fa7b',
    },
  },
  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    description: 'Retro groove warm dark theme',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      card: '#3c3836',
      cardForeground: '#ebdbb2',
      popover: '#3c3836',
      popoverForeground: '#ebdbb2',
      primary: '#b8bb26',
      primaryForeground: '#282828',
      secondary: '#504945',
      secondaryForeground: '#ebdbb2',
      muted: '#665c54',
      mutedForeground: '#d5c4a1',
      accent: '#fabd2f',
      accentForeground: '#282828',
      destructive: '#fb4934',
      destructiveForeground: '#ebdbb2',
      border: '#504945',
      input: '#504945',
      ring: '#b8bb26',
      bgElevated: '#3c3836',
      online: '#8ec07c',
    },
  },
  'gruvbox-light': {
    name: 'Gruvbox Light',
    description: 'Retro groove warm light theme',
    colors: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      card: '#f2e5bc',
      cardForeground: '#3c3836',
      popover: '#f2e5bc',
      popoverForeground: '#3c3836',
      primary: '#79740e',
      primaryForeground: '#fbf1c7',
      secondary: '#ebdbb2',
      secondaryForeground: '#3c3836',
      muted: '#bdae93',
      mutedForeground: '#665c54',
      accent: '#b57614',
      accentForeground: '#fbf1c7',
      destructive: '#cc241d',
      destructiveForeground: '#fbf1c7',
      border: '#d5c4a1',
      input: '#d5c4a1',
      ring: '#79740e',
      bgElevated: '#f2e5bc',
      online: '#427b58',
    },
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    description: 'Clean dark theme inspired by Tokyo nights',
    colors: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      card: '#24283b',
      cardForeground: '#c0caf5',
      popover: '#24283b',
      popoverForeground: '#c0caf5',
      primary: '#7aa2f7',
      primaryForeground: '#1a1b26',
      secondary: '#292e42',
      secondaryForeground: '#c0caf5',
      muted: '#414868',
      mutedForeground: '#a9b1d6',
      accent: '#bb9af7',
      accentForeground: '#1a1b26',
      destructive: '#f7768e',
      destructiveForeground: '#c0caf5',
      border: '#292e42',
      input: '#292e42',
      ring: '#7aa2f7',
      bgElevated: '#24283b',
      online: '#9ece6a',
    },
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    description: 'Precision colors for optimal readability',
    colors: {
      background: '#002b36',
      foreground: '#839496',
      card: '#073642',
      cardForeground: '#839496',
      popover: '#073642',
      popoverForeground: '#839496',
      primary: '#268bd2',
      primaryForeground: '#002b36',
      secondary: '#073642',
      secondaryForeground: '#839496',
      muted: '#586e75',
      mutedForeground: '#93a1a1',
      accent: '#2aa198',
      accentForeground: '#002b36',
      destructive: '#dc322f',
      destructiveForeground: '#fdf6e3',
      border: '#073642',
      input: '#073642',
      ring: '#268bd2',
      bgElevated: '#073642',
      online: '#859900',
    },
  },
  'solarized-light': {
    name: 'Solarized Light',
    description: 'Precision colors for optimal readability',
    colors: {
      background: '#fdf6e3',
      foreground: '#657b83',
      card: '#eee8d5',
      cardForeground: '#657b83',
      popover: '#eee8d5',
      popoverForeground: '#657b83',
      primary: '#268bd2',
      primaryForeground: '#fdf6e3',
      secondary: '#eee8d5',
      secondaryForeground: '#657b83',
      muted: '#93a1a1',
      mutedForeground: '#586e75',
      accent: '#2aa198',
      accentForeground: '#fdf6e3',
      destructive: '#dc322f',
      destructiveForeground: '#fdf6e3',
      border: '#d3cbb7',
      input: '#d3cbb7',
      ring: '#268bd2',
      bgElevated: '#eee8d5',
      online: '#859900',
    },
  },
  'glass-dark': {
    name: 'Glass Dark',
    description: 'Translucent frosted glass effect',
    colors: {
      background: '#0d1117',
      foreground: '#e6edf3',
      card: '#161b22',
      cardForeground: '#e6edf3',
      popover: '#161b22',
      popoverForeground: '#e6edf3',
      primary: '#58a6ff',
      primaryForeground: '#0d1117',
      secondary: '#21262d',
      secondaryForeground: '#e6edf3',
      muted: '#6e7681',
      mutedForeground: '#8b949e',
      accent: '#388bfd',
      accentForeground: '#e6edf3',
      destructive: '#f85149',
      destructiveForeground: '#e6edf3',
      border: '#30363d',
      input: '#21262d',
      ring: '#58a6ff',
      bgElevated: '#161b22',
      online: '#3fb950',
    },
  },
  'glass-light': {
    name: 'Glass Light',
    description: 'Translucent frosted glass effect',
    colors: {
      background: '#ffffff',
      foreground: '#24292f',
      card: '#f6f8fa',
      cardForeground: '#24292f',
      popover: '#f6f8fa',
      popoverForeground: '#24292f',
      primary: '#0969da',
      primaryForeground: '#ffffff',
      secondary: '#f6f8fa',
      secondaryForeground: '#24292f',
      muted: '#8c959f',
      mutedForeground: '#57606a',
      accent: '#0550ae',
      accentForeground: '#ffffff',
      destructive: '#cf222e',
      destructiveForeground: '#ffffff',
      border: '#d0d7de',
      input: '#d0d7de',
      ring: '#0969da',
      bgElevated: '#f6f8fa',
      online: '#1a7f37',
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
