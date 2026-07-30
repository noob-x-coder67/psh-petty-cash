"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChangePasswordRequestSchema, type ChangePasswordRequest } from "@psh/contracts";
import { Button, Card, CardContent, Label } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { PasswordField } from "./password-field";

// Closes the temp-password loop: a Super-Admin-created or -reset account has
// mustChangePassword forced true, and (app)/layout.tsx server-side-redirects here on
// every route until it's cleared — this form is the only way off this page.
export function ChangePasswordForm({ fullName }: { fullName: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordRequest>({ resolver: zodResolver(ChangePasswordRequestSchema) });

  async function onSubmit(values: ChangePasswordRequest): Promise<void> {
    setServerError(null);
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(values) });
      router.push("/");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to change password");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-105">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <h1 className="text-lg font-semibold text-ink">Set a new password</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Welcome, {fullName}. Your account was created or reset with a temporary password — set a new one to
              continue.
            </p>
          </div>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword">Temporary password</Label>
              <PasswordField id="currentPassword" autoComplete="current-password" {...register("currentPassword")} />
              {errors.currentPassword ? <p className="text-xs text-coral-500">{errors.currentPassword.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">New password (12+ characters)</Label>
              <PasswordField id="newPassword" autoComplete="new-password" {...register("newPassword")} />
              {errors.newPassword ? <p className="text-xs text-coral-500">{errors.newPassword.message}</p> : null}
            </div>
            {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Setting password…" : "Set new password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
