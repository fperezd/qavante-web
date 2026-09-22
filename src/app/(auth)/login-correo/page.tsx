import { Suspense } from "react";
import { LoginCorreoForm } from "@/components/forms/login-correo-form";

export default function LoginCorreoPage() {
  return (
    <Suspense fallback={null}>
      <LoginCorreoForm />
    </Suspense>
  );
}
