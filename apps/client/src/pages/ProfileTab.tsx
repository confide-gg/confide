import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { profiles, uploads } from "../api";
import { ImageCropper } from "../components/common/ImageCropper";
import { Button } from "../components/ui/button";
import { Loader2, X } from "lucide-react";
import type { UpdateProfileRequest, UserStatus } from "../types";

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "online", label: "Online", color: "#22c55e" },
  { value: "away", label: "Away", color: "#f59e0b" },
  { value: "dnd", label: "Do Not Disturb", color: "#ef4444" },
  { value: "invisible", label: "Invisible", color: "#6b7280" },
];

export function ProfileTab() {
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<UserStatus>("online");
  const [customStatus, setCustomStatus] = useState("");
  const [accentColor, setAccentColor] = useState("#c9ed7b");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"avatar" | "banner" | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (cropImage) {
        setCropImage(null);
        setCropType(null);
      }
    }
  }, [cropImage]);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await profiles.getMyProfile();
        if (profile) {
          setDisplayName(profile.display_name || "");
          setAvatarUrl(profile.avatar_url || "");
          setBannerUrl(profile.banner_url || "");
          setBio(profile.bio || "");
          setStatus(profile.status || "online");
          setCustomStatus(profile.custom_status || "");
          setAccentColor(profile.accent_color || "#c9ed7b");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UpdateProfileRequest = {
        display_name: displayName || undefined,
        avatar_url: avatarUrl || undefined,
        banner_url: bannerUrl || undefined,
        bio: bio || undefined,
        status,
        custom_status: customStatus || undefined,
        accent_color: accentColor,
      };
      await profiles.updateProfile(data);
      await refreshProfile();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropType(type);
    };
    reader.readAsDataURL(file);
    if (type === "avatar" && avatarInputRef.current) avatarInputRef.current.value = "";
    if (type === "banner" && bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!cropType) return;
    const timestamp = Date.now();
    const file = new File([croppedBlob], `${cropType}_${timestamp}.jpg`, { type: "image/jpeg" });
    if (cropType === "avatar") setIsUploadingAvatar(true);
    else setIsUploadingBanner(true);
    try {
      const result = await uploads.uploadFile(file, cropType);
      const urlWithCacheBust = `${result.url}?t=${timestamp}`;
      if (cropType === "avatar") setAvatarUrl(urlWithCacheBust);
      else setBannerUrl(urlWithCacheBust);
      await refreshProfile();
    } catch (err) {
      console.error(`Failed to upload ${cropType}:`, err);
    } finally {
      if (cropType === "avatar") setIsUploadingAvatar(false);
      else setIsUploadingBanner(false);
      setCropImage(null);
      setCropType(null);
    }
  };

  const handleCropCancel = () => {
    setCropImage(null);
    setCropType(null);
  };

  const handleRemoveAvatar = async () => {
    try {
      await uploads.deleteFile("avatar");
      setAvatarUrl("");
    } catch (err) {
      console.error("Failed to remove avatar:", err);
    }
  };

  const handleRemoveBanner = async () => {
    try {
      await uploads.deleteFile("banner");
      setBannerUrl("");
    } catch (err) {
      console.error("Failed to remove banner:", err);
    }
  };

  const getImageUrl = (path: string) => uploads.getUploadUrl(path);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 max-w-2xl">
        <p className="text-muted-foreground">
          Customize how others see you across Confide
        </p>

        <div className="space-y-4">
          <div
            className="relative h-32 rounded-xl overflow-hidden"
            style={{
              background: bannerUrl
                ? `url(${getImageUrl(bannerUrl)}) center/cover`
                : `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            }}
          >
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, "banner")}
              className="hidden"
              id="banner-upload"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <label
                htmlFor="banner-upload"
                className="w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-lg cursor-pointer transition-colors"
              >
                {isUploadingBanner ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
              </label>
              {bannerUrl && (
                <button
                  onClick={handleRemoveBanner}
                  className="w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          <div className="-mt-14 ml-4">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-card border-4 border-bg-elevated overflow-hidden flex items-center justify-center text-2xl font-bold">
                {avatarUrl ? (
                  <img src={getImageUrl(avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="bg-gradient-to-br from-primary to-[#a8d15a] bg-clip-text text-transparent">
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, "avatar")}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded-full cursor-pointer transition-colors"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
              </label>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute bottom-0 right-8 w-8 h-8 flex items-center justify-center bg-destructive hover:bg-destructive/80 text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user?.username || "Your display name"}
              className="w-full px-4 py-3 bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Accent Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-14 h-14 rounded-xl cursor-pointer border-2 border-border bg-transparent"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-32 px-4 py-3 bg-secondary/50 border-0 rounded-xl text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-colors ${
                    status === opt.value
                      ? "bg-primary/10 text-primary ring-2 ring-primary"
                      : "bg-secondary/30 text-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => setStatus(opt.value)}
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
              <span>Custom Status</span>
              <span className="font-normal">({customStatus.length}/128)</span>
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={128}
              className="w-full px-4 py-3 bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
              <span>About Me</span>
              <span className="font-normal">({bio.length}/500)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>

      {cropImage && cropType && (
        <ImageCropper
          image={cropImage}
          aspect={cropType === "avatar" ? 1 : 3}
          cropShape={cropType === "avatar" ? "round" : "rect"}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
