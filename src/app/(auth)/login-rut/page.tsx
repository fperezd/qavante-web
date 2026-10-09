import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginRutPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
