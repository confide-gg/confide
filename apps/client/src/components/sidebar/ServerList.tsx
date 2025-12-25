import { useState } from "react";
import { Plus, Globe, HardDrive, Compass } from "lucide-react";
import { useServer } from "../../context/server";
import { useChat } from "../../context/chat";
import { JoinServerModal } from "./JoinServerModal";
import { RegisterServerModal, type RegisterServerData } from "./RegisterServerModal";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import type { AnyServer } from "../../features/servers/types";

interface ServerListProps {
  onOpenDiscovery?: () => void;
}

export function ServerList({ onOpenDiscovery }: ServerListProps) {
  const {
    servers,
    federatedServers,
    activeServer,
    setActiveServer,
    joinServerByDomain,
    registerAndJoinServer,
  } = useServer();
  const { setActiveChat } = useChat();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleServerClick = (server: AnyServer) => {
    setActiveServer(server);
    setActiveChat(null);
  };

  const handleJoinServer = async (domain: string) => {
    await joinServerByDomain(domain);
  };

  const handleRegisterServer = async (data: RegisterServerData) => {
    await registerAndJoinServer(data);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col items-center gap-2 px-1 w-full h-full">
        {servers.length > 0 && <div key="central-divider" className="w-6 h-px bg-border" />}

        {servers.map((server) => (
          <Tooltip key={server.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleServerClick(server)}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 text-sm font-medium",
                  activeServer?.id === server.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {server.icon_url ? (
                  <img
                    src={server.icon_url}
                    alt={server.name}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-lg">{server.name.charAt(0).toUpperCase()}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{server.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {federatedServers.length > 0 && (
          <>
            <div key="fed-divider" className="w-6 h-px bg-border" />
            {federatedServers.map((server) => (
              <Tooltip key={server.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleServerClick(server)}
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 text-sm font-medium relative",
                      activeServer?.id === server.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {server.icon_url ? (
                      <img
                        src={server.icon_url}
                        alt={server.name}
                        className="w-full h-full object-cover rounded-lg"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-lg">{server.name.charAt(0).toUpperCase()}</span>
                    )}
                    <Globe className="w-3 h-3 absolute bottom-1 right-1 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{server.name}</p>
                  <p className="text-xs text-muted-foreground">{server.domain}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Join a Server</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenDiscovery}
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-secondary hover:bg-blue-500/20 text-muted-foreground hover:text-blue-500 transition-all duration-200"
            >
              <Compass className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Discover Servers</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="mt-auto w-12 h-12 rounded-xl flex items-center justify-center bg-secondary hover:bg-green-500/20 text-muted-foreground hover:text-green-500 transition-all duration-200"
            >
              <HardDrive className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Host a Server</p>
          </TooltipContent>
        </Tooltip>

        <JoinServerModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinServer}
        />

        <RegisterServerModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          onRegister={handleRegisterServer}
        />
      </div>
    </TooltipProvider>
  );
}
