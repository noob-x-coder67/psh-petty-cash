"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoginRequestSchema, type LoginRequest, type LoginResponse } from "@psh/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@psh/ui";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";

// SRS §12.1 Login: "Animated PSH identity mark, secure sign-in panel, demo environment
// badge, clean background motion, no unnecessary marketing content." Previously just the
// sign-in panel — this fills in the other three, reusing the masthead's exact env-badge
// styling (masthead.tsx) and the shared reveal/stagger variants (lib/motion.ts) that the
// Command Center uses for its own entry animation, so login and post-login entry read as
// one consistent motion language rather than two different ones.
function IdentityMark({ reducedMotion }: { reducedMotion: boolean }) {
  const environment = process.env.NEXT_PUBLIC_APP_ENV;
  const envBadge = environment && environment !== "production" ? environment : null;

  return (
    <motion.div
      className="flex flex-col items-center gap-3 text-center"
      initial={reducedMotion ? false : "hidden"}
      animate={reducedMotion ? false : "visible"}
      variants={revealVariants}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-midnight-900 text-lg font-semibold tracking-wide text-white">
        PSH
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-base font-semibold text-ink">PSH Petty Cash</span>
        <span className="text-xs text-ink-muted">Petty Cash Management &amp; Monitoring</span>
      </div>
      {envBadge ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-500">
          {envBadge}
        </span>
      ) : null}
    </motion.div>
  );
}

// "Clean background motion" — two soft, low-opacity blurred fields drifting slowly behind
// the panel. Purely ambient (aria-hidden, pointer-events-none); frozen to a static
// position rather than animated when the user prefers reduced motion (SRS §13.2).
function LoginBackground({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-royal-100 blur-3xl"
        animate={reducedMotion ? undefined : { x: [0, 24, 0], y: [0, 16, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-100 blur-3xl"
        animate={reducedMotion ? undefined : { x: [0, -20, 0], y: [0, -16, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(LoginRequestSchema) });

  async function onSubmit(values: LoginRequest): Promise<void> {
    setServerError(null);
    try {
      await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-0 p-4">
      <LoginBackground reducedMotion={reducedMotion} />
      <motion.div
        className="relative flex flex-col items-center gap-6"
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? false : "visible"}
        variants={staggerContainer(120)}
      >
        <IdentityMark reducedMotion={reducedMotion} />
        <motion.div variants={revealVariants} className="w-full">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                className="flex flex-col gap-4"
                noValidate
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="username" {...register("email")} />
                  {errors.email ? <p className="text-xs text-coral-500">{errors.email.message}</p> : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
                  {errors.password ? <p className="text-xs text-coral-500">{errors.password.message}</p> : null}
                </div>
                {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </main>
  );
}
