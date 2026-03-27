"use client";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "error" | "warning";

/**
 * Trigger haptic feedback on supported devices
 */
export function haptic(style: HapticStyle = "light") {
  if (typeof window === "undefined") return;

  const navigator = window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  
  if (!navigator.vibrate) return;

  const patterns: Record<HapticStyle, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: 50,
    success: [15, 50, 15],
    error: [50, 30, 50],
    warning: [30, 50, 30],
  };

  try {
    navigator.vibrate(patterns[style]);
  } catch {
    // Silently fail if vibrate is not supported
  }
}

/**
 * Haptic-enabled button click handler
 */
export function withHaptic<T extends (...args: unknown[]) => void>(
  handler: T,
  style: HapticStyle = "light"
): T {
  return ((...args: unknown[]) => {
    haptic(style);
    return handler(...args);
  }) as T;
}
