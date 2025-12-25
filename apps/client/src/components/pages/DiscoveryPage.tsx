import { useState, useEffect, useCallback } from "react";
import { useServer } from "../../context/server";
import { discoveryService } from "../../features/discovery/DiscoveryService";
import type { DiscoverableServer } from "../../features/discovery/DiscoveryService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Compass, Search, Users, Globe, Loader2, ServerCrash, ArrowRight } from "lucide-react";

interface DiscoveryPageProps {
  onClose?: () => void;
}

export function DiscoveryPage({ onClose }: DiscoveryPageProps) {
  const { joinServerByDomain, federatedServers } = useServer();
  const [servers, setServers] = useState<DiscoverableServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [joiningServer, setJoiningServer] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadServers = useCallback(async (offset: number = 0, query?: string) => {
    try {
      setIsLoading(true);
      setError("");

      let response;
      if (query && query.trim()) {
        response = await discoveryService.searchServers(query.trim(), limit, offset);
      } else {
        response = await discoveryService.listServers(limit, offset);
      }

      setServers(response.servers);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load servers");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    loadServers(0);
  }, [loadServers]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setPage(0);
    await loadServers(0, searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setPage(0);
    loadServers(0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadServers(newPage * limit, searchQuery);
  };

  const handleJoinServer = async (server: DiscoverableServer) => {
    setJoiningServer(server.id);
    setError("");

    try {
      await joinServerByDomain(server.domain);
      if (onClose) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join server");
    } finally {
      setJoiningServer(null);
    }
  };

  const isAlreadyJoined = (server: DiscoverableServer) => {
    return federatedServers.some(s => s.id === server.id || s.domain === server.domain);
  };

  const formatMemberCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center px-6 py-4 border-b border-border shadow-sm min-h-[60px]">
        <div className="flex items-center gap-2 mr-6 text-foreground">
          <Compass className="w-5 h-5" />
          <span className="font-bold text-lg">Discover Servers</span>
        </div>
        <div className="flex-1" />
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Back
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="max-w-4xl w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Find your community</h2>
            <p className="text-muted-foreground">
              Browse community servers that are open for anyone to join.
            </p>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search servers by name or description..."
                  className="pl-10 bg-secondary/50 border-transparent focus:border-primary h-12"
                />
              </div>
              <Button type="submit" disabled={isSearching} className="h-12 px-6">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
              {searchQuery && (
                <Button type="button" variant="outline" onClick={handleClearSearch} className="h-12">
                  Clear
                </Button>
              )}
            </div>
          </form>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <ServerCrash className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading servers...</p>
              </div>
            ) : servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <div className="w-24 h-24 bg-secondary/50 rounded-full mb-6 flex items-center justify-center">
                  <Globe className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">
                  {searchQuery ? "No servers found matching your search." : "No servers available yet."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-4 px-2 tracking-wider">
                  {searchQuery ? `Search Results — ${total}` : `Community Servers — ${total}`}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {servers.map((server) => {
                    const joined = isAlreadyJoined(server);
                    const isJoining = joiningServer === server.id;

                    return (
                      <div
                        key={server.id}
                        className="group flex flex-col p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all"
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border/50">
                            {server.icon_url ? (
                              <img
                                src={server.icon_url}
                                alt={server.display_name}
                                className="w-full h-full rounded-xl object-cover"
                              />
                            ) : (
                              <span className="text-xl font-bold text-primary">
                                {server.display_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-lg truncate">
                              {server.display_name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Users className="w-3 h-3" />
                              <span>{formatMemberCount(server.member_count)} members</span>
                            </div>
                          </div>
                        </div>

                        {server.description && (
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {server.description}
                          </p>
                        )}

                        <div className="mt-auto pt-2">
                          {joined ? (
                            <Button variant="secondary" className="w-full" disabled>
                              Already Joined
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleJoinServer(server)}
                              disabled={isJoining}
                              className="w-full group/btn"
                            >
                              {isJoining ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Joining...
                                </>
                              ) : (
                                <>
                                  Join Server
                                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}