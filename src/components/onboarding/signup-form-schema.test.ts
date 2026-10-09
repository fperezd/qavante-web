import { describe, it, expect } from "vitest";
import { signupAccountSchema, signupCompanyEntrySchema } from "./signup-form-schema";

const validAccount = {
  ownerFullName: "Fernando Pérez",
  ownerRut: "11.111.111-1",
  email: "fernando@tooxs.com",
  password: "claveSegura1",
  passwordConfirmation: "claveSegura1",
};

const validCompany = {
  companyName: "Tooxs SpA",
  companyRut: "76.123.456-0",
};

describe("signupAccountSchema", () => {
  it("acepta un formulario válido", () => {
    expect(signupAccountSchema.safeParse(validAccount).success).toBe(true);
  });

  it("rechaza owner_rut inválido", () => {
    expect(
      signupAccountSchema.safeParse({ ...validAccount, ownerRut: "11.111.111-9" }).success,
    ).toBe(false);
  });

  it("rechaza claves que no coinciden", () => {
    const parsed = signupAccountSchema.safeParse({
      ...validAccount,
      passwordConfirmation: "otraClave9",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("signupCompanyEntrySchema", () => {
  it("acepta empresa válida", () => {
    expect(signupCompanyEntrySchema.safeParse(validCompany).success).toBe(true);
  });

  it("rechaza RUT vacío", () => {
    expect(signupCompanyEntrySchema.safeParse({ ...validCompany, companyRut: "" }).success).toBe(
      false,
    );
  });

  it("rechaza razón social vacía", () => {
    expect(signupCompanyEntrySchema.safeParse({ ...validCompany, companyName: "" }).success).toBe(
      false,
    );
  });
});
