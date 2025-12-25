import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { ScrollArea } from "../../ui/scroll-area";
import { Trash2, ArrowLeft } from "lucide-react";
import { Panel } from "../../layout/Panel";
import type { ServerRole } from "../../../features/servers/types";
import { PERMISSION_GROUPS } from "./types";

interface RoleEditorProps {
  role: ServerRole;
  roleName: string;
  isLoading: boolean;
  onBack: () => void;
  onRoleNameChange: (name: string) => void;
  onRoleNameBlur: () => void;
  onColorChange: (color: string) => void;
  onTogglePermission: (role: ServerRole, perm: number) => void;
  onDelete: () => void;
}

export function RoleEditor({
  role,
  roleName,
  isLoading,
  onBack,
  onRoleNameChange,
  onRoleNameBlur,
  onColorChange,
  onTogglePermission,
  onDelete,
}: RoleEditorProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background p-3 flex flex-col">
      <Panel className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: role.color || "#71717a" }}
            />
            <div>
              <Input
                value={roleName}
                onChange={(e) => onRoleNameChange(e.target.value)}
                onBlur={onRoleNameBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="h-8 px-2 bg-secondary/30 border-0 font-semibold"
                style={{ color: role.color || 'inherit' }}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Edit role permissions</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Role Color
              </h3>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={role.color || "#5865F2"}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="w-14 h-14 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                />
                <Input
                  value={role.color || "#5865F2"}
                  onChange={(e) => {
                    const color = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                      onColorChange(color);
                    }
                  }}
                  className="w-32 font-mono bg-secondary border-0"
                />
              </div>
            </div>

            <div className="h-px bg-border/50" />

            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Permissions
              </h3>

              {PERMISSION_GROUPS.map((group) => (
                <div key={group.name} className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">{group.name}</h4>
                  <div className="space-y-2">
                    {group.permissions.map((perm) => (
                      <div
                        key={perm.value}
                        className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="space-y-1 pr-4">
                          <div className="text-sm font-medium">{perm.name}</div>
                          <div className="text-xs text-muted-foreground">{perm.description}</div>
                        </div>
                        <Switch
                          checked={(role.permissions & perm.value) !== 0}
                          onCheckedChange={() => onTogglePermission(role, perm.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </Panel>
    </div>
  );
}
