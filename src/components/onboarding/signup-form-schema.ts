import { z } from "zod";
import { isValidRut } from "@/lib/validators/rut";

/* Schema del formulario de signup (paso 1 del onboarding). Alineado al contrato
   real `SignupRequest`: owner (persona) + empresa. owner_rut y company_rut son
   requeridos (decisión de producto: el RUT de la empresa es obligatorio, aunque
   el backend lo acepte opcional). RUTs validados con dígito verificador
   (isValidRut), igual que el login. El backend valida unicidad y el captcha. */

export const signupFormSchema = z.object({
  ownerFullName: z.string().trim().min(2, "Ingresa tu nombre."),
  ownerRut: z.string().trim().min(1, "Ingresa tu RUT.").refine(isValidRut, "RUT inválido."),
  email: z.string().trim().email("Ingresa un email válido."),
  password: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
  companyName: z.string().trim().min(2, "Ingresa la razón social de tu empresa."),
  companyRut: z
    .string()
    .trim()
    .min(1, "Ingresa el RUT de la empresa.")
    .refine(isValidRut, "RUT inválido."),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;
