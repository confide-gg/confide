import { Button } from "../../ui/button";
import { Plus, Shield, GripVertical, ArrowLeft } from "lucide-react";
import type { ServerRole } from "../../../features/servers/types";

interface RolesTabProps {
  roles: ServerRole[];
  isLoading: boolean;
  dragOverRoleId: string | null;
  onCreateRole: () => void;
  onSelectRole: (role: ServerRole) => void;
  onStartDrag: (roleId: string, pointerId: number) => void;
}

export function RolesTab({
  roles,
  isLoading,
  dragOverRoleId,
  onCreateRole,
  onSelectRole,
  onStartDrag,
}: RolesTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Create and manage roles for your server members
        </p>
        <Button onClick={onCreateRole} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Role
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Roles</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create roles to organize your server members
            </p>
            <Button onClick={onCreateRole} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Role
            </Button>
          </div>
        ) : (
          roles
            .sort((a, b) => b.position - a.position)
            .map((role) => (
              <div
                key={role.id}
                className={`w-full flex items-center gap-3 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group ${dragOverRoleId === role.id ? "ring-2 ring-primary/50" : ""}`}
                data-role-id={role.id}
              >
                <button
                  type="button"
                  onPointerDown={(e) => onStartDrag(role.id, e.pointerId)}
                  className="text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelectRole(role)}
                  className="flex-1 flex items-center gap-4 text-left min-w-0"
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: role.color || "#71717a" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: role.color || 'inherit' }}>
                      {role.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Drag to reorder • Click to edit
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
