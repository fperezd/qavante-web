import { describe, it, expect } from "vitest";
import { signupFormSchema } from "./signup-form-schema";

const valid = {
  name: "Fernando Pérez",
  email: "fernando@tooxs.com",
  password: "claveSegura1",
  companyName: "Tooxs SpA",
  companyRut: "76.123.456-7",
};

describe("signupFormSchema", () => {
  it("acepta un formulario válido", () => {
    expect(signupFormSchema.safeParse(valid).success).toBe(true);
  });

  it("acepta RUT sin puntos y con K", () => {
    expect(signupFormSchema.safeParse({ ...valid, companyRut: "12345678-K" }).success).toBe(true);
  });

  it("rechaza email inválido", () => {
    expect(signupFormSchema.safeParse({ ...valid, email: "no-es-email" }).success).toBe(false);
  });

  it("rechaza clave corta (<8)", () => {
    expect(signupFormSchema.safeParse({ ...valid, password: "corta" }).success).toBe(false);
  });

  it("rechaza RUT con formato inválido", () => {
    expect(signupFormSchema.safeParse({ ...valid, companyRut: "123" }).success).toBe(false);
  });

  it("rechaza nombre/razón social vacíos", () => {
    expect(signupFormSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(signupFormSchema.safeParse({ ...valid, companyName: "" }).success).toBe(false);
  });
});
