import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { preferences } from "../../api/preferences";
import { THEMES, applyTheme, type Theme } from "../../lib/themes";
import { toast } from "sonner";

export function AppearanceSettings() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await preferences.getPreferences();
      setCurrentTheme(prefs.theme as Theme);
      applyTheme(prefs.theme as Theme);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeChange = async (theme: Theme) => {
    try {
      setCurrentTheme(theme);
      applyTheme(theme);
      await preferences.updateTheme(theme);
      toast.success('Theme updated successfully');
    } catch (error) {
      console.error('Failed to update theme:', error);
      toast.error('Failed to update theme');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-2">Theme</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your preferred color theme
        </p>

        <div className="grid gap-3">
          {(Object.keys(THEMES) as Theme[]).map((themeKey) => {
            const theme = THEMES[themeKey];
            const isSelected = currentTheme === themeKey;

            return (
              <button
                key={themeKey}
                onClick={() => handleThemeChange(themeKey)}
                className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-secondary/50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{theme.name}</h4>
                    {isSelected && (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>

                <div className="flex gap-1.5">
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ backgroundColor: theme.colors.background }}
                  />
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ backgroundColor: theme.colors.card }}
                  />
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
