use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),
    #[allow(dead_code)]
    #[error("Notification service unavailable")]
    ServiceUnavailable,
    #[allow(dead_code)]
    #[error("Invalid notification data: {0}")]
    InvalidData(String),
    #[error("System error: {0}")]
    SystemError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationOptions {
    pub title: String,
    pub body: String,
    pub icon: Option<String>,
    pub sound: Option<String>,
    pub tag: Option<String>,
    pub group: Option<String>,
    pub priority: NotificationPriority,
    pub actions: Vec<NotificationAction>,
    pub persistent: bool,
    pub timestamp: Option<DateTime<Utc>>,
    pub conversation_id: Option<String>,
    pub sender_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationState {
    pub id: String,
    pub options: NotificationOptions,
    pub created_at: DateTime<Utc>,
    pub shown: bool,
    pub clicked: bool,
    pub dismissed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationStats {
    pub total_sent: u64,
    pub total_shown: u64,
    pub total_clicked: u64,
    pub total_dismissed: u64,
    pub permission_granted: bool,
    pub platform_supported: bool,
    pub service_available: bool,
}

pub struct NotificationService {
    notifications: Arc<RwLock<HashMap<String, NotificationState>>>,
    stats: Arc<RwLock<NotificationStats>>,
    platform: Platform,
}

#[derive(Debug, Clone)]
enum Platform {
    MacOS,
    #[allow(dead_code)]
    Windows,
    #[allow(dead_code)]
    Linux,
    #[allow(dead_code)]
    Unknown,
}

impl NotificationService {
    pub fn new() -> Self {
        let platform = Self::detect_platform();

        Self {
            notifications: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(RwLock::new(NotificationStats {
                total_sent: 0,
                total_shown: 0,
                total_clicked: 0,
                total_dismissed: 0,
                permission_granted: false,
                platform_supported: true,
                service_available: false,
            })),
            platform,
        }
    }

    fn detect_platform() -> Platform {
        #[cfg(target_os = "macos")]
        return Platform::MacOS;

        #[cfg(target_os = "windows")]
        return Platform::Windows;

        #[cfg(target_os = "linux")]
        return Platform::Linux;

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Platform::Unknown;
    }

    pub async fn initialize(&self) -> Result<(), NotificationError> {
        match self.platform {
            Platform::MacOS => self.initialize_macos().await,
            Platform::Windows => self.initialize_windows().await,
            Platform::Linux => self.initialize_linux().await,
            Platform::Unknown => Err(NotificationError::PlatformNotSupported(
                "Unknown platform".to_string(),
            )),
        }
    }

    pub async fn check_permission(&self) -> Result<bool, NotificationError> {
        // For now, we'll assume permission is granted and handle it at the frontend level
        // This can be enhanced with proper permission checking once we have the right API
        Ok(true)
    }

    pub async fn send_notification(
        &self,
        options: NotificationOptions,
    ) -> Result<String, NotificationError> {
        let notification_id = Uuid::new_v4().to_string();

        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.total_sent += 1;
        }

        // Check permission first
        if !self.check_permission().await? {
            return Err(NotificationError::PermissionDenied);
        }

        // Store notification state
        let state = NotificationState {
            id: notification_id.clone(),
            options: options.clone(),
            created_at: Utc::now(),
            shown: false,
            clicked: false,
            dismissed: false,
        };

        {
            let mut notifications = self.notifications.write().await;
            notifications.insert(notification_id.clone(), state);
        }

        // Send platform-specific notification
        match self.platform {
            Platform::MacOS => {
                self.send_macos_notification(&notification_id, &options)
                    .await
            }
            Platform::Windows => {
                self.send_windows_notification(&notification_id, &options)
                    .await
            }
            Platform::Linux => {
                self.send_linux_notification(&notification_id, &options)
                    .await
            }
            Platform::Unknown => {
                self.send_fallback_notification(&notification_id, &options)
                    .await
            }
        }?;

        // Update shown status
        {
            let mut notifications = self.notifications.write().await;
            if let Some(notification) = notifications.get_mut(&notification_id) {
                notification.shown = true;
            }

            let mut stats = self.stats.write().await;
            stats.total_shown += 1;
        }

        Ok(notification_id)
    }

    async fn send_macos_notification(
        &self,
        _id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        // Use native macOS notification system
        self.send_native_notification(options).await
    }

    async fn send_windows_notification(
        &self,
        _id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        // Use native Windows notification system
        self.send_native_notification(options).await?;
        self.handle_windows_specific_features(options).await;
        Ok(())
    }

    async fn send_linux_notification(
        &self,
        id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        // Try Tauri notification first, then fallback to notify-rust
        match self.try_tauri_notification(id, options).await {
            Ok(_) => Ok(()),
            Err(_) => self.try_linux_native_notification(id, options).await,
        }
    }

    async fn try_tauri_notification(
        &self,
        _id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        // Fallback to native notification implementation
        self.send_native_notification(options).await
    }

    #[cfg(target_os = "linux")]
    async fn try_linux_native_notification(
        &self,
        _id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        use notify_rust::Notification;

        let mut notification = Notification::new();
        notification.summary(&options.title);
        notification.body(&options.body);

        if let Some(icon) = &options.icon {
            notification.icon(icon);
        }

        match options.priority {
            NotificationPriority::Low => notification.urgency(notify_rust::Urgency::Low),
            NotificationPriority::Normal => notification.urgency(notify_rust::Urgency::Normal),
            NotificationPriority::High => notification.urgency(notify_rust::Urgency::Critical),
            NotificationPriority::Critical => notification.urgency(notify_rust::Urgency::Critical),
        };

        match notification.show() {
            Ok(_) => {
                log::info!("Linux native notification sent successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to send Linux native notification: {}", e);
                Err(NotificationError::SystemError(e.to_string()))
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    async fn try_linux_native_notification(
        &self,
        _id: &str,
        _options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        Err(NotificationError::PlatformNotSupported(
            "Not on Linux".to_string(),
        ))
    }

    async fn send_fallback_notification(
        &self,
        _id: &str,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        log::warn!("Using fallback notification for unknown platform");

        // Use native notification implementation
        self.send_native_notification(options).await
    }

    async fn send_native_notification(
        &self,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        // Use basic notification display - this can be enhanced with platform-specific implementations
        log::info!(
            "Sending native notification: {} - {}",
            options.title,
            options.body
        );

        // For now, we'll just log the notification
        // In a real implementation, this would call platform-specific notification APIs
        match self.platform {
            Platform::MacOS => {
                // macOS notification using osascript
                self.send_macos_native_notification(options).await
            }
            Platform::Windows => {
                // Windows notification using WinRT APIs (would need additional dependencies)
                log::info!(
                    "Windows native notification: {} - {}",
                    options.title,
                    options.body
                );
                Ok(())
            }
            Platform::Linux => {
                // Linux notification using libnotify
                #[cfg(target_os = "linux")]
                {
                    self.send_linux_native_notification_direct(options).await
                }
                #[cfg(not(target_os = "linux"))]
                {
                    log::info!(
                        "Linux notification (simulated): {} - {}",
                        options.title,
                        options.body
                    );
                    Ok(())
                }
            }
            Platform::Unknown => {
                log::info!(
                    "Unknown platform notification: {} - {}",
                    options.title,
                    options.body
                );
                Ok(())
            }
        }
    }

    #[cfg(target_os = "macos")]
    async fn send_macos_native_notification(
        &self,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        use std::process::Command;

        let script = format!(
            r#"display notification "{}" with title "{}" sound name "default""#,
            options.body.replace('"', r#"\""#),
            options.title.replace('"', r#"\""#)
        );

        let output = Command::new("osascript").arg("-e").arg(&script).output();

        match output {
            Ok(_) => {
                log::info!("macOS native notification sent successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to send macOS native notification: {}", e);
                Err(NotificationError::SystemError(e.to_string()))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    async fn send_macos_native_notification(
        &self,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        log::info!(
            "macOS notification (simulated): {} - {}",
            options.title,
            options.body
        );
        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn send_linux_native_notification_direct(
        &self,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        use notify_rust::Notification;

        let mut notification = Notification::new();
        notification.summary(&options.title);
        notification.body(&options.body);

        if let Some(icon) = &options.icon {
            notification.icon(icon);
        }

        match options.priority {
            NotificationPriority::Low => notification.urgency(notify_rust::Urgency::Low),
            NotificationPriority::Normal => notification.urgency(notify_rust::Urgency::Normal),
            NotificationPriority::High => notification.urgency(notify_rust::Urgency::Critical),
            NotificationPriority::Critical => notification.urgency(notify_rust::Urgency::Critical),
        };

        match notification.show() {
            Ok(_) => {
                log::info!("Linux native notification sent successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to send Linux native notification: {}", e);
                Err(NotificationError::SystemError(e.to_string()))
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    #[allow(dead_code)]
    async fn send_linux_native_notification_direct(
        &self,
        options: &NotificationOptions,
    ) -> Result<(), NotificationError> {
        log::info!(
            "Linux notification (simulated): {} - {}",
            options.title,
            options.body
        );
        Ok(())
    }

    #[allow(dead_code)]
    async fn initialize_macos(&self) -> Result<(), NotificationError> {
        log::info!("Initializing macOS notification service");

        // macOS-specific initialization
        {
            let mut stats = self.stats.write().await;
            stats.service_available = true;
            stats.platform_supported = true;
        }

        Ok(())
    }

    #[allow(dead_code)]
    async fn initialize_windows(&self) -> Result<(), NotificationError> {
        log::info!("Initializing Windows notification service");

        // Windows-specific initialization
        {
            let mut stats = self.stats.write().await;
            stats.service_available = true;
            stats.platform_supported = true;
        }

        Ok(())
    }

    #[allow(dead_code)]
    async fn initialize_linux(&self) -> Result<(), NotificationError> {
        log::info!("Initializing Linux notification service");

        // Check if notification daemon is available
        let daemon_available = self.check_linux_notification_daemon().await;

        {
            let mut stats = self.stats.write().await;
            stats.service_available = daemon_available;
            stats.platform_supported = true;
        }

        if !daemon_available {
            log::warn!("No notification daemon found on Linux");
        }

        Ok(())
    }

    async fn check_linux_notification_daemon(&self) -> bool {
        #[cfg(target_os = "linux")]
        {
            use std::process::Command;

            // Check if notification daemon is running
            match Command::new("pgrep").args(&["-f", "notification"]).output() {
                Ok(output) => !output.stdout.is_empty(),
                Err(_) => {
                    // Fallback: try to send a test notification
                    use notify_rust::Notification;
                    Notification::new()
                        .summary("Test")
                        .body("Test notification")
                        .timeout(1)
                        .show()
                        .is_ok()
                }
            }
        }

        #[cfg(not(target_os = "linux"))]
        false
    }

    #[cfg(target_os = "windows")]
    async fn handle_windows_specific_features(&self, _options: &NotificationOptions) {
        // Windows-specific features like Action Center integration
        log::debug!("Handling Windows-specific notification features");
    }

    #[cfg(not(target_os = "windows"))]
    async fn handle_windows_specific_features(&self, _options: &NotificationOptions) {
        // No-op on non-Windows platforms
    }

    pub async fn dismiss_notification(&self, id: &str) -> Result<(), NotificationError> {
        {
            let mut notifications = self.notifications.write().await;
            if let Some(notification) = notifications.get_mut(id) {
                notification.dismissed = true;
            }

            let mut stats = self.stats.write().await;
            stats.total_dismissed += 1;
        }

        Ok(())
    }

    pub async fn handle_notification_click(&self, id: &str) -> Result<(), NotificationError> {
        {
            let mut notifications = self.notifications.write().await;
            if let Some(notification) = notifications.get_mut(id) {
                notification.clicked = true;
            }

            let mut stats = self.stats.write().await;
            stats.total_clicked += 1;
        }

        log::info!("Notification clicked: {}", id);
        Ok(())
    }

    pub async fn get_notification_stats(&self) -> NotificationStats {
        let stats = self.stats.read().await;
        stats.clone()
    }

    pub async fn clear_notifications(&self) -> Result<(), NotificationError> {
        let mut notifications = self.notifications.write().await;
        notifications.clear();

        log::info!("All notifications cleared");
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_active_notifications(&self) -> Vec<NotificationState> {
        let notifications = self.notifications.read().await;
        notifications
            .values()
            .filter(|n| n.shown && !n.dismissed)
            .cloned()
            .collect()
    }
}

impl Default for NotificationOptions {
    fn default() -> Self {
        Self {
            title: String::new(),
            body: String::new(),
            icon: None,
            sound: None,
            tag: None,
            group: None,
            priority: NotificationPriority::Normal,
            actions: Vec::new(),
            persistent: false,
            timestamp: None,
            conversation_id: None,
            sender_id: None,
        }
    }
}
