import { Button } from "../../ui/button";
import { Ban } from "lucide-react";
import type { ServerBan } from "../../../features/servers/types";

interface BansTabProps {
  bans: ServerBan[];
  isLoading: boolean;
  onUnban: (userId: string) => void;
}

export function BansTab({ bans, isLoading, onUnban }: BansTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-muted-foreground">
        View and manage banned members
      </p>

      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : bans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <Ban className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Banned Members</h3>
            <p className="text-sm text-muted-foreground">
              Members you ban from this server will appear here
            </p>
          </div>
        ) : (
          bans.map((ban) => (
            <div
              key={ban.id}
              className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Ban className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">User {ban.user_id.slice(0, 8)}...</div>
                  <div className="text-xs text-muted-foreground">
                    Banned on {new Date(ban.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => onUnban(ban.user_id)}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                Revoke Ban
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
