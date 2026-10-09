import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/routes";

type LoginAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `/login` queda como alias hacia el login principal (correo/OAuth). */
export default async function LoginAliasPage({ searchParams }: LoginAliasPageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    qs.set(key, Array.isArray(value) ? value[0]! : value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `${LOGIN_PATH}?${suffix}` : LOGIN_PATH);
}
