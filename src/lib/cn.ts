import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees));
}
