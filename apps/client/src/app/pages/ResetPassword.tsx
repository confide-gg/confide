import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cryptoService } from "@/core/crypto/crypto";
import { recoveryService } from "@/core/auth/RecoveryService";
import { httpClient } from "@/core/network/HttpClient";
import { secureKeyStore } from "@/core/crypto/SecureKeyStore";

export function ResetPassword() {
  const [step, setStep] = useState<"username" | "recovery" | "newPassword">("username");
  const [username, setUsername] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [recoveryData, setRecoveryData] = useState<{
    userId: string;
    kemEncrypted: number[];
    dsaEncrypted: number[];
    salt: number[];
  } | null>(null);

  const [decryptedKeys, setDecryptedKeys] = useState<{
    kemSecretKey: number[];
    dsaSecretKey: number[];
  } | null>(null);

  const navigate = useNavigate();

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await recoveryService.getRecoveryData(username);
      setRecoveryData({
        userId: data.user_id,
        kemEncrypted: data.recovery_kem_encrypted_private,
        dsaEncrypted: data.recovery_dsa_encrypted_private,
        salt: data.recovery_key_salt,
      });
      setStep("recovery");
    } catch (err) {
      if (err instanceof Error && err.message.includes("recovery not set up")) {
        setError("Recovery is not set up for this account. Password cannot be reset.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to find account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!recoveryData) {
        throw new Error("Recovery data not available");
      }

      const cleanedKey = recoveryKeyInput.trim().replace(/\s/g, "");
      if (!/^[0-9a-fA-F]{64}$/.test(cleanedKey)) {
        throw new Error("Invalid recovery key format. Expected 64 hex characters.");
      }

      const recoveryKeyBytes = cryptoService.hexToBytes(cleanedKey);

      const keys = await cryptoService.decryptKeysWithRecovery(
        recoveryKeyBytes,
        recoveryData.kemEncrypted,
        recoveryData.dsaEncrypted,
        recoveryData.salt
      );

      setDecryptedKeys({
        kemSecretKey: keys.kem_secret_key,
        dsaSecretKey: keys.dsa_secret_key,
      });
      setStep("newPassword");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid recovery key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!decryptedKeys || !recoveryData) {
      setError("Recovery data not available");
      return;
    }

    setIsLoading(true);

    try {
      const cleanedKey = recoveryKeyInput.trim().replace(/\s/g, "");
      const recoveryKeyBytes = cryptoService.hexToBytes(cleanedKey);

      const encryptedKeys = await cryptoService.generateKeys(newPassword);

      const newDecryptedKeys = await cryptoService.decryptKeys(
        newPassword,
        encryptedKeys.kem_public_key,
        encryptedKeys.kem_encrypted_private,
        encryptedKeys.dsa_public_key,
        encryptedKeys.dsa_encrypted_private,
        encryptedKeys.key_salt
      );

      const newRecoveryData = await cryptoService.encryptKeysWithRecovery(
        recoveryKeyBytes,
        newDecryptedKeys.kem_secret_key,
        newDecryptedKeys.dsa_secret_key
      );

      const response = await recoveryService.resetPassword({
        username,
        new_password: newPassword,
        kem_public_key: encryptedKeys.kem_public_key,
        kem_encrypted_private: encryptedKeys.kem_encrypted_private,
        dsa_public_key: encryptedKeys.dsa_public_key,
        dsa_encrypted_private: encryptedKeys.dsa_encrypted_private,
        key_salt: encryptedKeys.key_salt,
        recovery_kem_encrypted_private: newRecoveryData.recovery_kem_encrypted_private,
        recovery_dsa_encrypted_private: newRecoveryData.recovery_dsa_encrypted_private,
        recovery_key_salt: newRecoveryData.recovery_key_salt,
      });

      await secureKeyStore.saveAuthToken(response.token);
      httpClient.setAuthToken(response.token);

      navigate("/login", {
        replace: true,
        state: { message: "Password reset successful. Please log in with your new password." },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl mb-6 mx-auto shadow-lg shadow-primary/20">
          C
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Reset Password</h1>
        <p className="text-sm text-muted-foreground">
          {step === "username" && "Enter your username to begin"}
          {step === "recovery" && "Enter your recovery key"}
          {step === "newPassword" && "Create a new password"}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {step === "username" && (
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={isLoading}
              autoComplete="username"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {isLoading && <FontAwesomeIcon icon="spinner" className="w-4 h-4" spin />}
            {isLoading ? "Checking..." : "Continue"}
          </button>
        </form>
      )}

      {step === "recovery" && (
        <form onSubmit={handleRecoveryKeySubmit} className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-200/80">
              Enter the recovery key you saved when you created your account.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="recoveryKey" className="text-sm font-medium text-foreground">
              Recovery Key
            </label>
            <textarea
              id="recoveryKey"
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value)}
              placeholder="Paste your 64-character recovery key"
              required
              disabled={isLoading}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("username")}
              disabled={isLoading}
              className="px-4 py-3 bg-white/5 border border-white/10 text-foreground rounded-lg font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !recoveryKeyInput}
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isLoading && <FontAwesomeIcon icon="spinner" className="w-4 h-4" spin />}
              {isLoading ? "Verifying..." : "Verify Key"}
            </button>
          </div>
        </form>
      )}

      {step === "newPassword" && (
        <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
            <p className="text-xs text-green-200/80">
              Recovery key verified! Create your new password below.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("recovery")}
              disabled={isLoading}
              className="px-4 py-3 bg-white/5 border border-white/10 text-foreground rounded-lg font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPassword}
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isLoading && <FontAwesomeIcon icon="spinner" className="w-4 h-4" spin />}
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link
            to="/login"
            className="text-foreground font-medium hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
