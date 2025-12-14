import { get, put } from "./client";

export interface UserPreferences {
  theme: string;
}

export const preferences = {
  async getPreferences(): Promise<UserPreferences> {
    return get<UserPreferences>("/preferences");
  },

  async updateTheme(theme: string): Promise<void> {
    await put("/preferences/theme", { theme });
  },
};
