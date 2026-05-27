"use client";

import * as React from "react";
import type { UserRole } from "@/lib/auth/types";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "./role-labels";
import { cn } from "@/lib/utils";

interface RoleSelectProps {
  id?: string;
  value: UserRole | "";
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  excludeOwnerWhenNotOwner?: boolean;
  currentUserRole?: UserRole;
}

/* Native <select> con styling Qavante. Para C0-15 alcanza sin recurrir a Base UI
   Combobox — keyboard nav, screen reader y mobile pickers nativos vienen gratis.
   Si en C1+ necesitamos search dentro del select, migramos a Combobox. */
export function RoleSelect({
  id,
  value,
  onChange,
  disabled,
  invalid,
  excludeOwnerWhenNotOwner,
  currentUserRole,
  ...props
}: RoleSelectProps) {
  const roles =
    excludeOwnerWhenNotOwner && currentUserRole !== "owner"
      ? ASSIGNABLE_ROLES.filter((r) => r !== "owner")
      : ASSIGNABLE_ROLES;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as UserRole)}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-label={props["aria-label"]}
      className={cn(
        "flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-neutral-dark",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-danger-500" : "border-neutral-light",
      )}
    >
      {value === "" && (
        <option value="" disabled>
          Selecciona un rol…
        </option>
      )}
      {roles.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}
