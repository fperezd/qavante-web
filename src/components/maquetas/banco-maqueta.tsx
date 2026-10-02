"use client";

import * as React from "react";
import {
  Activity,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Landmark,
  Link2,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { DEMO_CASH_FLOW_TRANSACTIONS } from "@/lib/demo/cash-flow-data";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { mesCortoDePeriodo } from "@/lib/formatters/months";

type DemoAccount = {
  id: string;
  name: string;
  number: string;
  currency: "CLP" | "USD";
  available: number;
  ledger: number;
  creditLine?: { limit: number; available: number };
};

type DemoCreditCard = {
  id: string;
  bankName: string;
  name: string;
  number: string;
  limit: number;
  used: number;
  due: string;
};

type DemoBank = {
  id: string;
  name: string;
  updated: string;
  accounts: DemoAccount[];
};

type DemoMovement = {
  id: string;
  bankId: string;
  account: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  reconciled: boolean;
};

function balanceForBank(bankId: string) {
  return DEMO_CASH_FLOW_TRANSACTIONS.filter((transaction) => transaction.bankId === bankId).reduce(
    (balance, transaction) => balance + Number(transaction.inflow) - Number(transaction.outflow),
    0,
  );
}

const INITIAL_BANKS: DemoBank[] = [
  {
    id: "bice",
    name: "BICE",
    updated: "Hoy, 09:15",
    accounts: [
      {
        id: "bice-main",
        name: "Cuenta corriente empresa",
        number: "•••• 4321",
        currency: "CLP",
        available: balanceForBank("bice"),
        ledger: balanceForBank("bice"),
        creditLine: { limit: 4_000_000, available: 2_500_000 },
      },
    ],
  },
  {
    id: "banco-de-chile",
    name: "Banco de Chile",
    updated: "Hoy, 09:12",
    accounts: [
      {
        id: "chile-main",
        name: "Cuenta corriente empresa",
        number: "•••• 1190",
        currency: "CLP",
        available: balanceForBank("banco-de-chile"),
        ledger: balanceForBank("banco-de-chile"),
      },
    ],
  },
  {
    id: "santander",
    name: "Santander",
    updated: "Hoy, 09:08",
    accounts: [
      {
        id: "santander-main",
        name: "Cuenta corriente negocios",
        number: "•••• 8802",
        currency: "CLP",
        available: balanceForBank("santander"),
        ledger: balanceForBank("santander"),
      },
      {
        id: "santander-usd",
        name: "Cuenta en dólares",
        number: "•••• 0091",
        currency: "USD",
        available: 2_350.4,
        ledger: 2_350.4,
      },
    ],
  },
];

const INITIAL_CREDIT_CARDS: DemoCreditCard[] = [
  {
    id: "manual-bice-visa",
    bankName: "BICE",
    name: "Visa Empresa",
    number: "•••• 2804",
    limit: 5_000_000,
    used: 1_250_000,
    due: "2026-10-05",
  },
  {
    id: "manual-santander-mastercard",
    bankName: "Santander",
    name: "Mastercard Empresa",
    number: "•••• 3021",
    limit: 2_400_000,
    used: 780_000,
    due: "2026-10-12",
  },
];

const BANK_ACCOUNT_LABELS: Record<string, string> = {
  bice: "Cuenta corriente · •••• 4321",
  "banco-de-chile": "Cuenta corriente · •••• 1190",
  santander: "Cuenta corriente · •••• 8802",
};

const INITIAL_MOVEMENTS: DemoMovement[] = DEMO_CASH_FLOW_TRANSACTIONS.map((transaction) => ({
  id: transaction.id,
  bankId: transaction.bankId ?? "bice",
  account: BANK_ACCOUNT_LABELS[transaction.bankId ?? "bice"] ?? "Cuenta corriente empresa",
  date: transaction.date,
  description: transaction.description,
  category: transaction.classification ?? transaction.category ?? "Por clasificar",
  amount: Number(transaction.inflow) - Number(transaction.outflow),
  reconciled: true,
}));

type BalancePoint = { month: string; label: string; balance: number };

function buildBalanceHistory(): BalancePoint[] {
  const transactions = [...DEMO_CASH_FLOW_TRANSACTIONS].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const balances = new Map<string, number>();
  let balance = 0;
  for (const transaction of transactions) {
    balance += Number(transaction.inflow) - Number(transaction.outflow);
    balances.set(transaction.date.slice(0, 7), balance);
  }

  return [...balances].map(([month, closingBalance]) => {
    return {
      month,
      label: mesCortoDePeriodo(month),
      balance: closingBalance,
    };
  });
}

const BALANCE_HISTORY = buildBalanceHistory();

const BANK_CHOICES = [
  { id: "bci", name: "BCI" },
  { id: "bancoestado", name: "BancoEstado" },
  { id: "scotiabank", name: "Scotiabank" },
  { id: "itau", name: "Itaú" },
  { id: "falabella", name: "Banco Falabella" },
];

function formatDemoMoney(amount: number, currency: DemoAccount["currency"] = "CLP") {
  if (currency === "CLP") return formatClp(amount);
  return formatMoney(amount, currency);
}

export function BancoMaqueta() {
  const [banks, setBanks] = React.useState(INITIAL_BANKS);
  const [manualCards, setManualCards] = React.useState(INITIAL_CREDIT_CARDS);
  const [manualCardsLoaded, setManualCardsLoaded] = React.useState(false);
  const movements = INITIAL_MOVEMENTS;
  const [bankFilter, setBankFilter] = React.useState("todos");
  const [showAllMovements, setShowAllMovements] = React.useState(false);
  const [widgetOpen, setWidgetOpen] = React.useState(false);
  const [selectedBank, setSelectedBank] = React.useState(BANK_CHOICES[0]!.id);
  const [confirmation, setConfirmation] = React.useState("");

  React.useEffect(() => {
    try {
      const storedCards = window.localStorage.getItem("qavante-manual-credit-cards");
      if (storedCards) {
        const parsedCards = JSON.parse(storedCards) as DemoCreditCard[];
        if (Array.isArray(parsedCards)) setManualCards(parsedCards);
      }
    } catch {
      // Si el almacenamiento local no está disponible, se mantienen los ejemplos iniciales.
    } finally {
      setManualCardsLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!manualCardsLoaded) return;
    try {
      window.localStorage.setItem("qavante-manual-credit-cards", JSON.stringify(manualCards));
    } catch {
      // La vista sigue funcionando durante la sesión si no se puede guardar localmente.
    }
  }, [manualCards, manualCardsLoaded]);

  const clpBalance = banks
    .flatMap((bank) => bank.accounts)
    .filter((account) => account.currency === "CLP")
    .reduce((total, account) => total + account.available, 0);
  const accountCount = banks.reduce((total, bank) => total + bank.accounts.length, 0);
  const cardCount = manualCards.length;
  const currentMonth = BALANCE_HISTORY.at(-1)?.month ?? "";
  const monthMovements = movements.filter((movement) => movement.date.startsWith(currentMonth));
  const monthInflow = monthMovements.reduce(
    (total, movement) => total + Math.max(0, movement.amount),
    0,
  );
  const monthOutflow = monthMovements.reduce(
    (total, movement) => total + Math.max(0, -movement.amount),
    0,
  );
  const visibleMovements = (
    bankFilter === "todos"
      ? movements
      : movements.filter((movement) => movement.bankId === bankFilter)
  ).sort((a, b) => b.date.localeCompare(a.date));
  const shownMovements = showAllMovements ? visibleMovements : visibleMovements.slice(0, 8);
  const availableChoices = BANK_CHOICES.filter(
    (choice) => !banks.some((bank) => bank.id === choice.id),
  );

  function simulateConnection() {
    const choice = BANK_CHOICES.find((bank) => bank.id === selectedBank);
    if (!choice || banks.some((bank) => bank.id === choice.id)) return;

    const accountId = `${choice.id}-demo-account`;
    const newBank: DemoBank = {
      id: choice.id,
      name: choice.name,
      updated: "Ahora",
      accounts: [
        {
          id: accountId,
          name: "Cuenta corriente empresa",
          number: "•••• 6408",
          currency: "CLP",
          available: 0,
          ledger: 0,
        },
      ],
    };
    setBanks((current) => [...current, newBank]);
    setBankFilter(choice.id);
    setConfirmation(
      `${choice.name} se agregó como conexión simulada, sin movimientos ni saldo importados.`,
    );
    setWidgetOpen(false);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Banco</h1>
            <p className="text-sm text-neutral-mid">Tus saldos y movimientos, en un solo lugar</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setConfirmation("");
            setWidgetOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" /> Conectar banco
        </button>
      </header>

      {confirmation && (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {confirmation}
        </p>
      )}

      <section
        aria-label="Saldo y actividad bancaria"
        className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-blue-50/80 blur-2xl" />
          <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-mid">Saldo disponible · CLP</p>
              <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums text-neutral-dark sm:text-5xl">
                {formatClp(clpBalance)}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/50 px-3 py-1.5 text-xs font-medium text-neutral-mid">
              <span className="size-2 rounded-full bg-emerald-500" /> Demo Fintoc
            </span>
          </div>
          <div className="relative mt-8 grid grid-cols-2 gap-3 border-t border-border pt-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-neutral-mid">Entradas este mes</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-dark">
                  {formatClp(monthInflow)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-rose-50 p-2.5 text-rose-700">
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-neutral-mid">Salidas este mes</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-dark">
                  {formatClp(monthOutflow)}
                </p>
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs text-neutral-mid">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">{banks.length} bancos</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">{accountCount} cuentas</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {cardCount} tarjetas manuales
            </span>
          </div>
        </div>
        <BalanceChart />
      </section>

      <section aria-label="Cuentas bancarias" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-dark">Mis bancos</h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {banks.length} conectados
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {banks.map((bank, index) => (
            <BankPanel key={bank.id} bank={bank} index={index} />
          ))}
        </div>
      </section>

      <ManualCreditCardsSection
        cards={manualCards}
        onAdd={(card) => setManualCards((current) => [...current, card])}
        onRemove={(cardId) =>
          setManualCards((current) => current.filter((card) => card.id !== cardId))
        }
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-neutral-dark">Movimientos</h2>
              <p className="text-xs text-neutral-mid">{visibleMovements.length} registros</p>
            </div>
          </div>
          <label className="relative flex items-center">
            <span className="sr-only">Filtrar por banco</span>
            <select
              aria-label="Filtrar movimientos por banco"
              value={bankFilter}
              onChange={(event) => setBankFilter(event.target.value)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface py-1 pl-3 pr-8 text-sm text-neutral-dark"
            >
              <option value="todos">Todos los bancos</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-neutral-mid"
              aria-hidden="true"
            />
          </label>
        </div>
        <div className="divide-y divide-border/70">
          {shownMovements.length ? (
            shownMovements.map((movement) => {
              const incoming = movement.amount > 0;
              const bank = banks.find((item) => item.id === movement.bankId);
              return (
                <article
                  key={movement.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted/30 sm:gap-4 sm:px-5"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${incoming ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}
                  >
                    {incoming ? (
                      <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-dark">
                      {movement.description}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-mid">
                      {formatDateLike(movement.date)} · {bank?.name} · {movement.category}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-right text-sm font-bold tabular-nums sm:text-base ${incoming ? "text-emerald-700" : "text-rose-600"}`}
                  >
                    {incoming ? "+" : "−"}
                    {formatClp(Math.abs(movement.amount))}
                  </p>
                </article>
              );
            })
          ) : (
            <p className="px-5 py-10 text-center text-sm text-neutral-mid">
              Amplía el período o elige otro banco para ver movimientos.
            </p>
          )}
        </div>
        {visibleMovements.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAllMovements((value) => !value)}
            className="w-full border-t border-border px-4 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-blue-50/50"
          >
            {showAllMovements ? "Ver menos" : `Ver todos (${visibleMovements.length})`}
          </button>
        )}
      </section>

      <p className="text-center text-xs text-neutral-mid">
        Datos de demostración · sin conexión a bancos reales
      </p>

      {widgetOpen && (
        <ConnectWidget
          banks={availableChoices}
          selectedBank={selectedBank}
          onSelect={setSelectedBank}
          onConnect={simulateConnection}
          onClose={() => setWidgetOpen(false)}
        />
      )}
    </div>
  );
}

function BalanceChart() {
  const width = 520;
  const height = 168;
  const padding = { top: 14, right: 12, bottom: 26, left: 12 };
  const values = BALANCE_HISTORY.map((point) => point.balance);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const range = maximum - minimum || 1;
  const points = BALANCE_HISTORY.map((point, index) => ({
    ...point,
    x:
      padding.left +
      (index / Math.max(1, BALANCE_HISTORY.length - 1)) * (width - padding.left - padding.right),
    y: padding.top + ((maximum - point.balance) / range) * (height - padding.top - padding.bottom),
  }));
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const baseline = height - padding.bottom;
  const area = `${line} L${points.at(-1)?.x ?? padding.left},${baseline} L${points[0]?.x ?? padding.left},${baseline} Z`;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-mid">Evolución del saldo</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-neutral-dark">
            {formatClp(clpTotal())}
          </p>
        </div>
        <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfico de evolución mensual del saldo bancario"
          className="h-36 w-full overflow-visible"
        >
          <defs>
            <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.55, 0.85].map((fraction) => (
            <line
              key={fraction}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + fraction * (baseline - padding.top)}
              y2={padding.top + fraction * (baseline - padding.top)}
              stroke="#e2e8f0"
              strokeDasharray="4 5"
            />
          ))}
          <path d={area} fill="url(#balance-fill)" />
          <path
            d={line}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point) => (
            <g key={point.month}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke="#2563eb"
                strokeWidth="3"
              />
              <text
                x={point.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] capitalize"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </article>
  );
}

function clpTotal() {
  return DEMO_CASH_FLOW_TRANSACTIONS.reduce(
    (total, transaction) => total + Number(transaction.inflow) - Number(transaction.outflow),
    0,
  );
}

function BankPanel({ bank, index }: { bank: DemoBank; index: number }) {
  const accents = ["bg-blue-600", "bg-indigo-500", "bg-rose-600", "bg-emerald-600"];
  const accent = accents[index % accents.length]!;
  const balance = bank.accounts
    .filter((account) => account.currency === "CLP")
    .reduce((total, account) => total + account.available, 0);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="relative px-5 pb-4 pt-5">
        <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
              {bank.name.slice(0, 1)}
            </span>
            <div>
              <h3 className="font-semibold text-neutral-dark">{bank.name}</h3>
              <p className="text-xs text-neutral-mid">
                {bank.accounts.length} {bank.accounts.length === 1 ? "cuenta" : "cuentas"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Conectado
          </span>
        </div>
        <p className="mt-5 text-xs text-neutral-mid">Saldo disponible CLP</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-dark">
          {formatClp(balance)}
        </p>
      </div>
      <div className="space-y-3 p-4">
        {bank.accounts.map((account) =>
          account.currency === "USD" ? (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5"
            >
              <span className="text-xs font-medium text-emerald-900">
                Saldo en USD <span className="ml-1 text-emerald-700">{account.number}</span>
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-800">
                {formatDemoMoney(account.available, "USD")}
              </span>
            </div>
          ) : (
            <div key={account.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-xs text-neutral-mid">
                {account.name} · {account.number}
              </span>
              <span className="shrink-0 text-xs font-semibold text-neutral-dark">
                {formatClp(account.available)}
              </span>
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function ManualCreditCardsSection({
  cards,
  onAdd,
  onRemove,
}: {
  cards: DemoCreditCard[];
  onAdd: (card: DemoCreditCard) => void;
  onRemove: (cardId: string) => void;
}) {
  function submitCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const bankName = String(data.get("bankName") ?? "").trim();
    const name = String(data.get("cardName") ?? "").trim();
    const lastFour = String(data.get("lastFour") ?? "")
      .replace(/\D/g, "")
      .slice(-4);
    const limit = Number(data.get("limit"));
    const used = Number(data.get("used"));
    const due = String(data.get("due") ?? "");

    if (!bankName || !name || lastFour.length !== 4 || !due || limit <= 0 || used < 0) return;

    onAdd({
      id: `manual-card-${Date.now()}`,
      bankName,
      name,
      number: `•••• ${lastFour}`,
      limit,
      used,
      due,
    });
    form.reset();
    form.closest("details")?.removeAttribute("open");
  }

  return (
    <section
      aria-label="Tarjetas de crédito ingresadas manualmente"
      className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-dark">Tarjetas de crédito</h2>
          <p className="mt-1 text-sm text-neutral-mid">
            Registro manual · no se sincronizan con Fintoc
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-neutral-mid">
          {cards.length} {cards.length === 1 ? "registrada" : "registradas"}
        </span>
      </div>

      {cards.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {cards.map((card) => {
            const usedPercent = Math.min(100, Math.round((card.used / card.limit) * 100));
            return (
              <article
                key={card.id}
                className="rounded-xl border border-border bg-surface-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-dark">{card.name}</p>
                      <p className="text-xs text-neutral-mid">
                        {card.bankName} · {card.number}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(card.id)}
                    aria-label={`Eliminar tarjeta ${card.name} de ${card.bankName}`}
                    title="Eliminar tarjeta"
                    className="rounded-lg p-2 text-neutral-mid hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-neutral-mid">Cupo disponible</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-neutral-dark">
                      {formatClp(Math.max(0, card.limit - card.used))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-mid">Utilizado</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-neutral-dark">
                      {formatClp(card.used)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-mid">
                  Vencimiento: {formatDateLike(card.due)}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-muted/40 px-4 py-6 text-center text-sm text-neutral-mid">
          Agrega tu primera tarjeta para seguir el cupo usado y su fecha de vencimiento.
        </p>
      )}

      <details className="rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-primary [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4" aria-hidden="true" /> Agregar tarjeta manualmente
        </summary>
        <form
          onSubmit={submitCard}
          className="grid gap-3 border-t border-border p-4 sm:grid-cols-2"
        >
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Banco emisor
            <input
              name="bankName"
              required
              placeholder="Ej.: BICE"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Nombre de la tarjeta
            <input
              name="cardName"
              required
              placeholder="Ej.: Visa Empresa"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Últimos 4 dígitos
            <input
              name="lastFour"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="1234"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Cupo total (CLP)
            <input
              name="limit"
              required
              type="number"
              min="1"
              step="1000"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Monto utilizado (CLP)
            <input
              name="used"
              required
              type="number"
              min="0"
              step="1000"
              defaultValue="0"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-mid">
            Próximo vencimiento
            <input
              name="due"
              required
              type="date"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-neutral-dark"
            />
          </label>
          <p className="text-xs text-neutral-mid sm:col-span-2">
            Ingresa solo los últimos 4 dígitos; nunca agregues el número completo ni el código de
            seguridad. Se guarda en este navegador.
          </p>
          <div className="sm:col-span-2 sm:flex sm:justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Guardar tarjeta
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}

function ConnectWidget({
  banks,
  selectedBank,
  onSelect,
  onConnect,
  onClose,
}: {
  banks: typeof BANK_CHOICES;
  selectedBank: string;
  onSelect: (bankId: string) => void;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-dark/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fintoc-demo-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-brand-primary">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="fintoc-demo-title" className="font-semibold text-neutral-dark">
                Conecta tu banco
              </h2>
              <p className="text-xs text-neutral-mid">Simulación del widget de Fintoc</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de conexión"
            className="rounded-md p-1 text-neutral-mid hover:bg-surface-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        {banks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
            <p className="mt-3 font-medium text-neutral-dark">
              Ya agregaste todos los bancos de ejemplo
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-surface-muted"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-5">
            <p className="text-sm text-neutral-mid">
              Elige una institución para ver cómo se incorporaría a Qavante. No se pedirán claves ni
              se consultará ningún banco real.
            </p>
            <div className="mt-4 space-y-2">
              {banks.map((bank) => (
                <label
                  key={bank.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${selectedBank === bank.id ? "border-brand-primary bg-blue-50/60" : "border-border hover:bg-surface-muted/50"}`}
                >
                  <input
                    type="radio"
                    name="demo-bank"
                    value={bank.id}
                    checked={selectedBank === bank.id}
                    onChange={() => onSelect(bank.id)}
                    className="accent-blue-600"
                  />
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-sm font-bold text-neutral-mid">
                    {bank.name.slice(0, 1)}
                  </span>
                  <span className="flex-1 text-sm font-medium text-neutral-dark">{bank.name}</span>
                  {selectedBank === bank.id && (
                    <Check className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-neutral-mid">Widget de ejemplo · conexión no real</span>
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                Simular conexión <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
