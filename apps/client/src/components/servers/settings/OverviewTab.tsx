import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ServerRole, ServerBan } from "../../../features/servers/types";

interface OverviewTabProps {
  serverName: string;
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  isDiscoverable: boolean;
  setIsDiscoverable: (discoverable: boolean) => void;
  maxUsers: number;
  setMaxUsers: (max: number) => void;
  maxUploadSize: number;
  setMaxUploadSize: (size: number) => void;
  messageRetention: string;
  setMessageRetention: (retention: string) => void;
  isLoading: boolean;
  hasChanges: boolean;
  roles: ServerRole[];
  bans: ServerBan[];
  isOwner: boolean;
  onSaveSettings: () => void;
  onShowDeleteServer: () => void;
}

export function OverviewTab({
  serverName,
  name,
  setName,
  description,
  setDescription,
  isDiscoverable,
  setIsDiscoverable,
  maxUsers,
  setMaxUsers,
  maxUploadSize,
  setMaxUploadSize,
  messageRetention,
  setMessageRetention,
  isLoading,
  hasChanges,
  roles,
  bans,
  isOwner,
  onSaveSettings,
  onShowDeleteServer,
}: OverviewTabProps) {
  return (
    <div className="space-y-8 max-w-2xl">
      <p className="text-muted-foreground">Manage your server settings and view statistics</p>

      <div className="space-y-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
            {serverName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Server Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50 border-0 h-11"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            placeholder="Tell people what your server is about"
            className="bg-secondary/50 border-0 h-11"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
          <div className="space-y-1">
            <div className="text-sm font-medium">Discoverable</div>
            <div className="text-xs text-muted-foreground">
              Allow this server to be found in public discovery
            </div>
          </div>
          <Switch
            checked={isDiscoverable}
            onCheckedChange={setIsDiscoverable}
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Max Users
            </label>
            <Input
              type="number"
              value={maxUsers}
              onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
              disabled={isLoading}
              className="bg-secondary/50 border-0 h-11"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Max Upload (MB)
            </label>
            <Input
              type="number"
              value={maxUploadSize}
              onChange={(e) => setMaxUploadSize(parseInt(e.target.value) || 0)}
              disabled={isLoading}
              className="bg-secondary/50 border-0 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Message Retention
          </label>
          <Input
            value={messageRetention}
            onChange={(e) => setMessageRetention(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. 30d, 1y, forever"
            className="bg-secondary/50 border-0 h-11"
          />
          <p className="text-xs text-muted-foreground">
            How long to keep messages before deletion (e.g. '30d', '1y')
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSaveSettings} disabled={isLoading || !hasChanges}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="h-px bg-border/50" />
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FontAwesomeIcon icon="users" className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Roles</span>
          </div>
          <p className="text-3xl font-bold">{roles.length}</p>
        </div>
        <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FontAwesomeIcon icon="ban" className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Bans</span>
          </div>
          <p className="text-3xl font-bold">{bans.length}</p>
        </div>
      </div>

      {isOwner && (
        <>
          <div className="h-px bg-border/50" />
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
              Danger Zone
            </h3>
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium text-foreground">Delete Server</div>
                <div className="text-sm text-muted-foreground">
                  Permanently delete this server and all its data
                </div>
              </div>
              <Button variant="destructive" onClick={onShowDeleteServer}>
                Delete Server
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
