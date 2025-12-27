import { useState, useEffect, useCallback, Activity } from "react";
import { useNavigate } from "react-router-dom";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { SpotifySettings } from "@/components/settings/SpotifySettings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CLIENT_VERSION, CENTRAL_API_URL } from "@/config";
import { Panel } from "@/components/layout/Panel";

type Tab = "profile" | "account" | "voice" | "appearance" | "connections";

interface TabItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

interface SettingsCategory {
  id: string;
  label: string;
  tabs: TabItem[];
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "user",
    label: "USER SETTINGS",
    tabs: [
      {
        id: "account",
        label: "My Account",
        icon: <FontAwesomeIcon icon="shield" className="w-4 h-4" />,
      },
      {
        id: "profile",
        label: "Profile",
        icon: <FontAwesomeIcon icon="user" className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "app",
    label: "APP SETTINGS",
    tabs: [
      {
        id: "appearance",
        label: "Appearance",
        icon: <FontAwesomeIcon icon="palette" className="w-4 h-4" />,
      },
      {
        id: "voice",
        label: "Voice & Audio",
        icon: <FontAwesomeIcon icon="microphone" className="w-4 h-4" />,
      },
      {
        id: "connections",
        label: "Connections",
        icon: <FontAwesomeIcon icon="link" className="w-4 h-4" />,
      },
    ],
  },
];

const ALL_TABS = SETTINGS_CATEGORIES.flatMap((cat) => cat.tabs);

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [centralVersion, setCentralVersion] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate(-1);
      }
    },
    [navigate]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    fetch(`${CENTRAL_API_URL}/version`)
      .then((res) => res.json())
      .then((data) => setCentralVersion(data.version))
      .catch(() => setCentralVersion(null));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background p-3 flex gap-3">
      <aside className="w-[240px] shrink-0">
        <Panel className="h-full flex flex-col">
          <ScrollArea className="flex-1">
            <nav className="px-2 py-4 space-y-4">
              {SETTINGS_CATEGORIES.map((category) => (
                <div key={category.id}>
                  <h3 className="px-3 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.label}
                  </h3>
                  <div className="space-y-0.5">
                    {category.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>
          <div className="px-4 py-3">
            <p className="text-[10px] text-muted-foreground/60">
              Client v{CLIENT_VERSION}
              {centralVersion && ` · Central v${centralVersion}`}
            </p>
          </div>
        </Panel>
      </aside>

      <Panel className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
              <FontAwesomeIcon icon="arrow-left" className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">
              {ALL_TABS.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 min-h-full flex items-center justify-center">
            <div className="w-full max-w-4xl">
              <Activity mode={activeTab === "profile" ? "visible" : "hidden"}>
                <ProfileSettings />
              </Activity>

              <Activity mode={activeTab === "voice" ? "visible" : "hidden"}>
                <VoiceSettings />
              </Activity>

              <Activity mode={activeTab === "account" ? "visible" : "hidden"}>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Account settings coming soon...</p>
                </div>
              </Activity>

              <Activity mode={activeTab === "appearance" ? "visible" : "hidden"}>
                <AppearanceSettings />
              </Activity>

              <Activity mode={activeTab === "connections" ? "visible" : "hidden"}>
                <SpotifySettings />
              </Activity>
            </div>
          </div>
        </ScrollArea>
      </Panel>
    </div>
  );
}
