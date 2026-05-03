import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function daysUntil(date: string, baseDate = new Date()) {
  const target = new Date(`${date}T12:00:00-03:00`);
  const diffMs = target.getTime() - baseDate.getTime();

  return Math.ceil(diffMs / 86_400_000);
}

export function invariant(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}
