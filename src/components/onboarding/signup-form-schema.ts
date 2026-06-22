import { z } from "zod";
import { isValidRut } from "@/lib/validators/rut";

/* Schema del formulario de signup (paso 1 del onboarding). Alineado al contrato
   real `SignupRequest`: owner (persona) + empresa. El owner_rut es requerido; el
   company_rut es opcional. RUTs validados con dígito verificador (isValidRut),
   igual que el login. El backend valida unicidad y el captcha (Turnstile). */

export const signupFormSchema = z.object({
  ownerFullName: z.string().trim().min(2, "Ingresa tu nombre."),
  ownerRut: z.string().trim().min(1, "Ingresa tu RUT.").refine(isValidRut, "RUT inválido."),
  email: z.string().trim().email("Ingresa un email válido."),
  password: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
  companyName: z.string().trim().min(2, "Ingresa la razón social de tu empresa."),
  /* Opcional: vacío permitido; si viene, debe ser un RUT válido. */
  companyRut: z
    .string()
    .trim()
    .refine((v) => v.length === 0 || isValidRut(v), "RUT inválido."),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;
