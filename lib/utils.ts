import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx + tailwind-merge.
 * Used by components like globe-hero.tsx via `import { cn } from "@/lib/utils"`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
