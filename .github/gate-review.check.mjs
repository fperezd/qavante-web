// Banco de pruebas del check gate-review (ESM: el repo del front prohibe require): extrae el script del workflow real y lo
// corre contra escenarios simulados. Ejecutar con: node .github/gate-review.test.js
// Regresión del incidente INC-001 (docs/factory/INCIDENTES.md).
//
// Los escenarios marcados [adversarial] vienen del review que falló la primera
// versión de este check en el PR #954: eran burlas que pasaban y hoy no pasan.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wf = fs.readFileSync(__dirname + "/workflows/gate-review.yml", "utf8");
const raw = wf
  .split("script: |")[1]
  .split("\n")
  .slice(1)
  .map((l) => l.replace(/^ {12}/, ""))
  .join("\n");
const script = "module.exports = async ({github, context, core}) => {\n" + raw + "\n}";
const runner = eval(script.replace("module.exports =", "(").concat(")"));

const HEAD = "abc1234def5678901234567890123456789012ab";
const OTRO = "ffff999888777666555444333222111000aaabbb";
const AUTOR = "fperezd";

function mk({
  draft = false,
  state = "open",
  labels = [],
  comments = [],
  reviews = [],
  eventName,
  eventReview,
  reviewById,
  head = HEAD,
} = {}) {
  const core = {
    failed: null,
    logs: [],
    warnings: [],
    setFailed(m) {
      this.failed = m;
    },
    info(m) {
      this.logs.push(m);
    },
    warning(m) {
      this.warnings.push(m);
    },
  };
  const pr = {
    number: 1,
    draft,
    state,
    head: { sha: head },
    user: { login: AUTOR },
    updated_at: "2026-08-14T10:00:00Z",
    labels: labels.map((n) => ({ name: n })),
  };
  const github = {
    paginate: async (fn) => fn._data,
    rest: {
      pulls: {
        get: async () => ({ data: pr }),
        listReviews: Object.assign(() => {}, { _data: reviews }),
        getReview: async () => ({ data: reviewById }),
      },
      issues: { listComments: Object.assign(() => {}, { _data: comments }) },
      repos: {
        // El caso por defecto no simula un update-branch: corta la caminata
        // de ancestros y permite ejercitar el resto del gate.
        getCommit: async () => ({ data: { parents: [] } }),
        compareCommitsWithBasehead: async () => ({ data: { status: "ahead" } }),
      },
    },
  };
  const context = {
    eventName,
    repo: { owner: "o", repo: "r" },
    payload: { action: "submitted", pull_request: { number: 1 }, review: eventReview },
  };
  return { github, context, core };
}

const T = (n) => `2026-08-14T1${n}:00:00Z`;
// comentario con veredicto bien formado
const cmt = (v, sha, at = T(1), quien = "revisor") => ({
  body: `## Review\nveredicto: ${v}\nrevisado: ${sha}\nhallazgos: ninguno`,
  created_at: at,
  html_url: "u",
  user: { login: quien },
});

