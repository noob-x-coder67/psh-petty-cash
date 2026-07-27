"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoginRequestSchema, type LoginRequest, type LoginResponse } from "@psh/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";

export default function LoginPage() {
  const router = useRouter();
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
    <main className="flex min-h-screen items-center justify-center bg-surface-0 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>PSH Petty Cash</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4" noValidate>
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
    </main>
  );
}
