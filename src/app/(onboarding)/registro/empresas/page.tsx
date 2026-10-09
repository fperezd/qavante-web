import { Suspense } from "react";
import { SignupCompaniesView } from "@/components/onboarding/signup-companies-view";

export default function RegistroEmpresasPage() {
  return (
    <Suspense fallback={null}>
      <SignupCompaniesView />
    </Suspense>
  );
}
