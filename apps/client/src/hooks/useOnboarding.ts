import { useState, useCallback } from "react";

const ONBOARDING_KEY = "confide_onboarding_completed";

export function useOnboarding() {
  const [shouldShowWelcome, setShouldShowWelcome] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) !== "true"
  );

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShouldShowWelcome(false);
  }, []);

  return { shouldShowWelcome, completeOnboarding };
}
