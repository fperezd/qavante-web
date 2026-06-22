import { z } from "zod";

/* Schema del formulario de signup (paso 1 del onboarding). Validación
   client-side; el backend valida canónicamente (dígito verificador del RUT,
   unicidad de email/RUT, fuerza de clave). El RUT acá es chequeo de FORMATO
   (con o sin puntos), no de módulo 11. */

const RUT_FORMAT = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;

export const signupFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre."),
  email: z.string().trim().email("Ingresa un email válido."),
  password: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
  companyName: z.string().trim().min(2, "Ingresa la razón social de tu empresa."),
  companyRut: z.string().trim().regex(RUT_FORMAT, "RUT inválido. Formato: 76.123.456-7."),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;
