import { describe, it, expect } from "vitest";
import { signupFormSchema } from "./signup-form-schema";

/* RUTs válidos (dígito verificador correcto): 11.111.111-1, 76.123.456-0. */
const valid = {
  ownerFullName: "Fernando Pérez",
  ownerRut: "11.111.111-1",
  email: "fernando@tooxs.com",
  password: "claveSegura1",
  companyName: "Tooxs SpA",
  companyRut: "76.123.456-0",
};

describe("signupFormSchema", () => {
  it("acepta un formulario válido", () => {
    expect(signupFormSchema.safeParse(valid).success).toBe(true);
  });

  it("company_rut es opcional (vacío permitido)", () => {
    expect(signupFormSchema.safeParse({ ...valid, companyRut: "" }).success).toBe(true);
  });

  it("rechaza owner_rut inválido (dígito verificador)", () => {
    expect(signupFormSchema.safeParse({ ...valid, ownerRut: "11.111.111-9" }).success).toBe(false);
  });

  it("rechaza company_rut con formato/dv inválido si viene", () => {
    expect(signupFormSchema.safeParse({ ...valid, companyRut: "123" }).success).toBe(false);
  });

  it("rechaza email inválido", () => {
    expect(signupFormSchema.safeParse({ ...valid, email: "no-es-email" }).success).toBe(false);
  });

  it("rechaza clave corta (<8)", () => {
    expect(signupFormSchema.safeParse({ ...valid, password: "corta" }).success).toBe(false);
  });

  it("rechaza nombre / razón social vacíos", () => {
    expect(signupFormSchema.safeParse({ ...valid, ownerFullName: " " }).success).toBe(false);
    expect(signupFormSchema.safeParse({ ...valid, companyName: "" }).success).toBe(false);
  });
});
