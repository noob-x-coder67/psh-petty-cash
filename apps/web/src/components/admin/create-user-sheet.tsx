"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateUserRequestSchema, type CreateUserRequest, type CreateUserResult } from "@psh/contracts";
import {
  Alert,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
} from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { ROLE_LABELS, ROLE_OPTIONS } from "./role-labels";

// Super-Admin-only (admin.manage_users_units) — the caller gates whether this can even
// be opened; the server independently enforces the same permission on POST /admin/users.
export function CreateUserSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserRequest>({
    resolver: zodResolver(CreateUserRequestSchema),
    defaultValues: { email: "", username: "", fullName: "", role: "UNIT_USER" },
  });

  function handleClose(): void {
    setCreated(null);
    setServerError(null);
    reset();
    onOpenChange(false);
  }

  async function onSubmit(values: CreateUserRequest): Promise<void> {
    setServerError(null);
    try {
      const result = await apiFetch<CreateUserResult>("/admin/users", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setCreated(result);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to create user");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>Create user</SheetTitle>

        {created ? (
          <div className="mt-4 flex flex-col gap-4">
            <Alert
              variant="success"
              title="User created"
              // The one-time temporary password — shown exactly once, never retrievable
              // again from this screen (a reset issues a new one, it doesn't reveal this).
            >
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-sm text-ink-muted">
                  Share this temporary password with {created.user.fullName} — it won&apos;t be shown again. They&apos;ll be
                  required to change it on first login.
                </p>
                <code className="rounded-control border border-border bg-surface-0 px-3 py-2 text-sm font-mono text-ink select-all">
                  {created.temporaryPassword}
                </code>
              </div>
            </Alert>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="mt-4 flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-fullName">Full name</Label>
              <Input id="create-fullName" {...register("fullName")} />
              {errors.fullName ? <p className="text-xs text-coral-500">{errors.fullName.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" type="email" {...register("email")} />
              {errors.email ? <p className="text-xs text-coral-500">{errors.email.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-username">Username</Label>
              <Input id="create-username" {...register("username")} />
              {errors.username ? <p className="text-xs text-coral-500">{errors.username.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="create-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
