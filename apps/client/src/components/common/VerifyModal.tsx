import { useState, useEffect } from "react";
import { cryptoService } from "../../core/crypto/crypto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ourUsername: string;
  theirUsername: string;
  ourIdentityKey: number[];
  theirIdentityKey: number[];
}

export function VerifyModal({
  isOpen,
  onClose,
  ourUsername,
  theirUsername,
  ourIdentityKey,
  theirIdentityKey,
}: VerifyModalProps) {
  const [safetyNumber, setSafetyNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (isOpen && ourIdentityKey.length > 0 && theirIdentityKey.length > 0) {
      setLoading(true);
      cryptoService.generateSafetyNumber(ourIdentityKey, theirIdentityKey)
        .then((number) => {
          setSafetyNumber(number);
          setLoading(false);
        })
        .catch(() => {
          setSafetyNumber("Unable to generate");
          setLoading(false);
        });
    }
  }, [isOpen, ourIdentityKey, theirIdentityKey]);

  useEffect(() => {
    if (!isOpen) {
      setShowInfo(false);
    }
  }, [isOpen]);

  const groups = safetyNumber.split(" ");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Verify Security</DialogTitle>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                showInfo
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              title="How does this work?"
            >
              ?
            </button>
          </div>
        </DialogHeader>

        {showInfo ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">How is this number generated?</strong>
            </p>
            <p>
              This safety number is created by combining both users' public identity keys and hashing them together. The result is a unique fingerprint that represents your specific encrypted connection.
            </p>
            <p>
              <strong className="text-foreground">Why does this work?</strong>
            </p>
            <p>
              If an attacker tried to intercept your messages (a "man-in-the-middle" attack), they would need to use their own keys instead of your friend's real keyService. This would produce a completely different safety number.
            </p>
            <p>
              By comparing these numbers in person or through a trusted channel (like a phone call), you can confirm that no one is secretly intercepting your conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-sm">
                Compare these numbers with <strong className="text-foreground">{theirUsername}</strong> to verify your secure connection.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-2 text-center">
                    Safety Number for {ourUsername} and {theirUsername}
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-mono text-lg text-center">
                    {groups.slice(0, 12).map((group, i) => (
                      <span key={i} className="text-foreground">{group}</span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  If these numbers match on both devices, your conversation is secure.
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}