"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  useActionDocuments,
  useActionDocument,
  useDocumentAction,
  usePaymentCandidates,
  useRejectPaymentSuggestion,
  type DocumentKind,
  type ActionDetail,
  type PaymentInput,
  type FollowupInput,
  type PaymentMovement,
} from "@/lib/api/document-actions";
import { formatMoney } from "@/lib/formatters/clp";

const button =
  "min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-medium text-brand-primary disabled:opacity-50";
const input = "mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base";
const money = (amount: string | number, currency: string) => formatMoney(Number(amount), currency);
const civilDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const dateLabel = (date: string) => date.split("-").reverse().join("-");

export function DocumentActionButton({
  kind,
  documentId,
  query = "",
  label = "Gestionar",
}: {
  kind: DocumentKind;
  documentId?: string;
  query?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" className={button} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <DocumentActionDialog
          kind={kind}
          initialId={documentId}
          initialQuery={query}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DocumentActionDialog({
  kind,
  initialId,
  initialQuery,
  onClose,
}: {
  kind: DocumentKind;
  initialId?: string;
  initialQuery: string;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = React.useState(initialId);
  const [query, setQuery] = React.useState(initialQuery);
  const [offset, setOffset] = React.useState(0);
  const titleId = React.useId();
  const docs = useActionDocuments(kind, query, offset, !selected);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-neutral-dark shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-xl font-semibold">
          {kind === "payable" ? "Gestionar pago" : "Gestionar cobro"}
        </h2>
        <button className={button} type="button" onClick={onClose} aria-label="Cerrar gestión">
          Cerrar
        </button>
      </header>
      {selected ? (
        <>
          {!initialId && (
            <button type="button" className={button} onClick={() => setSelected(undefined)}>
              Volver a documentos
            </button>
          )}
          <DocumentActionContent key={selected} kind={kind} id={selected} />
        </>
      ) : (
        <>
          <label className="block text-sm">
            Buscar por nombre o folio
            <input
              className={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          {docs.isPending && <p role="status">Cargando documentos…</p>}
          {docs.isError && (
            <p role="alert">
              No se pudieron cargar los documentos.{" "}
              <button className={button} onClick={() => void docs.refetch()}>
                Reintentar
              </button>
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {docs.data?.items.map((d) => (
              <li key={d.id}>
                <button className={`${button} w-full text-left`} onClick={() => setSelected(d.id)}>
                  <span className="block font-semibold">{d.name}</span>
                  <span className="block">
                    {d.document_ref ||
                      `Documento ${d.source_external_id?.split("-")[1] ?? "sin folio"}`}
                  </span>
                  <span className="block">
                    {d.status === "paid"
                      ? kind === "payable"
                        ? "Pagado"
                        : "Cobrado"
                      : `Pendiente ${money(d.outstanding_amount, d.currency_code)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {docs.isSuccess && !docs.data.items.length && (
            <p className="mt-3">No hay documentos para esta búsqueda.</p>
          )}
          <div className="mt-3 flex justify-between gap-2">
            {offset > 0 && (
              <button className={button} onClick={() => setOffset(offset - 50)}>
                Anterior
              </button>
            )}
            {docs.data?.has_more && (
              <button className={button} onClick={() => setOffset(offset + 50)}>
                Siguiente
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}

function DocumentActionContent({ kind, id }: { kind: DocumentKind; id: string }) {
  const doc = useActionDocument(kind, id);
  if (doc.isPending) return <p role="status">Cargando documento…</p>;
  if (doc.isError)
    return (
      <p role="alert">
        No se pudo cargar el documento.{" "}
        <button className={button} onClick={() => void doc.refetch()}>
          Reintentar
        </button>
      </p>
    );
  return <DocumentActionForm kind={kind} doc={doc.data} />;
}

function DocumentActionForm({ kind, doc }: { kind: DocumentKind; doc: ActionDetail }) {
  const action = useDocumentAction(kind, doc.id);
  const [mode, setMode] = React.useState<"payment" | "followup" | null>(null);
  const [date, setDate] = React.useState(civilDate());
  const [amount, setAmount] = React.useState(String(doc.outstanding_amount));
  const [method, setMethod] = React.useState<PaymentInput["method"]>("bank_transfer");
  const [reason, setReason] = React.useState<FollowupInput["reason"]>("negotiation");
  const [note, setNote] = React.useState("");
  const [account, setAccount] = React.useState("");
  const request = React.useRef<string | null>(null);
  const paymentWord = kind === "payable" ? "pago" : "cobro";
  const writable =
    !doc.ceded_at && doc.status !== "cancelled" && Number(doc.outstanding_amount) > 0;
  const activePayments = doc.actions.filter(
    (a) => a.action_type === "payment" && a.status === "active",
  );
  const begin = (next: "payment" | "followup") => {
    action.reset();
    request.current = null;
    setMode(next);
    setDate(next === "payment" ? civilDate() : "");
    setAmount(String(doc.outstanding_amount));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    request.current ??= crypto.randomUUID();
    const common = {
      request_id: request.current,
      date,
      expected_outstanding: String(doc.outstanding_amount),
      currency_code: doc.currency_code,
      note,
    };
    try {
      await action.mutateAsync(
        mode === "payment"
          ? { suffix: "payments", body: { ...common, amount, method, account_reference: account } }
          : { suffix: "followups", body: { ...common, reason } },
      );
      request.current = null;
      setMode(null);
      toast.success(
        mode === "payment"
          ? `${kind === "payable" ? "Pago" : "Cobro"} registrado`
          : "Seguimiento programado",
      );
    } catch {
      /* Keep the form and the idempotency key for a safe retry. */
    }
  };
  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{doc.name}</h3>
        <p>
          {doc.document_ref || `Documento ${doc.source_external_id?.split("-")[1] ?? "sin folio"}`}
        </p>
        <p className="mt-2 text-xl font-semibold">
          Pendiente: {money(doc.outstanding_amount, doc.currency_code)}
        </p>
        <p className="text-sm">
          {doc.due_date ? `Vence: ${dateLabel(doc.due_date)}` : "Sin fecha de vencimiento"}
        </p>
        {doc.in_followup && (
          <p className="mt-2 text-sm">
            En seguimiento. Sin tarea inmediata mientras no cambie el documento.
          </p>
        )}
      </div>
      {writable && (
        <>
          {!activePayments.length && <PaymentSuggestions kind={kind} id={doc.id} />}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={action.isPending} onClick={() => begin("payment")}>
              Registrar {paymentWord}
            </button>
            <button
              className={button}
              disabled={action.isPending}
              onClick={() => begin("followup")}
            >
              Programar seguimiento
            </button>
          </div>
        </>
      )}
      {doc.ceded_at && <p>Factura cedida. Revisa el detalle de factoring.</p>}
      {mode && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-xl border border-border p-4"
          onChange={() => {
            request.current = null;
          }}
        >
          <h4 className="font-semibold">
            {mode === "payment" ? `Registrar ${paymentWord}` : "Programar seguimiento"}
          </h4>
          <fieldset disabled={action.isPending} className="space-y-3">
            <label className="block text-sm">
              {mode === "payment" ? `Fecha del ${paymentWord}` : "Volver a revisar el"}
              <input
                type="date"
                className={input}
                required
                value={date}
                max={mode === "payment" ? civilDate() : undefined}
                min={mode === "payment" ? doc.issue_date : civilDate()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {mode === "payment" ? (
              <>
                <label className="block text-sm">
                  Monto ({doc.currency_code})
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    max={String(doc.outstanding_amount)}
                    required
                    className={input}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Cómo se {kind === "payable" ? "pagó" : "cobró"}
                  <select
                    className={input}
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentInput["method"])}
                  >
                    <option value="bank_transfer">Transferencia o cargo bancario</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro medio</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Cuenta o referencia (opcional)
                  <input
                    className={input}
                    maxLength={120}
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </label>
                <p className="text-sm">
                  Actualiza el saldo pendiente. No modifica el saldo bancario ni ejecuta una
                  transferencia.
                </p>
              </>
            ) : (
              <>
                <label className="block text-sm">
                  Motivo
                  <select
                    className={input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value as FollowupInput["reason"])}
                  >
                    <option value="negotiation">En negociación</option>
                    <option value="awaiting_response">Esperando respuesta</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <p className="text-sm">
                  Pausa el recordatorio. No cambia la deuda, el vencimiento ni la proyección de
                  caja.
                </p>
              </>
            )}
            <label className="block text-sm">
              Nota (opcional)
              <textarea
                className={input}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={button}>
                {action.isPending
                  ? "Guardando…"
                  : mode === "payment"
                    ? `Guardar ${paymentWord}`
                    : "Guardar seguimiento"}
              </button>
              <button type="button" className={button} onClick={() => setMode(null)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {action.isError && (
        <p role="alert" className="text-sm text-red-700">
          No pudimos confirmar el resultado. Reintenta sin cambiar los datos. {action.error.message}
        </p>
      )}
      {!!doc.actions.length && (
        <section className="space-y-3 border-t border-border pt-3">
          <h4 className="font-semibold">Pagos y seguimiento</h4>
          {doc.actions.map((a) => (
            <div key={a.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">
                {a.action_type === "payment"
                  ? `${money(a.amount ?? "0", a.currency_code)} · ${a.status === "linked" ? "Conciliado con banco" : a.status === "reverted" ? "Registro revertido" : "Registro manual"}`
                  : `Seguimiento: ${dateLabel(a.action_date)}${a.status === "reverted" ? " · Cancelado" : ""}`}
              </p>
              {a.action_type === "payment" && <p>{dateLabel(a.action_date)}</p>}
              {a.payload.note && <p>{a.payload.note}</p>}
              {a.status === "active" && (
                <button
                  className={button}
                  disabled={action.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        a.action_type === "payment"
                          ? "¿Revertir este registro? Su monto volverá al saldo pendiente."
                          : "¿Cancelar este seguimiento? El documento volverá a las tareas pendientes.",
                      )
                    )
                      action.mutate({ suffix: `actions/${a.id}/revert` });
                  }}
                >
                  {a.action_type === "payment" ? "Revertir registro" : "Cancelar seguimiento"}
                </button>
              )}
              {a.action_type === "payment" && a.status === "active" && (
                <details>
                  <summary className="cursor-pointer py-2 font-medium">
                    Buscar movimiento de este pago
                  </summary>
                  <PaymentSuggestions kind={kind} id={doc.id} paymentId={a.id} />
                </details>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function PaymentSuggestions({
  kind,
  id,
  paymentId,
}: {
  kind: DocumentKind;
  id: string;
  paymentId?: string;
}) {
  const candidates = usePaymentCandidates(kind, id, paymentId);
  const reject = useRejectPaymentSuggestion();
  const action = useDocumentAction(kind, id);
  const [selected, setSelected] = React.useState<PaymentMovement | null>(null);
  if (candidates.isPending)
    return (
      <p role="status" className="text-sm">
        Buscando coincidencias bancarias…
      </p>
    );
  if (candidates.isError)
    return (
      <p role="alert" className="text-sm">
        No pudimos revisar los movimientos.{" "}
        <button className={button} onClick={() => void candidates.refetch()}>
          Reintentar
        </button>
      </p>
    );
  if (!candidates.data.items.length)
    return (
      <p className="text-sm">
        No encontramos un movimiento coincidente.
        {!paymentId && ` Si ya se ${kind === "payable" ? "pagó" : "cobró"}, puedes registrarlo.`}
      </p>
    );
  return (
    <section className="space-y-2">
      <h4 className="font-medium">
        {paymentId ? "Movimientos para revisar" : "Coincidencias sugeridas"}
      </h4>
      {candidates.data.items.map((m) => (
        <div key={m.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">
            {money(m.amount, m.currency_code)} · {dateLabel(m.date)}
          </p>
          <p>
            {m.bank_name} · {m.account_name}
          </p>
          <p>{m.description}</p>
          <button
            className={`${button} mt-2`}
            disabled={action.isPending}
            onClick={() => {
              action.reset();
              setSelected(m);
            }}
          >
            Confirmar {kind === "payable" ? "pago" : "cobro"}
          </button>
          {!paymentId && (
            <button
              className={button}
              disabled={action.isPending || reject.isPending}
              onClick={() => reject.mutate({ movementId: m.id, documentId: id })}
            >
              No corresponde
            </button>
          )}
        </div>
      ))}
      {selected && (
        <div
          role="group"
          aria-label="Confirmar coincidencia"
          className="space-y-2 rounded-lg border-2 border-brand-primary p-3"
        >
          <p>¿Este movimiento corresponde al {paymentId ? "pago registrado" : "documento"}?</p>
          <p>
            {money(selected.amount, selected.currency_code)} · {dateLabel(selected.date)} ·{" "}
            {selected.bank_name}
          </p>
          <p>
            {paymentId
              ? "Se vinculará al mismo pago, sin descontarlo nuevamente."
              : selected.remaining_amount != null
                ? `Saldo pendiente después: ${money(selected.remaining_amount, selected.currency_code)}`
                : "Actualiza el detalle para comprobar el saldo restante."}
          </p>
          <button
            className={button}
            disabled={action.isPending || (!paymentId && selected.remaining_amount == null)}
            onClick={() =>
              action.mutate(
                {
                  suffix: paymentId ? `payments/${paymentId}/link` : "confirm",
                  body: { movement_id: selected.id },
                },
                {
                  onSuccess: () => {
                    setSelected(null);
                    toast.success("Pago confirmado");
                  },
                },
              )
            }
          >
            {action.isPending ? "Confirmando…" : "Confirmar coincidencia"}
          </button>
          <button className={button} disabled={action.isPending} onClick={() => setSelected(null)}>
            Volver
          </button>
        </div>
      )}
      {action.isError && (
        <p role="alert">
          No pudimos confirmar el resultado. Actualiza el detalle antes de volver a intentar.{" "}
          {action.error.message}
        </p>
      )}
      {reject.isError && (
        <p role="alert">No se pudo descartar la coincidencia. Vuelve a intentar.</p>
      )}
    </section>
  );
}
