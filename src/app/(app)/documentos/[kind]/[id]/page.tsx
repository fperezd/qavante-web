import { notFound } from "next/navigation";
import { DocumentActionButton } from "@/components/documents/document-actions";

type DocumentKind = "receivable" | "payable";

export default async function DocumentActionPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!isDocumentKind(kind) || !id) notFound();

  const payment = kind === "payable";
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">
          {payment ? "Gestionar pago" : "Gestionar cobro"}
        </h1>
        <p className="mt-1 text-sm text-neutral-mid">
          {payment
            ? "Revisa el documento seleccionado antes de registrar el pago."
            : "Revisa el documento seleccionado antes de registrar el cobro."}
        </p>
      </header>
      <DocumentActionButton
        kind={kind}
        documentId={id}
        label={payment ? "Abrir gestión de pago" : "Abrir gestión de cobro"}
        autoOpen
      />
    </div>
  );
}

function isDocumentKind(value: string): value is DocumentKind {
  return value === "receivable" || value === "payable";
}
