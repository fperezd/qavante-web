"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { RoleSelect } from "./role-select";
import { useInviteUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import type { UserRole } from "@/lib/auth/types";

const inviteSchema = z.object({
  email: z.string().min(1, "Email requerido").email("Email inválido"),
  name: z.string().optional(),
  role: z
    .string()
    .min(1, "Selecciona un rol")
    .refine((v) => v !== "", "Selecciona un rol"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole?: UserRole;
}

export function InviteUserDialog({ open, onOpenChange, currentUserRole }: InviteUserDialogProps) {
  const invite = useInviteUser();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "", role: "" },
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (!open) {
      reset();
      setSubmitError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: InviteFormValues) {
    setSubmitError(null);
    try {
      await invite.mutateAsync({
        email: values.email,
        role: values.role as UserRole,
        ...(values.name ? { name: values.name } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "email_already_exists") {
          setSubmitError("Ya hay un usuario con ese email en tu empresa.");
        } else if (err.code === "invitation_already_pending") {
          setSubmitError("Ya hay una invitación pendiente para ese email.");
        } else {
          setSubmitError(apiErrorToUserMessage(err));
        }
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Invitar usuario
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            El usuario va a recibir un email para crear su clave y entrar a Qavante.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="invite-email" className="text-sm font-medium text-neutral-dark">
                Email
              </label>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <QavanteInput
                    id="invite-email"
                    placeholder="usuario@empresa.cl"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.email)}
                    autoComplete="email"
                  />
                )}
              />
              {errors.email && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="invite-name" className="text-sm font-medium text-neutral-dark">
                Nombre <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <QavanteInput
                    id="invite-name"
                    placeholder="Nombre Apellido"
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    autoComplete="name"
                  />
                )}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="invite-role" className="text-sm font-medium text-neutral-dark">
                Rol
              </label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    id="invite-role"
                    value={field.value as UserRole | ""}
                    onChange={field.onChange}
                    invalid={Boolean(errors.role)}
                    excludeOwnerWhenNotOwner
                    currentUserRole={currentUserRole}
                  />
                )}
              />
              {errors.role && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
              >
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
                Cancelar
              </Dialog.Close>
              <QavanteButton type="submit" loading={isSubmitting}>
                Enviar invitación
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