const casos = [
  ["borrador se omite", { draft: true }, "pasa"],
  ["PR cerrado se omite", { state: "closed", labels: ["risk:R2"] }, "pasa"],
  ["sin label de risk falla", { labels: ["ws:pulso"] }, "falla"],
  ["R0 pasa sin review", { labels: ["risk:R0"] }, "pasa"],
  ["R1 sin review falla", { labels: ["risk:R1"] }, "falla"],
  ["R1 con PASS vigente pasa", { labels: ["risk:R1"], comments: [cmt("PASS", HEAD)] }, "pasa"],
  ["R1 con FAIL vigente falla", { labels: ["risk:R1"], comments: [cmt("FAIL", HEAD)] }, "falla"],
  [
    "R1 con PASS sobre otro commit falla",
    { labels: ["risk:R1"], comments: [cmt("PASS", OTRO)] },
    "falla",
  ],
  ["R2 sin review falla", { labels: ["risk:R2"] }, "falla"],
  ["R2 con PASS vigente pasa", { labels: ["risk:R2"], comments: [cmt("PASS", HEAD)] }, "pasa"],
  [
    "R2 con NEEDS_HUMAN vigente falla",
    { labels: ["risk:R2"], comments: [cmt("NEEDS_HUMAN", HEAD)] },
    "falla",
  ],
  [
    "R2: FAIL viejo y PASS vigente pasa",
    { labels: ["risk:R2"], comments: [cmt("FAIL", OTRO, T(0)), cmt("PASS", HEAD, T(2))] },
    "pasa",
  ],
  [
    "R2: PASS y luego FAIL sobre el mismo commit falla",
    { labels: ["risk:R2"], comments: [cmt("PASS", HEAD, T(0)), cmt("FAIL", HEAD, T(2))] },
    "falla",
  ],
  [
    "R2 con approve de tercero sobre el commit pasa",
    {
      labels: ["risk:R2"],
      reviews: [
        {
          state: "APPROVED",
          user: { login: "otro" },
          commit_id: HEAD,
          submitted_at: T(1),
          html_url: "u",
        },
      ],
    },
    "pasa",
  ],
  [
    "R2: approve de tercero sobre commit viejo falla",
    {
      labels: ["risk:R2"],
      reviews: [
        {
          state: "APPROVED",
          user: { login: "otro" },
          commit_id: OTRO,
          submitted_at: T(1),
          html_url: "u",
        },
      ],
    },
    "falla",
  ],
  [
    "R2: autoaprobación no cuenta",
    {
      labels: ["risk:R2"],
      reviews: [
        {
          state: "APPROVED",
          user: { login: AUTOR },
          commit_id: HEAD,
          submitted_at: T(1),
          html_url: "u",
        },
      ],
    },
    "falla",
  ],
  [
    "R2: veredicto en review con cuerpo pasa",
    {
      labels: ["risk:R2"],
      reviews: [
        {
          state: "COMMENTED",
          user: { login: "revisor" },
          body: `veredicto: PASS\nrevisado: ${HEAD}`,
          submitted_at: T(1),
          html_url: "u",
        },
      ],
    },
    "pasa",
  ],
  [
    "R2: payload de review sin body se rehidrata por id y pasa",
    {
      labels: ["risk:R2"],
      eventName: "pull_request_review",
      eventReview: { id: 42 },
      reviewById: {
        state: "COMMENTED",
        user: { login: "revisor" },
        body: `veredicto: PASS\nrevisado: ${HEAD}`,
        submitted_at: T(1),
        html_url: "u",
      },
    },
    "pasa",
  ],

  // --- [adversarial] burlas que pasaban en la primera versión del check ---
  [
    "[adv] pegar la plantilla del contrato no cuenta",
    {
      labels: ["risk:R2"],
      comments: [
        {
          body: `veredicto: PASS | FAIL | NEEDS_HUMAN\nrevisado: ${HEAD}`,
          created_at: T(1),
          html_url: "u",
          user: { login: "x" },
        },
      ],
    },
    "falla",
  ],
  [
    "[adv] veredicto dentro de bloque de código no cuenta",
    {
      labels: ["risk:R2"],
      comments: [
        {
          body:
            "Formato esperado:\n```\nveredicto: PASS\nrevisado: " +
            HEAD +
            "\n```\nOjo, es solo el ejemplo.",
          created_at: T(1),
          html_url: "u",
          user: { login: "x" },
        },
      ],
    },
    "falla",
  ],
  [
    "[adv] veredicto sin línea revisado no cuenta",
    {
      labels: ["risk:R2"],
      comments: [
        {
          body: "veredicto: PASS\nse ve bien",
          created_at: T(1),
          html_url: "u",
          user: { login: "x" },
        },
      ],
    },
    "falla",
  ],
  [
    "[adv] PASS posterior NO anula un FAIL sobre el mismo commit",
    {
      labels: ["risk:R2"],
      comments: [cmt("FAIL", HEAD, T(0), "revisor"), cmt("PASS", HEAD, T(2), AUTOR)],
    },
    "falla",
  ],
  [
    "re-review tras push: FAIL en sha viejo, PASS en el nuevo, pasa",
    {
      labels: ["risk:R2"],
      comments: [cmt("FAIL", OTRO, T(0), "revisor"), cmt("PASS", HEAD, T(2), "revisor")],
    },
    "pasa",
  ],
  [
    "[adv] sha parcial (7 chars) del commit actual vale",
    { labels: ["risk:R1"], comments: [cmt("PASS", HEAD.slice(0, 7))] },
    "pasa",
  ],
  [
    "[adv] sha de otro commit con mismo prefijo corto no vale",
    { labels: ["risk:R1"], comments: [cmt("PASS", OTRO.slice(0, 7))] },
    "falla",
  ],
];

(async () => {
  let ok = 0,
    bad = 0;
  for (const [nombre, cfg, esperado] of casos) {
    const { github, context, core } = mk(cfg);
    try {
      await runner({ github, context, core });
    } catch (e) {
      core.setFailed("EXCEPCIÓN: " + e.message);
    }
    let real = core.failed ? "falla" : "pasa";
    if (real === "pasa" && core.warnings.length) real = "pasa-con-warning";
    const bien = real === esperado;
    if (bien) {
      ok++;
    } else {
      bad++;
    }
    console.log(
      `${bien ? "OK  " : "MAL "} ${nombre}: esperado=${esperado} real=${real}${core.failed ? " | " + core.failed.slice(0, 80) : ""}`,
    );
  }
  console.log(`\n${ok} correctos, ${bad} incorrectos`);
  process.exit(bad ? 1 : 0);
})();
