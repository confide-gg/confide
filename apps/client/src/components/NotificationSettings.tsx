import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Volume2, VolumeX, Moon, BarChart3, TestTube } from "lucide-react";
import NotificationService, { NotificationPreferences, NotificationPriority, NotificationStats } from "@/services/notificationService";
import { toast } from "sonner";

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    NotificationService.getPreferences()
  );
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const notificationStats = await NotificationService.getStats();
      setStats(notificationStats);
    } catch (error) {
      console.error("Failed to load notification stats:", error);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    NotificationService.updatePreferences({ [key]: value });
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const notificationId = await NotificationService.showMessageNotification(
        "Test User",
        "This is a test notification to check if everything is working correctly!",
        { priority: NotificationPriority.Normal }
      );
      
      if (notificationId) {
        toast.success("Test notification sent successfully!");
      } else {
        toast.warning("Test notification was blocked or failed");
      }
    } catch (error) {
      toast.error("Failed to send test notification");
      console.error("Test notification error:", error);
    } finally {
      setIsLoading(false);
      // Refresh stats after test
      setTimeout(loadStats, 1000);
    }
  };

  const handlePermissionCheck = async () => {
    try {
      const hasPermission = await NotificationService.checkPermission();
      if (hasPermission) {
        toast.success("Notification permissions are granted");
      } else {
        toast.warning("Notification permissions are not granted");
      }
      loadStats();
    } catch (error) {
      toast.error("Failed to check permissions");
    }
  };

  const handleClearNotifications = async () => {
    try {
      await NotificationService.clearAllNotifications();
      toast.success("All notifications cleared");
      loadStats();
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Notification Settings</h2>
        <p className="text-muted-foreground">
          Configure how you receive notifications across all platforms
        </p>
      </div>

      {/* Status Overview */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Notification Status
            </CardTitle>
            <CardDescription>
              Current status and statistics for your notification system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.total_sent}</div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total_shown}</div>
                <div className="text-sm text-muted-foreground">Shown</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.total_clicked}</div>
                <div className="text-sm text-muted-foreground">Clicked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.total_dismissed}</div>
                <div className="text-sm text-muted-foreground">Dismissed</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant={stats.permission_granted ? "default" : "destructive"}>
                {stats.permission_granted ? "Permission Granted" : "Permission Denied"}
              </Badge>
              <Badge variant={stats.platform_supported ? "default" : "secondary"}>
                {stats.platform_supported ? "Platform Supported" : "Platform Unsupported"}
              </Badge>
              <Badge variant={stats.service_available ? "default" : "outline"}>
                {stats.service_available ? "Service Available" : "Service Unavailable"}
              </Badge>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={handlePermissionCheck} variant="outline" size="sm">
                Check Permissions
              </Button>
              <Button onClick={handleClearNotifications} variant="outline" size="sm">
                Clear All
              </Button>
              <Button 
                onClick={handleTestNotification} 
                disabled={isLoading}
                variant="outline" 
                size="sm"
              >
                <TestTube className="h-4 w-4 mr-2" />
                {isLoading ? "Sending..." : "Test Notification"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Basic Settings
          </CardTitle>
          <CardDescription>
            Control when and how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive OS-level notifications for new messages
              </p>
            </div>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) => updatePreference("enabled", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Message Preview</Label>
              <p className="text-sm text-muted-foreground">
                Display message content in notifications
              </p>
            </div>
            <Switch
              checked={preferences.showPreview}
              onCheckedChange={(checked) => updatePreference("showPreview", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Group by Conversation</Label>
              <p className="text-sm text-muted-foreground">
                Group notifications from the same conversation
              </p>
            </div>
            <Switch
              checked={preferences.groupByConversation}
              onCheckedChange={(checked) => updatePreference("groupByConversation", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Persistent Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Keep notifications visible until manually dismissed
              </p>
            </div>
            <Switch
              checked={preferences.persistentNotifications}
              onCheckedChange={(checked) => updatePreference("persistentNotifications", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Priority</Label>
            <Select
              value={preferences.priority}
              onValueChange={(value: NotificationPriority) => updatePreference("priority", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NotificationPriority.Low}>Low</SelectItem>
                <SelectItem value={NotificationPriority.Normal}>Normal</SelectItem>
                <SelectItem value={NotificationPriority.High}>High</SelectItem>
                <SelectItem value={NotificationPriority.Critical}>Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {preferences.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            Sound Settings
          </CardTitle>
          <CardDescription>
            Configure notification sounds and volume
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Sounds</Label>
              <p className="text-sm text-muted-foreground">
                Play sounds when notifications are received
              </p>
            </div>
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => updatePreference("soundEnabled", checked)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Volume</Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(preferences.soundVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[preferences.soundVolume]}
              onValueChange={([value]) => updatePreference("soundVolume", value)}
              max={1}
              min={0}
              step={0.1}
              disabled={!preferences.soundEnabled}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable During Calls</Label>
              <p className="text-sm text-muted-foreground">
                Play notification sounds during voice/video calls
              </p>
            </div>
            <Switch
              checked={preferences.enableDuringCalls}
              onCheckedChange={(checked) => updatePreference("enableDuringCalls", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when notifications should be minimized
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Suppress non-critical notifications during specified hours
              </p>
            </div>
            <Switch
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) => updatePreference("quietHoursEnabled", checked)}
            />
          </div>

          {preferences.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) => updatePreference("quietHoursStart", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) => updatePreference("quietHoursEnd", e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}