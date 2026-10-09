import { z } from "zod";
import { isValidRut } from "@/lib/validators/rut";

/* Paso 1 — solo cuenta (persona). Paso 2 — empresas (una o más). */

export const signupAccountSchema = z
  .object({
    ownerFullName: z.string().trim().min(2, "Ingresa tu nombre."),
    ownerRut: z.string().trim().min(1, "Ingresa tu RUT.").refine(isValidRut, "RUT inválido."),
    email: z.string().trim().email("Ingresa un email válido."),
    password: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
    passwordConfirmation: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirmation"],
        message: "Vuelve a ingresar la clave.",
      });
      return;
    }
    if (data.password !== data.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirmation"],
        message: "Las claves no coinciden.",
      });
    }
  });

export type SignupAccountValues = z.infer<typeof signupAccountSchema>;

export const signupCompanyEntrySchema = z.object({
  companyName: z.string().trim().min(2, "Ingresa la razón social."),
  companyRut: z
    .string()
    .trim()
    .min(1, "Ingresa el RUT de la empresa.")
    .refine(isValidRut, "RUT inválido."),
});

export type SignupCompanyEntryValues = z.infer<typeof signupCompanyEntrySchema>;
