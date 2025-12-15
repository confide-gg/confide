import { useState, useEffect } from "react";
import { Check, Snowflake } from "lucide-react";
import { preferences as preferencesApi } from "../../api/preferences";
import { THEMES, applyTheme, type Theme } from "../../lib/themes";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

export function AppearanceSettings() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(true);
  const [isHolidaySeason, setIsHolidaySeason] = useState(false);
  
  const { preferences, refreshPreferences } = useAuth();

  useEffect(() => {
    // Check if it's December (holiday season)
    const now = new Date();
    const isDecember = now.getMonth() === 11;
    setIsHolidaySeason(isDecember);
    
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await preferencesApi.getPreferences();
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
      await preferencesApi.updateTheme(theme);
      toast.success('Theme updated successfully');
    } catch (error) {
      console.error('Failed to update theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const handleSnowEffectToggle = async () => {
    try {
      const currentValue = preferences?.enable_snow_effect ?? true;
      const newValue = !currentValue;
      
      await preferencesApi.updateSnowEffect(newValue);
      toast.success('Snow effect preference updated');
      
      // Refresh preferences to update the context
      await refreshPreferences();
      
      // Note: SnowEffect now uses auth context, so no manual notification needed
    } catch (error) {
      console.error('Failed to update snow effect preference:', error);
      toast.error('Failed to update snow effect preference');
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
      
      {isHolidaySeason && (
        <div className="border-t border-border pt-6">
          <h3 className="text-base font-semibold text-foreground mb-2">Festive Effects</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Seasonal visual enhancements
          </p>
          
          <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
              <Snowflake className="w-5 h-5 text-muted-foreground" />
              <div>
                <h4 className="font-semibold text-foreground">Snow Effect</h4>
                <p className="text-sm text-muted-foreground">Festive snow particles (December only)</p>
              </div>
            </div>
            
            <button
              onClick={handleSnowEffectToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                preferences?.enable_snow_effect ? 'bg-primary' : 'bg-input'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  preferences?.enable_snow_effect ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
