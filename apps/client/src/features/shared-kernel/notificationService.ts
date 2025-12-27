import { invoke } from "@tauri-apps/api/core";

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
  tag?: string;
  group?: string;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  persistent?: boolean;
  timestamp?: string;
  conversationId?: string;
  senderId?: string;
}

export enum NotificationPriority {
  Low = "Low",
  Normal = "Normal",
  High = "High",
  Critical = "Critical",
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
}

export interface NotificationStats {
  total_sent: number;
  total_shown: number;
  total_clicked: number;
  total_dismissed: number;
  permission_granted: boolean;
  platform_supported: boolean;
  service_available: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  showPreview: boolean;
  enableDuringCalls: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  priority: NotificationPriority;
  groupByConversation: boolean;
  persistentNotifications: boolean;
}

class NotificationServiceClass {
  private initialized = false;
  private preferences: NotificationPreferences = {
    enabled: true,
    soundEnabled: true,
    soundVolume: 0.5,
    showPreview: true,
    enableDuringCalls: false,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    priority: NotificationPriority.Normal,
    groupByConversation: true,
    persistentNotifications: false,
  };

  private sounds: Record<string, HTMLAudioElement> = {};

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await invoke("init_notification_service");

      this.loadPreferences();

      this.initializeSounds();

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize notification service:", error);
      throw error;
    }
  }

  private loadPreferences(): void {
    try {
      const savedPrefs = localStorage.getItem("notification-preferences");
      if (savedPrefs) {
        this.preferences = { ...this.preferences, ...JSON.parse(savedPrefs) };
      }
    } catch (error) {}
  }

  private savePreferences(): void {
    try {
      localStorage.setItem("notification-preferences", JSON.stringify(this.preferences));
    } catch (error) {}
  }

  private initializeSounds(): void {
    const soundFiles = {
      message: "/chat_ping.mp3",
      friendRequest: "/friend_request.mp3",
      call: "/notification.mp3",
    };

    Object.entries(soundFiles).forEach(([type, path]) => {
      this.sounds[type] = new Audio(path);
      this.sounds[type].volume = this.preferences.soundVolume;
    });
  }

  async checkPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await invoke("check_notification_permission");
    } catch (error) {
      console.error("Failed to check notification permission:", error);
      return false;
    }
  }

  async sendNotification(options: NotificationOptions): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.preferences.enabled) {
      return null;
    }

    if (this.isInQuietHours()) {
      return null;
    }

    try {
      if (this.preferences.soundEnabled && options.sound) {
        this.playSound(options.sound);
      }

      const enhancedOptions: NotificationOptions = {
        ...options,
        priority: options.priority || this.preferences.priority,
        persistent: options.persistent ?? this.preferences.persistentNotifications,
      };

      if (!this.preferences.showPreview) {
        enhancedOptions.body = "New message";
      }

      const notificationId = await invoke<string>("send_enhanced_notification", {
        options: enhancedOptions,
      });

      return notificationId;
    } catch (error) {
      console.error("Failed to send notification:", error);

      try {
        return await this.sendFallbackNotification(options);
      } catch (fallbackError) {
        console.error("Fallback notification also failed:", fallbackError);
        return null;
      }
    }
  }

  private async sendFallbackNotification(options: NotificationOptions): Promise<string> {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");

    await sendNotification({
      title: options.title,
      body: options.body,
      icon: options.icon,
    });

    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isInQuietHours(): boolean {
    if (!this.preferences.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const start = this.preferences.quietHoursStart;
    const end = this.preferences.quietHoursEnd;

    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
  }

  private playSound(soundType: string): void {
    const sound = this.sounds[soundType];
    if (sound) {
      sound.currentTime = 0;
      sound.volume = this.preferences.soundVolume;
      sound.play().catch(() => {});
    }
  }

  async showMessageNotification(
    senderName: string,
    message: string,
    options: Partial<NotificationOptions> = {}
  ): Promise<string | null> {
    const notificationOptions: NotificationOptions = {
      title: `@${senderName}`,
      body: this.formatMessageBody(message),
      icon: "/icons/128x128.png",
      sound: "message",
      priority: NotificationPriority.Normal,
      group: "messages",
      ...options,
    };

    return this.sendNotification(notificationOptions);
  }

  async showFriendRequestNotification(
    senderName: string,
    options: Partial<NotificationOptions> = {}
  ): Promise<string | null> {
    const notificationOptions: NotificationOptions = {
      title: "Friend Request",
      body: `${senderName} sent you a friend request`,
      icon: "/icons/128x128.png",
      sound: "friendRequest",
      priority: NotificationPriority.High,
      group: "friend-requests",
      actions: [
        { id: "accept", title: "Accept" },
        { id: "decline", title: "Decline" },
      ],
      ...options,
    };

    return this.sendNotification(notificationOptions);
  }

  async showCallNotification(
    callerName: string,
    options: Partial<NotificationOptions> = {}
  ): Promise<string | null> {
    const notificationOptions: NotificationOptions = {
      title: "Incoming Call",
      body: `${callerName} is calling you`,
      icon: "/icons/128x128.png",
      sound: "call",
      priority: NotificationPriority.Critical,
      persistent: true,
      actions: [
        { id: "answer", title: "Answer" },
        { id: "decline", title: "Decline" },
      ],
      ...options,
    };

    return this.sendNotification(notificationOptions);
  }

  private formatMessageBody(message: string): string {
    if (message.startsWith("https://") && message.includes("tenor")) {
      return "sent a GIF";
    }

    if (message.length > 100) {
      return message.slice(0, 100) + "...";
    }

    return message;
  }

  async dismissNotification(id: string): Promise<void> {
    try {
      await invoke("dismiss_notification", { id });
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  }

  async handleNotificationClick(id: string): Promise<void> {
    try {
      await invoke("handle_notification_click", { id });
    } catch (error) {
      console.error("Failed to handle notification click:", error);
    }
  }

  async getStats(): Promise<NotificationStats> {
    try {
      return await invoke<NotificationStats>("get_notification_stats");
    } catch (error) {
      console.error("Failed to get notification stats:", error);
      return {
        total_sent: 0,
        total_shown: 0,
        total_clicked: 0,
        total_dismissed: 0,
        permission_granted: false,
        platform_supported: false,
        service_available: false,
      };
    }
  }

  async clearAllNotifications(): Promise<void> {
    try {
      await invoke("clear_all_notifications");
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();

    if (updates.soundVolume !== undefined) {
      Object.values(this.sounds).forEach((sound) => {
        sound.volume = updates.soundVolume!;
      });
    }
  }

  setSoundVolume(volume: number): void {
    this.updatePreferences({ soundVolume: Math.max(0, Math.min(1, volume)) });
  }

  toggleSounds(enabled: boolean): void {
    this.updatePreferences({ soundEnabled: enabled });
  }

  toggleNotifications(enabled: boolean): void {
    this.updatePreferences({ enabled });
  }

  setQuietHours(enabled: boolean, start?: string, end?: string): void {
    const updates: Partial<NotificationPreferences> = { quietHoursEnabled: enabled };
    if (start) updates.quietHoursStart = start;
    if (end) updates.quietHoursEnd = end;
    this.updatePreferences(updates);
  }
}

export const NotificationService = new NotificationServiceClass();
export default NotificationService;
