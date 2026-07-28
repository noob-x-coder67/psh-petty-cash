"use client";

import { Input, cn } from "@psh/ui";
import { Eye, EyeOff, Lock } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

// Wraps the shared Input primitive with a leading lock icon and a show/hide toggle —
// kept local to auth/ rather than added to packages/ui since the icon-prefix + reveal
// behavior is specific to this login card, not yet a pattern reused elsewhere.
export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className={cn("h-11 pl-10 pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="psh-focus-ring absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
