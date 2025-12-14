import { SidebarNav } from "./SidebarNav";
import { DmList } from "./DmList";
import { UserProfile } from "./UserProfile";
import { ActiveCallIndicator } from "../calls/ActiveCallIndicator";

export function Sidebar() {
  return (
    <aside className="w-56 bg-background flex flex-col h-screen border-r border-border overflow-hidden shrink-0">
      <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
        <h2 className="font-semibold text-base truncate text-foreground">Confide</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <SidebarNav />
        </div>

        <div className="mt-2">
          <div className="flex items-center px-4 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </span>
          </div>
          <div className="px-2 mt-1">
            <DmList />
          </div>
        </div>
      </div>

      <div className="p-2 space-y-1 shrink-0 border-t border-border">
        <ActiveCallIndicator compact />
        <UserProfile />
      </div>
    </aside>
  );
}
