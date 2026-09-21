"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/api/users";

const ASSIGN_RUT_ROUTE = "/onboarding/asignar-rut";

/* Si la cuenta no tiene RUT personal, manda al paso del wizard.
   Fail-safe: solo redirige con dato presente, fresco y `rut` vacío.
   Lo monta (app)/layout; el grupo onboarding no lo monta (evita loop). */

export function UserRutGuard() {
  const router = useRouter();
  const { data, isSuccess, isFetching, isError } = useMe();
  const redirected = React.useRef(false);

  React.useEffect(() => {
    if (redirected.current) return;
    if (!isSuccess || isFetching || isError) return;
    const rut = data?.user?.rut;
    if (rut) return;
    redirected.current = true;
    router.replace(ASSIGN_RUT_ROUTE);
  }, [data, isSuccess, isFetching, isError, router]);

  return null;
}
