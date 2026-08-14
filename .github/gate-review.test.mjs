// Banco de pruebas del check gate-review (ESM: el repo del front prohibe require): extrae el script del workflow real y lo
// corre contra escenarios simulados. Ejecutar con: node .github/gate-review.test.js
// Regresión del incidente INC-001 (docs/factory/INCIDENTES.md).
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

function mk({
  draft = false,
  labels = [],
  comments = [],
  reviews = [],
  commitDate,
  author = "fperezd",
}) {
  const core = {
    failed: null,
    logs: [],
    setFailed(m) {
      this.failed = m;
    },
    info(m) {
      this.logs.push(m);
    },
  };
  const github = {
    paginate: async (fn) => fn._data,
    rest: {
      pulls: {
        listReviews: Object.assign(() => {}, { _data: reviews }),
        listCommits: async () => ({
          data: [
            {
              sha: "abc1234567",
              commit: { committer: { date: commitDate }, author: { date: commitDate } },
            },
          ],
        }),
      },
      issues: { listComments: Object.assign(() => {}, { _data: comments }) },
    },
  };
  const context = {
    repo: { owner: "o", repo: "r" },
    payload: {
      pull_request: {
        number: 1,
        draft,
        labels: labels.map((n) => ({ name: n })),
        user: { login: author },
      },
    },
  };
  return { github, context, core };
}

const T0 = "2026-08-14T10:00:00Z";
const ANTES = "2026-08-14T09:00:00Z";
const DESPUES = "2026-08-14T11:00:00Z";
const cmt = (v, at) => ({
  body: `## Review\nveredicto: ${v}\nhallazgos: ...`,
  created_at: at,
  html_url: "u",
});

const casos = [
  ["borrador se omite", { draft: true, labels: [], commitDate: T0 }, "pasa"],
  ["sin label de risk falla", { labels: ["ws:pulso"], commitDate: T0 }, "falla"],
  ["R0 pasa sin review", { labels: ["risk:R0"], commitDate: T0 }, "pasa"],
  ["R1 sin review falla", { labels: ["risk:R1"], commitDate: T0 }, "falla"],
  [
    "R1 con PASS pasa",
    { labels: ["risk:R1"], comments: [cmt("PASS", DESPUES)], commitDate: T0 },
    "pasa",
  ],
  [
    "R1 con FAIL falla",
    { labels: ["risk:R1"], comments: [cmt("FAIL", DESPUES)], commitDate: T0 },
    "falla",
  ],
  ["R2 sin review falla", { labels: ["risk:R2"], commitDate: T0 }, "falla"],
  [
    "R2 con FAIL falla",
    { labels: ["risk:R2"], comments: [cmt("FAIL", DESPUES)], commitDate: T0 },
    "falla",
  ],
  [
    "R2 con NEEDS_HUMAN falla",
    { labels: ["risk:R2"], comments: [cmt("NEEDS_HUMAN", DESPUES)], commitDate: T0 },
    "falla",
  ],
  [
    "R2 con PASS vigente pasa",
    { labels: ["risk:R2"], comments: [cmt("PASS", DESPUES)], commitDate: T0 },
    "pasa",
  ],
  [
    "R2 con PASS viejo (stale) falla",
    { labels: ["risk:R2"], comments: [cmt("PASS", ANTES)], commitDate: T0 },
    "falla",
  ],
  [
    "R2: FAIL y luego PASS vigente pasa",
    { labels: ["risk:R2"], comments: [cmt("FAIL", T0), cmt("PASS", DESPUES)], commitDate: T0 },
    "pasa",
  ],
  [
    "R2: PASS y luego FAIL falla",
    { labels: ["risk:R2"], comments: [cmt("PASS", T0), cmt("FAIL", DESPUES)], commitDate: T0 },
    "falla",
  ],
  [
    "R2 con approve de tercero vigente pasa",
    {
      labels: ["risk:R2"],
      reviews: [{ state: "APPROVED", user: { login: "otro" }, submitted_at: DESPUES }],
      commitDate: T0,
    },
    "pasa",
  ],
  [
    "R2: autoaprobación no cuenta",
    {
      labels: ["risk:R2"],
      reviews: [{ state: "APPROVED", user: { login: "fperezd" }, submitted_at: DESPUES }],
      commitDate: T0,
    },
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
    const real = core.failed ? "falla" : "pasa";
    const bien = real === esperado;
    if (bien) {
      ok++;
    } else {
      bad++;
    }
    console.log(
      `${bien ? "OK  " : "MAL "} ${nombre}: esperado=${esperado} real=${real}${core.failed ? " | " + core.failed.slice(0, 90) : ""}`,
    );
  }
  console.log(`\n${ok} correctos, ${bad} incorrectos`);
  process.exit(bad ? 1 : 0);
})();
