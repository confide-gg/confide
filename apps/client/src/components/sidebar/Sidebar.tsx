import { useState } from "react";
import { Plus } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { SidebarNav } from "./SidebarNav";
import { DmList } from "./DmList";
import { UserProfile } from "./UserProfile";
import { ActiveCallIndicator } from "../calls/ActiveCallIndicator";
import { Panel } from "../layout/Panel";
import { Button } from "../ui/button";
import { CreateGroupModal } from "../groups/CreateGroupModal";
import { useConversations, useFriends, useFriendRequests } from "../../hooks/useQueries";

export function Sidebar() {
  const { friendsList, createGroup } = useChat();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  useConversations();
  useFriends();
  useFriendRequests();

  return (
    <aside className="w-56 h-full overflow-hidden shrink-0">
      <Panel className="h-full flex flex-col">
        <div className="h-14 px-4 flex items-center shrink-0">
          <h2 className="font-semibold text-base truncate text-foreground">Confide</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <SidebarNav />
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Direct Messages
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsCreateGroupOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-2 mt-1">
              <DmList />
            </div>
          </div>
        </div>

        <div className="p-2 space-y-1 shrink-0">
          <ActiveCallIndicator compact />
          <UserProfile />
        </div>
      </Panel>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        friends={friendsList}
        onCreate={async ({ name, icon, memberIds }) => {
          await createGroup({ name, icon, memberIds });
        }}
      />
    </aside>
  );
}
