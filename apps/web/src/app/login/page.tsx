"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoginRequestSchema, type LoginRequest, type LoginResponse } from "@psh/contracts";
import { Button, CardContent, Input, Label, Separator, cn } from "@psh/ui";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AnimatedBackground } from "../../components/auth/animated-background";
import { BrandLogo } from "../../components/auth/brand-logo";
import { PasswordField } from "../../components/auth/password-field";
import { ThemeToggle } from "../../components/shell/theme-toggle";
import { apiFetch } from "../../lib/api-client";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";

// Shared glass treatment for both inputs — transparent dark/white-tinted background
// (--color-glass-input, theme-tuned same as the card), translucent border, and a
// blue-violet focus glow instead of the default primitives' opaque surface-1 fill.
const GLASS_INPUT_CLASS =
  "border-glass-input-border bg-glass-input text-ink placeholder:text-ink-muted transition-colors focus-visible:border-royal-500 focus-visible:bg-glass-input-focus focus-visible:shadow-[0_0_0_4px_var(--color-glass-glow)]";

// SRS §12.1 Login: "Animated PSH identity mark, secure sign-in panel, demo environment
// badge, clean background motion." A single centered authentication card — no split
// promotional panel, no feature lists (per the approved visual direction). "Remember me"
// and "Forgot Password" are both omitted rather than faked: LoginRequestSchema has no
// rememberMe field and no forgot/reset-password route exists anywhere in the API.
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
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.push(result.user.mustChangePassword ? "/change-password" : "/");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <AnimatedBackground />

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-135 flex-col items-center gap-6"
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? false : "visible"}
        variants={staggerContainer(120)}
      >
        <motion.div variants={revealVariants} className="relative w-full">
          {/* Soft outer blue-violet glow — sits behind the glass card, larger and softer
              than the card itself so it reads as ambient light bleeding around the
              edges rather than a hard outline. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-110 rounded-4xl bg-glass-glow blur-3xl"
          />
          {/*
            Deliberately a plain div, not the shared <Card> primitive: Card's default
            className bakes in `bg-surface-1` (an opaque background-color). Tailwind's
            arbitrary `bg-[linear-gradient(...)]` sets `background-image`, a DIFFERENT
            CSS property — tailwind-merge doesn't (and correctly, by the spec, can't)
            treat those as conflicting, so both applied at once: an opaque solid color
            sitting directly under the translucent gradient, which is what made the
            panel read as a flat gray/black box no matter how low the gradient's own
            opacity was. Inline styles for the properties that define "glass" sidestep
            that class-merge ambiguity entirely — nothing else can silently coexist
            with them. Colors still come from the same theme-adaptive tokens
            (--color-glass-*, tokens.css) via var(), so light/dark stay correct.
          */}
          <div
            className="relative isolate overflow-hidden rounded-4xl transition-shadow duration-300"
            style={{
              background: "linear-gradient(135deg, var(--color-glass-from), var(--color-glass-to))",
              backdropFilter: "blur(30px) saturate(145%)",
              WebkitBackdropFilter: "blur(30px) saturate(145%)",
              border: "1px solid var(--color-glass-border)",
              boxShadow:
                "0 32px 90px var(--color-glass-shadow), 0 0 45px var(--color-glass-glow), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
          >
            {/* Glass reflection — a soft white highlight biased toward the upper-left,
                fading toward the centre, simulating light catching a glass surface.
                Purely decorative: aria-hidden, pointer-events-none, sits behind the form
                content (CardContent comes after in DOM order = paints on top), clipped
                to the card's own rounded corners by the parent's overflow-hidden. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.17),rgba(255,255,255,0.05)_35%,transparent_65%)]"
            />
            {/* Nearly-invisible grain — keeps the glass surface from reading as a flat
                digital gradient. */}
            <div aria-hidden className="psh-grain pointer-events-none absolute inset-0 opacity-[0.05]" />
            <CardContent className="relative z-10 flex flex-col gap-5 p-6 sm:p-10">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <div
                    aria-hidden
                    className="absolute inset-0 -z-10 scale-125 rounded-full bg-royal-500/30 blur-xl"
                  />
                  <BrandLogo />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-ink">PSH Petty Cash</h1>
                  <p className="text-sm text-ink-muted">Petty Cash Management &amp; Monitoring</p>
                </div>
              </div>
              <Separator className="bg-glass-border" />
              <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                      aria-hidden
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email address"
                      className={cn("h-11 pl-10", GLASS_INPUT_CLASS)}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      {...register("email")}
                    />
                  </div>
                  {errors.email ? (
                    <p id="email-error" className="text-xs text-coral-500">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <PasswordField
                    id="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={GLASS_INPUT_CLASS}
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  {errors.password ? (
                    <p id="password-error" className="text-xs text-coral-500">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                {serverError ? (
                  <motion.p
                    key={serverError}
                    role="alert"
                    initial={reducedMotion ? false : { x: 0 }}
                    animate={reducedMotion ? undefined : { x: [0, -6, 6, -4, 4, 0] }}
                    transition={{ duration: 0.4 }}
                    className="text-sm text-coral-500"
                  >
                    {serverError}
                  </motion.p>
                ) : null}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="group h-11 w-full gap-2 bg-linear-to-r from-royal-600 to-violet-500 shadow-[0_8px_20px_-8px_var(--color-royal-500)] transition-all hover:-translate-y-0.5 hover:from-royal-500 hover:to-violet-500 hover:shadow-[0_10px_28px_-6px_var(--color-royal-500)] active:translate-y-0 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </div>
        </motion.div>

        <motion.div variants={revealVariants} className="flex flex-col items-center gap-2 px-4 text-center">
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Your data is protected with enterprise-grade security.
          </p>
          <p className="text-xs text-ink-muted/70">© 2026 Pakistan Sweet Home. All rights reserved.</p>
        </motion.div>
      </motion.div>
    </main>
  );
}
