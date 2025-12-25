import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth } from "../context/AuthContext";
import { cryptoService, type RecoveryKeyData } from "../core/crypto/crypto";
import { recoveryService } from "../core/auth/RecoveryService";

interface LocationState {
  keys?: {
    kem_secret_key: number[];
    dsa_secret_key: number[];
  };
}

export function RecoveryKit() {
  const [recoveryKey, setRecoveryKey] = useState<string>("");
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [recoveryData, setRecoveryData] = useState<RecoveryKeyData | null>(null);

  const { user, keys, completeRecoverySetup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  useEffect(() => {
    const generateRecovery = async () => {
      try {
        const secretKeys = locationState?.keys || keys;
        if (!secretKeys) {
          setError("No keys available. Please log in again.");
          setIsLoading(false);
          return;
        }

        const newRecoveryKey = await cryptoService.generateRecoveryKey();
        const data = await cryptoService.encryptKeysWithRecovery(
          newRecoveryKey,
          secretKeys.kem_secret_key,
          secretKeys.dsa_secret_key
        );

        setRecoveryKey(cryptoService.bytesToHex(newRecoveryKey));
        setRecoveryData(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate recovery key");
        setIsLoading(false);
      }
    };

    generateRecovery();
  }, [keys, locationState?.keys]);

  const handleDownload = () => {
    const content = `CONFIDE RECOVERY KIT
====================

IMPORTANT: Keep this file safe and private!
This recovery key is the ONLY way to recover your account if you forget your password.

Username: ${user?.username}
Recovery Key: ${recoveryKey}

Instructions:
1. Store this file in a secure location (password manager, encrypted drive, etc.)
2. Do NOT share this key with anyone
3. If you lose access to your password, use this key to reset it

Generated: ${new Date().toISOString()}
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `confide-recovery-kit-${user?.username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const handleComplete = async () => {
    if (!recoveryData) {
      setError("Recovery data not available");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await recoveryService.setupRecovery({
        recovery_kem_encrypted_private: recoveryData.recovery_kem_encrypted_private,
        recovery_dsa_encrypted_private: recoveryData.recovery_dsa_encrypted_private,
        recovery_key_salt: recoveryData.recovery_key_salt,
      });

      completeRecoverySetup();
      navigate("/chat", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recovery data");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10">
        <div className="text-center">
          <FontAwesomeIcon icon="spinner" className="w-8 h-8 mx-auto mb-4 text-primary" spin />
          <p className="text-muted-foreground">Generating your recovery kit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/10">
          <FontAwesomeIcon icon="shield-halved" className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Save Your Recovery Kit</h1>
        <p className="text-sm text-muted-foreground">
          This is the only way to recover your account if you forget your password
        </p>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Your Recovery Key</label>
          <div className="relative">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 font-mono text-xs break-all select-all text-foreground">
              {recoveryKey}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-md transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <FontAwesomeIcon icon="check" className="w-4 h-4 text-green-500" />
              ) : (
                <FontAwesomeIcon icon="copy" className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-lg font-medium transition-all flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon="download" className="w-4 h-4" />
          Download Recovery Kit
          {hasDownloaded && (
            <FontAwesomeIcon icon="circle-check" className="w-4 h-4 text-green-500" />
          )}
        </button>

        <div className="border-t border-white/10 pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasAcknowledged}
              onChange={(e) => setHasAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
            />
            <span className="text-sm text-muted-foreground">
              I have saved my recovery key in a secure location and understand that losing it means
              I will not be able to recover my account if I forget my password.
            </span>
          </label>
        </div>

        <button
          onClick={handleComplete}
          disabled={!hasDownloaded || !hasAcknowledged || isSaving}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {isSaving && <FontAwesomeIcon icon="spinner" className="w-4 h-4" spin />}
          {isSaving ? "Saving..." : "Continue to Chat"}
        </button>
      </div>
    </div>
  );
}
