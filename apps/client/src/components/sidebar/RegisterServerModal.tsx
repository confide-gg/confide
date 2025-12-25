import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface RegisterServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: RegisterServerData) => Promise<void>;
}

export interface RegisterServerData {
  domain: string;
  setup_token: string;
}

export function RegisterServerModal({ isOpen, onClose, onRegister }: RegisterServerModalProps) {
  const [domain, setDomain] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      setError("Please enter your server address");
      return;
    }
    if (!setupToken.trim()) {
      setError("Please enter the setup token from your server console");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onRegister({
        domain: domain.trim(),
        setup_token: setupToken.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setDomain("");
      setSetupToken("");
      setError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon="server" className="w-5 h-5 text-primary" />
            Register Your Server
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <FontAwesomeIcon icon="circle-check" className="w-12 h-12 text-green-500" />
            <p className="text-center text-muted-foreground">
              Server registered! You can now configure server details in settings.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                The domain or IP address where your server is hosted
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setupToken">Setup Token</Label>
              <Input
                id="setupToken"
                type="text"
                placeholder="Paste token from server console"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Found in your server logs on first startup
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <FontAwesomeIcon icon="circle-exclamation" className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !domain.trim() || !setupToken.trim()}>
                {isLoading ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="w-4 h-4 mr-2" spin />
                    Registering...
                  </>
                ) : (
                  "Register Server"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
