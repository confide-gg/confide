import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Server, Loader2, AlertCircle, Lock, ArrowLeft } from "lucide-react";
import { federationService } from "../../features/servers/federation";

interface JoinServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (domain: string, password?: string) => Promise<void>;
}

export function JoinServerModal({ isOpen, onClose, onJoin }: JoinServerModalProps) {
  const [domain, setDomain] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverInfo, setServerInfo] = useState<{ name: string; has_password: boolean } | null>(null);
  const [step, setStep] = useState<"domain" | "password">("domain");

  const handleCheckServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      setError("Please enter a server domain");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const info = await federationService.getFederatedServerInfo(domain.trim());
      setServerInfo(info);

      if (info.has_password) {
        setStep("password");
      } else {
        await onJoin(domain.trim());
        resetAndClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the server password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onJoin(domain.trim(), password.trim());
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join server");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setDomain("");
    setPassword("");
    setError("");
    setServerInfo(null);
    setStep("domain");
    onClose();
  };

  const handleClose = () => {
    if (!isLoading) {
      resetAndClose();
    }
  };

  const handleBack = () => {
    setStep("domain");
    setPassword("");
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "password" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1"
                onClick={handleBack}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Server className="w-5 h-5 text-primary" />
            {step === "domain" ? "Join a Server" : `Join ${serverInfo?.name || "Server"}`}
          </DialogTitle>
        </DialogHeader>

        {step === "domain" ? (
          <form onSubmit={handleCheckServer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Server Address</Label>
              <Input
                id="domain"
                type="text"
                placeholder="confide.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">
                Ask your server admin for the address
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !domain.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleJoinWithPassword} className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">This server requires a password to join</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50 min-w-0"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !password.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Server"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}