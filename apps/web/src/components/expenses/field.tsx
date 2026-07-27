import { Label } from "@psh/ui";
import { Children, cloneElement, isValidElement, useId, type ReactElement } from "react";

// Auto-generates a matching id/htmlFor pair and clones it onto the single child input —
// callers just pass one input/textarea/select as children, without having to remember
// to wire a matching id at every call site (a real bug axe-core caught: several fields
// had a visible label with no programmatic association to their input at all).
export function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  const child = Children.only(children);
  const childWithId = isValidElement(child) ? cloneElement(child, { id }) : child;

  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : "flex flex-col gap-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {childWithId}
      {error ? <p className="text-xs text-coral-500">{error}</p> : null}
    </div>
  );
}
