import { useCallback, useRef, useState } from "react";

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  cooldownMs?: number;
}

export interface RateLimitState {
  isLimited: boolean;
  remainingTime: number;
  attemptsLeft: number;
  cooldownMessage: string;
}

/**
 * Hook for rate limiting user actions
 * Prevents brute force attacks on login and other sensitive operations
 */
export function useRateLimit(config: RateLimitConfig) {
  const [state, setState] = useState<RateLimitState>({
    isLimited: false,
    remainingTime: 0,
    attemptsLeft: config.maxAttempts,
    cooldownMessage: "",
  });

  const attemptsRef = useRef<number[]>([]);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    attemptsRef.current = [];
    setState({
      isLimited: false,
      remainingTime: 0,
      attemptsLeft: config.maxAttempts,
      cooldownMessage: "",
    });
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, [config.maxAttempts]);

  const recordAttempt = useCallback(
    (success: boolean = false) => {
      if (success) {
        reset();
        return;
      }

      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Remove old attempts outside the window
      attemptsRef.current = attemptsRef.current.filter((time) => time > windowStart);

      // Add new attempt
      attemptsRef.current.push(now);

      const attemptsInWindow = attemptsRef.current.length;

      if (attemptsInWindow >= config.maxAttempts) {
        const cooldownDuration = config.cooldownMs || 60000; // Default 1 minute
        const cooldownSeconds = Math.ceil(cooldownDuration / 1000);

        setState({
          isLimited: true,
          remainingTime: cooldownDuration,
          attemptsLeft: 0,
          cooldownMessage: `Muitas tentativas. Aguarde ${cooldownSeconds}s.`,
        });

        // Start countdown
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
        }

        let remaining = cooldownDuration;
        cooldownTimerRef.current = setInterval(() => {
          remaining -= 1000;

          if (remaining <= 0) {
            clearInterval(cooldownTimerRef.current!);
            cooldownTimerRef.current = null;
            reset();
          } else {
            const remainingSeconds = Math.ceil(remaining / 1000);
            setState((prev) => ({
              ...prev,
              remainingTime: remaining,
              cooldownMessage: `Muitas tentativas. Aguarde ${remainingSeconds}s.`,
            }));
          }
        }, 1000);
      } else {
        setState((prev) => ({
          ...prev,
          attemptsLeft: Math.max(0, config.maxAttempts - attemptsInWindow),
        }));
      }
    },
    [config.windowMs, config.maxAttempts, config.cooldownMs, reset]
  );

  return {
    ...state,
    recordAttempt,
    reset,
  };
}
