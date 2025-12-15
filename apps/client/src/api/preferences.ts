import { get, put } from "./client";

export interface UserPreferences {
  theme: string;
  enable_snow_effect?: boolean;
}

export const preferences = {
  async getPreferences(): Promise<UserPreferences> {
    return get<UserPreferences>("/preferences");
  },

  async updateTheme(theme: string): Promise<void> {
    await put("/preferences/theme", { theme });
  },

  async updateSnowEffect(enabled: boolean): Promise<void> {
    await put("/preferences/snow-effect", { enabled });
  },
};
