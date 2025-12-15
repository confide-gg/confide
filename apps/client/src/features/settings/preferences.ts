import { httpClient } from "../../core/network/HttpClient";

export interface UserPreferences {
  theme: string;
  enable_snow_effect?: boolean;
}

class PreferenceService {
  public async getPreferences(): Promise<UserPreferences> {
    return httpClient.get<UserPreferences>("/preferences");
  }

  public async updateTheme(theme: string): Promise<void> {
    return httpClient.put<void>("/preferences/theme", { theme });
  }

  public async updateSnowEffect(enabled: boolean): Promise<void> {
    return httpClient.put<void>("/preferences/snow-effect", { enabled });
  }
}

export const preferenceService = new PreferenceService();
