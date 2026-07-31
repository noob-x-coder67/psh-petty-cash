"use client";

import { useEffect, useState, type ReactNode } from "react";
import { randomUuid } from "../lib/random-uuid.js";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast.js";

// Minimal imperative toast store (the standard shadcn `use-toast` reducer pattern) —
// gives call sites a Sonner-style `toast({ title, description })` API without pulling
// in Sonner as a new dependency; the actual rendering underneath is the Radix Toast
// primitive above, already restyled to this design system.
interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "info" | "success" | "danger";
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(toasts);
}

export function toast(item: Omit<ToastItem, "id">): void {
  const id = randomUuid();
  toasts = [...toasts, { id, duration: 5000, ...item }];
  emit();
}

function dismiss(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast(): { toasts: ToastItem[] } {
  const [state, setState] = useState(toasts);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { toasts: state };
}

// Mount once near the root (alongside TooltipProvider) — see apps/web/src/app/layout.tsx.
export function Toaster(): ReactNode {
  const { toasts: active } = useToast();
  return (
    <ToastProvider swipeDirection="right">
      {active.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          duration={t.duration}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        >
          <ToastTitle>{t.title}</ToastTitle>
          {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
