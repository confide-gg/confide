import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(username, password);
      navigate("/recovery-kit", {
        state: { keys: result.keys },
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl mb-6 mx-auto shadow-lg shadow-primary/20">
          C
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Create account</h1>
        <p className="text-sm text-muted-foreground">Join Confide and start chatting securely</p>
      </div>

      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              disabled={isLoading}
              autoComplete="username"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">At least 3 characters</p>
          </div>

          <div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters</p>
          </div>

          <div>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {isLoading && <FontAwesomeIcon icon="spinner" className="w-4 h-4" spin />}
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
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
