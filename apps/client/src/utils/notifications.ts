import { NotificationService, NotificationPriority } from "@/features/shared-kernel";

// Legacy API support - these functions maintain backward compatibility
let legacyInitialized = false;

export async function initNotifications() {
  if (legacyInitialized) return;

  try {
    await NotificationService.initialize();
    legacyInitialized = true;
  } catch (error) {
    console.error("Failed to initialize notifications:", error);
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    try {
      const granted = await isPermissionGranted();
      if (!granted) {
        await requestPermission();
      }
      legacyInitialized = true;
    } catch (fallbackError) {
      console.error("Fallback notification initialization failed:", fallbackError);
    }
  }
}

export function playChatSound() {
  try {
    const audio = new Audio("/chat_ping.mp3");
    const prefs = NotificationService.getPreferences();
    audio.volume = prefs.soundEnabled ? prefs.soundVolume : 0;
    audio.play().catch(() => {});
  } catch (error) {}
}

export function playFriendRequestSound() {
  try {
    const audio = new Audio("/friend_request.mp3");
    const prefs = NotificationService.getPreferences();
    audio.volume = prefs.soundEnabled ? prefs.soundVolume : 0;
    audio.play().catch(() => {});
  } catch (error) {}
}

export async function showMessageNotification(
  senderName: string,
  message: string,
  userStatus?: string
) {
  if (!legacyInitialized) {
    await initNotifications();
  }

  const isDND = userStatus === "dnd";

  try {
    const notificationId = await NotificationService.showMessageNotification(senderName, message, {
      priority: isDND ? NotificationPriority.Low : NotificationPriority.Normal,
    });

    if (notificationId) {
    } else if (!isDND) {
      playChatSound();
    }
  } catch (error) {
    console.error("Enhanced notification failed, trying fallback:", error);

    if (!isDND) {
      playChatSound();
    }

    try {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      const body =
        message.startsWith("https://") && message.includes("tenor")
          ? "sent a GIF"
          : message.length > 100
            ? message.slice(0, 100) + "..."
            : message;

      await sendNotification({
        title: `@${senderName}`,
        body,
      });
    } catch (fallbackError) {
      console.error("Fallback notification also failed:", fallbackError);
    }
  }
}

// New enhanced exports for modern usage
export { NotificationService, NotificationPriority } from "@/features/shared-kernel";
export type {
  NotificationOptions,
  NotificationPreferences,
  NotificationStats,
} from "@/features/shared-kernel";
