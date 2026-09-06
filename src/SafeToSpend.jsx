import { useState, useMemo, useCallback, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */
const C = {
  ink: "#14201C",
  inkSoft: "#3A4A44",
  muted: "#6E7D77",
  faint: "#9AA6A1",
  app: "#DFE3DF",
  surface: "#F6F8F5",
  card: "#FFFFFF",
  line: "#E2E7E2",
  pine: "#1F4D3D",
  pineDeep: "#16382C",
  pineLight: "#2F6B55",
  oxblood: "#6B2D3C",
  brass: "#A8823C",
  reserve: "#7E8A84",
};

const F = {
  display: "'IBM Plex Sans', system-ui, sans-serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

const OUTFLOWS = ["payroll", "taxes", "loans", "rent", "suppliers", "other"];

const DEFAULT_FREQ = {
  collections: "monthly",
  payroll: "monthly",
  rent: "monthly",
  loans: "monthly",
  taxes: "monthly",
  suppliers: "monthly",
  other: "oneoff",
};

const FREQ_DAYS = { monthly: 30, quarterly: 90 };

/* Numbers are always grouped with commas. Albanian's own convention is a
   non-breaking space (1 450 000), which reads as no separator at all on a
   phone — commas are clearer here, in both languages. */
const GROUP_LOCALE = "en-GB";

/* GoatCounter events. Only the name of what happened is ever sent —
   no amounts, no field values, nothing the user typed. Fails silently
   if the script is blocked or has not loaded. */
function track(name) {
  try {
    if (typeof window !== "undefined" && window.goatcounter?.count) {
      window.goatcounter.count({ path: name, title: name, event: true });
    }
  } catch {
    /* analytics must never break the tool */
  }
}

const scaleFor = (frequency, amount, horizon) =>
  frequency === "oneoff" ? amount : amount * (horizon / FREQ_DAYS[frequency]);

/* Sample figures for a small Tirana distributor. They are shown as greyed
   placeholders so the user can see the expected shape of each entry, and
   they vanish the moment a field is focused. The "load example" button
   writes them in as real values for demonstration. */

const EMPTY_VALUES = {
  cash: "", bank: "", collections: "", payroll: "", taxes: "",
  loans: "", rent: "", suppliers: "", other: "", reserve: "",
};

/* Same fictional distributor in both currencies, converted at a round
   100 ALL = 1 EUR so the two sets stay directly comparable. */
const DEMO_VALUES = {
  ALL: {
    cash: "320000", bank: "1450000", collections: "2100000",
    payroll: "780000", taxes: "260000", loans: "145000",
    rent: "180000", suppliers: "950000", other: "120000",
    reserve: "400000",
  },
  EUR: {
    cash: "3200", bank: "14500", collections: "21000",
    payroll: "7800", taxes: "2600", loans: "1450",
    rent: "1800", suppliers: "9500", other: "1200",
    reserve: "4000",
  },
};

/* compare on numeric value, since what is held in state is formatted
   ("320,000") while the sample set is stored plain ("320000") */
const sameNumbers = (a, b, toNumber) =>
  Object.keys(b).every((k) => toNumber(a[k] ?? "") === toNumber(b[k] ?? ""));

const STACK_ORDER = ["suppliers", "payroll", "taxes", "loans", "rent", "other"];

/* Pick opening language and currency from the browser's own timezone and
   language settings. No IP lookup and no network request, so the
   "nothing leaves your device" promise stays literally true.
     Albania          -> Albanian + ALL
     Albanian speaker -> Albanian + EUR  (Kosovo, diaspora)
     everyone else    -> English  + EUR                                */
function detectDefaults() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tags = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || ""];
    const speaksAlbanian = tags.some((l) => /^sq(-|$)/i.test(l));
    const inAlbania = tz === "Europe/Tirane" || tags.some((l) => /-AL$/i.test(l));

    if (inAlbania) return { lang: "sq", currency: "ALL" };
    if (speaksAlbanian) return { lang: "sq", currency: "EUR" };
    return { lang: "en", currency: "EUR" };
  } catch {
    return { lang: "sq", currency: "ALL" };
  }
}

const SEG_COLORS = {
  payroll: "#6B2D3C",
  taxes: "#7A3746",
  loans: "#8A4453",
  rent: "#985462",
  suppliers: "#A66471",
  other: "#B47581",
};

/* ------------------------------------------------------------------ */
/*  Copy                                                               */
/* ------------------------------------------------------------------ */
const T = {
  sq: {
    appName: "Sa mund të shpenzoj?",
    tabs: ["Të hyrat", "Detyrimet", "Rezultati"],
    horizon: "Periudha",
    days: "ditë",
    horizonNote: "Të gjitha shifrat llogariten për periudhën që zgjidhni.",
    shortPeriodWarn:
      "Periudhë 15-ditore: shifrat mujore ndahen përgjysmë. Nëse një pagesë bie e plotë brenda këtyre 15 ditëve — paga, qira, këst kredie apo tatim — kaloni atë zë te «Një herë» dhe vendosni shumën e plotë.",
    monthly: "Mujore",
    quarterly: "3-mujore",
    oneoff: "Një herë",
    inflowsTitle: "Paratë që keni",
    inflowsNote: "Gjendja e sotme, në dispozicionin tuaj.",
    cash: "Para në arkë",
    bank: "Para në bankë",
    collections: "Të hyra të pritshme nga klientët",
    reliability: "Sa prej tyre i llogaritni si të sigurta?",
    reliabilityHelp:
      "Zgjidhni sa nga të hyrat e pritshme i konsideroni të sigurta brenda periudhës së zgjedhur. Nëse nuk jeni të sigurt, mbajeni të ulët.",
    relBands: ["Shumë konservatore", "Konservatore", "E balancuar", "Optimiste"],
    counted: (n, cur) => `Llogariten ${n} ${cur}.`,
    outflowsTitle: "Detyrimet që ju presin",
    outflowsNote: (d) => `Çfarë duhet të paguani brenda ${d} ditëve.`,
    payroll: "Paga",
    taxes: "Tatime dhe kontribute",
    loans: "Këste kredie ose qiraje financiare",
    rent: "Qira, utilitare dhe shpenzime fikse",
    suppliers: "Detyrime ndaj furnitorëve",
    other: "Detyrime të tjera",
    perPeriod: (tot, d) => `Në ${d} ditë: ${tot}`,
    reserveTitle: "Rezerva e sigurisë",
    reserveNote: "Shuma që nuk doni ta prekni për asnjë arsye.",
    reserve: "Rezervë sigurie",
    suggest: "Sugjero",
    suggestNote: (base, cur) =>
      `15 ditë shpenzime të përsëritura (baza: ${base} ${cur} në muaj).`,
    resultLabel: "Shuma e vlerësuar e disponueshme",
    deficitLabel: "Mungesë e vlerësuar",
    forDays: (d) => `për ${d} ditët e ardhshme`,
    resultNote:
      "Bazuar vetëm në informacionin që keni futur. Nuk është garanci dhe nuk zëvendëson gjykimin tuaj.",
    deficitNote:
      "Sipas shifrave të futura, detyrimet dhe rezerva e kalojnë atë që keni në dispozicion.",
    empty: "Filloni duke shënuar paratë që keni.",
    emptyCta: "Shkoni te «Të hyrat»",
    showCalc: "Shfaq llogaritjen",
    hideCalc: "Fshih llogaritjen",
    available: "Në dispozicion",
    less: "Minus",
    equals: "Rezultati",
    method:
      "Shifrat mujore ndahen sipas ditëve të periudhës (15 ditë = gjysma e muajit). Shifrat 3-mujore ndahen mbi 90 ditë. Shifrat një herë llogariten të plota. Kujdes: pagat, qiratë dhe këstet paguhen në data të caktuara — kontrolloni nëse pagesa bie brenda periudhës.",
    quality: "Plotësia e të dhënave",
    q: ["E kufizuar", "E pjesshme", "E mirë", "E plotë"],
    qNote: [
      "Keni futur pak të dhëna. Rezultati është shumë i përafërt.",
      "Disa detyrime nuk janë futur. Rezultati mund të jetë optimist.",
      "Pjesa më e madhe e të dhënave është futur.",
      "Të gjithë zërat kryesorë janë futur.",
    ],
    privacy:
      "Çdo shifër që vendosni qëndron përkohësisht vetëm në pajisjen tuaj, për aq kohë sa faqja mbetet e hapur. Nuk hapet llogari dhe asgjë nuk na dërgohet neve. Sapo t\u2019i pastroni fushat ose ta mbyllni faqen, të dhënat zhduken përfundimisht.",
    reset: "Pastro të gjitha",
    demo: "Ngarko shembull",
    demoHint: "Nuk dini nga t\u2019ia filloni? Provojeni me shifra shembull.",
    stackTitle: "Ku shkojnë paratë",
    safeSeg: "E disponueshme",
    reserveSeg: "Rezervë",
    next: "Vazhdo",
    footerBuilt: "Ndërtuar nga",
    footerDisclaimer:
      "Ky mjet jep vetëm një vlerësim të përafërt, bazuar tërësisht në shifrat që vendosni ju. Nuk përbën këshillë financiare, ligjore apo tatimore dhe nuk zëvendëson gjykimin tuaj apo atë të kontabilistit tuaj. Verifikoni gjithmonë shifrat në regjistrat tuaj përpara se të merrni një vendim.",
    footerRights: "Të gjitha të drejtat e rezervuara.",
  },
  en: {
    appName: "Safe to spend",
    tabs: ["Money in", "Obligations", "Result"],
    horizon: "Time period",
    days: "days",
    horizonNote: "Every figure is calculated for the period you choose.",
    shortPeriodWarn:
      "15-day period: monthly figures are halved. If a payment falls in full inside these 15 days — payroll, rent, a loan instalment or tax — switch that line to \u201cOne-off\u201d and enter the whole amount.",
    monthly: "Monthly",
    quarterly: "Quarterly",
    oneoff: "One-off",
    inflowsTitle: "Money you have",
    inflowsNote: "Today's actual position, at your disposal.",
    cash: "Cash on hand",
    bank: "Money in the bank",
    collections: "Expected collections from customers",
    reliability: "How much of that do you count on?",
    reliabilityHelp:
      "Choose how much of the expected collections you treat as certain within the period you selected. If unsure, keep it low.",
    relBands: ["Very conservative", "Conservative", "Balanced", "Optimistic"],
    counted: (n, cur) => `Counting ${n} ${cur}.`,
    outflowsTitle: "Obligations ahead of you",
    outflowsNote: (d) => `What you must pay within ${d} days.`,
    payroll: "Payroll",
    taxes: "Taxes and contributions",
    loans: "Loan or lease payments",
    rent: "Rent and fixed costs",
    suppliers: "Supplier payments",
    other: "Other obligations",
    perPeriod: (tot, d) => `Over ${d} days: ${tot}`,
    reserveTitle: "Safety reserve",
    reserveNote: "The amount you don't want to touch for any reason.",
    reserve: "Safety reserve",
    suggest: "Suggest",
    suggestNote: (base, cur) =>
      `15 days of recurring running costs (base: ${base} ${cur} per month).`,
    resultLabel: "Estimated amount available",
    deficitLabel: "Estimated shortfall",
    forDays: (d) => `for the next ${d} days`,
    resultNote:
      "Based only on the information you entered. This is not a guarantee and does not replace your own judgement.",
    deficitNote:
      "On the figures entered, obligations and reserve exceed what you have available.",
    empty: "Start by entering the money you have.",
    emptyCta: "Go to \u201cMoney in\u201d",
    showCalc: "Show the calculation",
    hideCalc: "Hide the calculation",
    available: "Available",
    less: "Less",
    equals: "Result",
    method:
      "Monthly figures are spread across the days in the period (15 days = half a month). Quarterly figures are spread over 90 days. One-off figures are counted in full. Note: payroll, rent and loan instalments fall on set dates — check whether a payment lands inside your period.",
    quality: "Data completeness",
    q: ["Limited", "Partial", "Good", "Complete"],
    qNote: [
      "Very little entered. Treat the result as a rough indication only.",
      "Some obligations are missing. The result may be optimistic.",
      "Most of the important figures are entered.",
      "All the main items are entered.",
    ],
    privacy:
      "Everything you enter stays temporarily on your device only, for as long as this page is open. No account is created and nothing is sent to us. As soon as you clear the fields or close the page, the data is gone for good.",
    reset: "Clear everything",
    demo: "Load example",
    demoHint: "Not sure where to start? Try it with example figures.",
    stackTitle: "Where the money goes",
    safeSeg: "Available",
    reserveSeg: "Reserve",
    next: "Continue",
    footerBuilt: "Built by",
    footerDisclaimer:
      "This tool gives a rough estimate only, based entirely on the figures you enter. It is not financial, legal or tax advice and does not replace your own judgement or that of your accountant. Always check the figures against your own records before making a decision.",
    footerRights: "All rights reserved.",
  },
};

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const Icon = ({ name, active }) => {
  const stroke = active ? C.pine : C.faint;
  const common = {
    width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
    stroke, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (name === "in")
    return (
      <svg {...common}>
        <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
        <path d="M2.5 10.5h19" />
        <circle cx="17" cy="15" r="1.2" fill={stroke} stroke="none" />
      </svg>
    );
  if (name === "out")
    return (
      <svg {...common}>
        <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21z" />
        <path d="M9.5 8.5h5M9.5 12.5h5" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */
function Chips({ options, value, onChange, tiny }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full transition-colors ${
              tiny ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
            }`}
            style={{
              background: active ? C.pine : "transparent",
              color: active ? "#fff" : C.muted,
              border: `1px solid ${active ? C.pine : C.line}`,
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MoneyRow({
  id, label, value, onChange, onBlur, onFocus, placeholder, currency,
  freq, onFreqChange, freqLabels, note, accent,
}) {
  return (
    <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="text-sm leading-snug" style={{ color: C.inkSoft }} htmlFor={id}>
          {label}
        </label>
        {accent && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: accent }}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          className="flex-1 min-w-0 py-1 text-right bg-transparent"
          style={{
            fontFamily: F.mono,
            fontSize: "1.4rem",
            color: C.ink,
            border: "none",
            outline: "none",
          }}
        />
        <span
          className="text-xs shrink-0"
          style={{ color: C.faint, fontFamily: F.mono }}
        >
          {currency}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        {freq ? (
          <Chips
            tiny
            value={freq}
            onChange={onFreqChange}
            options={[
              { value: "monthly", label: freqLabels.monthly },
              { value: "quarterly", label: freqLabels.quarterly },
              { value: "oneoff", label: freqLabels.oneoff },
            ]}
          />
        ) : (
          <span />
        )}
        {note && (
          <span
            className="text-xs text-right shrink-0"
            style={{ fontFamily: F.mono, color: C.faint }}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

function Card({ title, note, children }) {
  return (
    <section
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      {title && (
        <div className="px-4 pt-4 pb-3">
          <h2
            style={{
              fontFamily: F.display,
              color: C.ink,
              fontSize: "1.2rem",
              fontWeight: 600,
            }}
          >
            {title}
          </h2>
          {note && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
              {note}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Row({ label, value, bold, sub, color }) {
  return (
    <div
      className="flex justify-between items-baseline gap-3 py-0.5"
      style={{ fontSize: sub ? "0.8rem" : "0.9rem" }}
    >
      <span style={{ color: sub ? C.faint : C.inkSoft }}>{label}</span>
      <span
        style={{ color: color || (sub ? C.faint : C.ink), fontWeight: bold ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function SafeToSpend() {
  /* NOTE FOR DEPLOYMENT ------------------------------------------------
     Language and currency open on a guess from the browser locale (see
     detectDefaults). Once hosting for real, let a saved choice override
     that guess: read lang / currency / reliability from localStorage and
     fall back to detectDefaults() when nothing is stored. Settings only —
     never the financial figures, or the privacy statement stops being true.
  ------------------------------------------------------------------- */
  const [lang, setLang] = useState(() => detectDefaults().lang);
  const [currency, setCurrency] = useState(() => detectDefaults().currency);
  const [horizon, setHorizon] = useState(30);
  const [reliability, setReliability] = useState(75);
  const [tab, setTab] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [freq, setFreq] = useState(DEFAULT_FREQ);
  const [freqTouched, setFreqTouched] = useState({});
  const fired = useRef({});

  const trackOnce = useCallback((name) => {
    if (fired.current[name]) return;
    fired.current[name] = true;
    track(name);
  }, []);
  const [v, setV] = useState(EMPTY_VALUES);
  const [focusedField, setFocusedField] = useState(null);

  const t = T[lang];

  /* Locale-safe: Albanian formats thousands with dots (1.450.000), so we
     cannot simply strip commas. A trailing separator followed by one or
     two digits is treated as a decimal; every other separator is a
     thousands mark and is removed. */
  const parse = useCallback((raw) => {
    if (raw === "" || raw == null) return 0;
    let str = String(raw).trim();
    const negative = str.startsWith("-");
    str = str.replace(/[^0-9.,]/g, "");
    let decimals = "";
    const tail = str.match(/[.,](\d{1,2})$/);
    if (tail) {
      decimals = tail[1];
      str = str.slice(0, str.length - tail[0].length);
    }
    str = str.replace(/[.,]/g, "");
    const n = parseFloat((str || "0") + (decimals ? "." + decimals : ""));
    if (isNaN(n)) return 0;
    return negative ? -n : n;
  }, []);

  /* useGrouping:true is required — "auto" omits the separator on
     four-digit numbers, so 3200 would render bare while 320000 grouped. */
  const fmt = useCallback(
    (n) =>
      new Intl.NumberFormat(GROUP_LOCALE, {
        maximumFractionDigits: 0,
        useGrouping: true,
      }).format(Math.round(n)),
    []
  );

  const num = useCallback((k) => parse(v[k]), [v, parse]);

  /* Re-group the number on every keystroke so long figures stay readable
     as they are typed. A trailing separator and up to two decimals are
     preserved verbatim so the user can still type "12,5". */
  const formatLive = useCallback(
    (raw) => {
      if (raw == null) return "";
      const negative = String(raw).trim().startsWith("-");
      let str = String(raw).replace(/[^0-9.,]/g, "");
      let sepChar = "";
      let decimals = null;
      const tail = str.match(/([.,])(\d{0,2})$/);
      if (tail) {
        sepChar = tail[1];
        decimals = tail[2];
        str = str.slice(0, str.length - tail[0].length);
      }
      const digits = str.replace(/[.,]/g, "");
      if (!digits && decimals === null) return negative ? "-" : "";
      const grouped = digits
        ? new Intl.NumberFormat(GROUP_LOCALE, {
            maximumFractionDigits: 0,
            useGrouping: true,
          }).format(Number(digits))
        : "0";
      return (
        (negative ? "-" : "") + grouped + (decimals !== null ? sepChar + decimals : "")
      );
    },
    []
  );

  const handleChange = useCallback(
    (k) => (e) => {
      const raw = e.target.value;
      if (!/^[0-9.,\s\u00A0\u202F-]*$/.test(raw)) return;
      if (raw !== "") trackOnce("calc_started");
      setV((p) => ({ ...p, [k]: formatLive(raw) }));
    },
    [formatLive, trackOnce]
  );

  const handleFocus = useCallback((k) => () => setFocusedField(k), []);

  const handleBlur = useCallback(
    (k) => () => {
      setFocusedField(null);
      setV((p) => {
        if (p[k] === "") return p;
        const n = parse(p[k]);
        return { ...p, [k]: n === 0 ? "" : fmt(n) };
      });
    },
    [parse, fmt]
  );

  /* greyed zero, cleared while the field has focus */
  const placeholderFor = useCallback(
    (k) => (focusedField === k ? "" : "0"),
    [focusedField]
  );

  /* A business that gets paid monthly usually pays its suppliers on the
     same rhythm, so changing the collections frequency carries over to
     supplier payments — until the user sets that line themselves, after
     which it stays where they put it. */
  const setFreqFor = useCallback(
    (k) => (val) => {
      setFreqTouched((prev) => ({ ...prev, [k]: true }));
      setFreq((prev) => {
        const next = { ...prev, [k]: val };
        if (k === "collections" && !freqTouched.suppliers) next.suppliers = val;
        return next;
      });
    },
    [freqTouched]
  );

  const scaled = useCallback(
    (k) => scaleFor(freq[k], num(k), horizon),
    [freq, num, horizon]
  );

  const calc = useMemo(() => {
    const onHand = num("cash") + num("bank");
    const collectionsPeriod = scaled("collections");
    const eligible = collectionsPeriod * (reliability / 100);
    const available = onHand + eligible;

    const segs = OUTFLOWS.map((k) => ({
      key: k, entered: num(k), amount: scaled(k),
    })).filter((s) => s.amount > 0);

    const obligations = segs.reduce((s, x) => s + x.amount, 0);
    const reserve = num("reserve");
    const safe = available - obligations - reserve;

    const recurringMonthly = OUTFLOWS.reduce((sum, k) => {
      if (freq[k] === "monthly") return sum + num(k);
      if (freq[k] === "quarterly") return sum + num(k) / 3;
      return sum;
    }, 0);
    const suggested = Math.round(recurringMonthly * 0.5);

    const coreKeys = ["payroll", "taxes", "rent", "suppliers", "reserve"];
    const filled = coreKeys.filter((k) => v[k] !== "").length;
    const hasMoney = onHand > 0;
    let qi = 0;
    if (hasMoney && filled >= 5) qi = 3;
    else if (hasMoney && filled >= 3) qi = 2;
    else if (hasMoney && filled >= 1) qi = 1;

    return {
      onHand, collectionsPeriod, eligible, available, segs, obligations,
      reserve, safe, suggested, recurringMonthly, qi,
      started: available > 0,
    };
  }, [v, freq, reliability, num, scaled]);

  const stack = useMemo(() => {
    if (calc.available <= 0) return [];
    const rows = [];
    if (calc.safe > 0)
      rows.push({ key: "safe", label: t.safeSeg, amount: calc.safe, color: C.pine });
    if (calc.reserve > 0)
      rows.push({ key: "reserve", label: t.reserveSeg, amount: calc.reserve, color: C.reserve });
    STACK_ORDER.forEach((key) => {
      const seg = calc.segs.find((s) => s.key === key);
      if (!seg) return;
      rows.push({ key: seg.key, label: t[seg.key], amount: seg.amount, color: SEG_COLORS[seg.key] });
    });
    const shown = rows.reduce((a, r) => a + r.amount, 0) || 1;
    return rows.map((r) => ({ ...r, pct: (r.amount / shown) * 100 }));
  }, [calc, t]);

  const reset = () => {
    setV(EMPTY_VALUES); setFreq(DEFAULT_FREQ); setFreqTouched({});
  };
  const loadDemo = () => {
    /* the sample set is stored unformatted, so group it on the way in —
       these fields are never focused, so the blur formatter never runs */
    const sample = DEMO_VALUES[currency];
    setV(
      Object.keys(sample).reduce(
        (acc, k) => ({ ...acc, [k]: sample[k] === "" ? "" : fmt(parse(sample[k])) }),
        {}
      )
    );
    setFreq(DEFAULT_FREQ);
    setFreqTouched({});
    track("demo_loaded");
  };

  /* Switching currency swaps the sample figures too, but only while the
     untouched demo set is loaded — never once real numbers are typed. */
  const changeCurrency = (next) => {
    setV((prev) => {
      if (!sameNumbers(prev, DEMO_VALUES[currency], parse)) return prev;
      const sample = DEMO_VALUES[next];
      return Object.keys(sample).reduce(
        (acc, k) => ({ ...acc, [k]: sample[k] === "" ? "" : fmt(parse(sample[k])) }),
        {}
      );
    });
    setCurrency(next);
  };

  /* a completed calculation = the user reached the result tab with
     enough entered for a figure to be shown */
  useEffect(() => {
    if (tab === 2) trackOnce("tab_result");
    if (tab === 2 && calc.started) trackOnce("calc_completed");
  }, [tab, calc.started, trackOnce]);

  const negative = calc.safe < 0;
  const bandIndex =
    reliability <= 15 ? 0 : reliability <= 45 ? 1 : reliability <= 75 ? 2 : 3;

  const periodNote = (k) => {
    if (!num(k) || freq[k] === "oneoff") return null;
    return t.perPeriod(fmt(scaled(k)), horizon);
  };

  const freqLabels = { monthly: t.monthly, quarterly: t.quarterly, oneoff: t.oneoff };

  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: C.app }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        input:focus, button:focus-visible { outline: 2px solid ${C.pineLight}; outline-offset: 2px; }
        input[type=range] { accent-color: ${C.pine}; }
        input::placeholder { color: ${C.faint}; opacity: 1; font-weight: 400; }
        .app-root .text-xs { font-size: 0.8125rem; line-height: 1.2rem; }
        .app-root .text-sm { font-size: 0.9375rem; line-height: 1.4rem; }
        .app-scroll::-webkit-scrollbar { width: 0; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .tab-pane { animation: slideUp 260ms cubic-bezier(.32,.72,0,1) both; }
      `}</style>

      <div
        className="app-root w-full flex flex-col"
        style={{
          maxWidth: 440,
          background: C.surface,
          fontFamily: F.body,
          minHeight: "100vh",
          boxShadow: "0 0 40px rgba(20,32,28,0.10)",
        }}
      >
        {/* ------------------ app bar ------------------ */}
        <div style={{ background: C.pineDeep }} className="px-4 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span
              className="text-sm"
              style={{ color: "#fff", fontFamily: F.display, fontWeight: 600, fontSize: "1.2rem" }}
            >
              {t.appName}
            </span>
            <div className="flex gap-1.5">
              {[
                { v: lang, set: setLang, opts: [["sq", "SQ"], ["en", "EN"]] },
                { v: currency, set: changeCurrency, opts: [["ALL", "ALL"], ["EUR", "EUR"]] },
              ].map((grp, gi) => (
                <div key={gi} className="flex rounded-full p-0.5" style={{ background: "rgba(255,255,255,0.10)" }}>
                  {grp.opts.map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => grp.set(val)}
                      className="px-2.5 py-0.5 rounded-full text-xs transition-colors"
                      style={{
                        background: grp.v === val ? "rgba(255,255,255,0.92)" : "transparent",
                        color: grp.v === val ? C.pineDeep : "rgba(255,255,255,0.72)",
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* hero number */}
          <p
            className="text-xs uppercase mb-1.5"
            style={{ fontFamily: F.mono, letterSpacing: "0.13em", color: "rgba(255,255,255,0.55)" }}
          >
            {negative ? t.deficitLabel : t.resultLabel}
          </p>
          {calc.started ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  style={{
                    fontFamily: F.display,
                    fontSize: "2.8rem",
                    lineHeight: 1,
                    fontWeight: 600,
                    color: negative ? "#E8A0A8" : "#8FD9B6",
                  }}
                >
                  {fmt(Math.abs(calc.safe))}
                </span>
                <span style={{ fontFamily: F.mono, color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>
                  {currency}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                {t.forDays(horizon)}
              </p>

              {/* allocation ribbon */}
              {stack.length > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden mt-3.5" style={{ background: "rgba(255,255,255,0.14)" }}>
                  {stack.map((s) => (
                    <div
                      key={s.key}
                      style={{
                        width: `${s.pct}%`,
                        background: s.key === "safe" ? "#8FD9B6" : s.color,
                        transition: "width 350ms cubic-bezier(.4,0,.2,1)",
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              {t.empty}
            </p>
          )}

          {/* period chips */}
          <div className="flex gap-1.5 mt-4">
            {[15, 30, 60, 90].map((d) => {
              const active = horizon === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setHorizon(d);
                    track(`period_${d}`);
                  }}
                  className="flex-1 rounded-lg py-1.5 text-xs transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.08)",
                    color: active ? C.pineDeep : "rgba(255,255,255,0.75)",
                    fontWeight: active ? 600 : 400,
                    fontFamily: F.mono,
                  }}
                >
                  {d}
                  <span style={{ fontSize: "0.65rem" }}> {t.days}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------ content ------------------ */}
        <div className="app-scroll px-3 pt-4" style={{ paddingBottom: 4 }}>
          {tab === 0 && (
            <div className="tab-pane">
              {horizon === 15 && (
                <div
                  className="rounded-2xl p-3.5 mb-4 flex gap-2.5"
                  style={{ background: "#FBF6EC", border: "1px solid #E9DCBE" }}
                >
                  <span style={{ color: C.brass, fontFamily: F.mono, fontSize: "0.8rem", lineHeight: 1.4 }}>!</span>
                  <p className="text-xs leading-relaxed" style={{ color: "#5D4A28" }}>
                    {t.shortPeriodWarn}
                  </p>
                </div>
              )}

              <div
                className="rounded-2xl px-4 py-3.5 mb-4 flex items-center justify-between gap-3"
                style={{ background: C.card, border: `1px solid ${C.line}` }}
              >
                <p className="text-xs leading-snug" style={{ color: C.muted }}>
                  {t.demoHint}
                </p>
                <button
                  type="button"
                  onClick={loadDemo}
                  className="text-xs px-3 py-1.5 rounded-full shrink-0"
                  style={{ color: C.pine, border: `1px solid ${C.pine}`, background: "transparent" }}
                >
                  {t.demo}
                </button>
              </div>

              <Card title={t.inflowsTitle} note={t.inflowsNote}>
                <MoneyRow
                  id="f-cash" label={t.cash} value={v.cash}
                  onChange={handleChange("cash")} onBlur={handleBlur("cash")}
                  onFocus={handleFocus("cash")} placeholder={placeholderFor("cash")}
                  currency={currency}
                />
                <MoneyRow
                  id="f-bank" label={t.bank} value={v.bank}
                  onChange={handleChange("bank")} onBlur={handleBlur("bank")}
                  onFocus={handleFocus("bank")} placeholder={placeholderFor("bank")}
                  currency={currency}
                />
                <MoneyRow
                  id="f-collections" label={t.collections} value={v.collections}
                  onChange={handleChange("collections")} onBlur={handleBlur("collections")}
                  onFocus={handleFocus("collections")} placeholder={placeholderFor("collections")}
                  currency={currency} freq={freq.collections}
                  onFreqChange={setFreqFor("collections")} freqLabels={freqLabels}
                  note={periodNote("collections")}
                />

                <div className="px-4 py-4">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <label className="text-sm" style={{ color: C.inkSoft }} htmlFor="rel">
                      {t.reliability}
                    </label>
                    <span style={{ fontFamily: F.mono, fontSize: "1.2rem", color: C.pine, fontWeight: 600 }}>
                      {reliability}%
                    </span>
                  </div>
                  <input
                    id="rel" type="range" min={0} max={100} step={5}
                    value={reliability}
                    onChange={(e) => setReliability(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs mt-1.5" style={{ color: C.inkSoft }}>
                    {t.relBands[bandIndex]}
                    {calc.eligible > 0 && (
                      <span style={{ color: C.faint }}>
                        {" — "}{t.counted(fmt(calc.eligible), currency)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: C.faint }}>
                    {t.reliabilityHelp}
                  </p>
                </div>
              </Card>

              <button
                type="button"
                onClick={() => setTab(1)}
                className="w-full rounded-xl py-3.5 text-sm mb-2"
                style={{ background: C.pine, color: "#fff", fontWeight: 500 }}
              >
                {t.next}
              </button>
            </div>
          )}

          {tab === 1 && (
            <div className="tab-pane">
              <Card title={t.outflowsTitle} note={t.outflowsNote(horizon)}>
                {OUTFLOWS.map((k) => (
                  <MoneyRow
                    key={k} id={`f-${k}`} label={t[k]} value={v[k]}
                    onChange={handleChange(k)} onBlur={handleBlur(k)}
                    onFocus={handleFocus(k)} placeholder={placeholderFor(k)}
                    currency={currency} freq={freq[k]}
                    onFreqChange={setFreqFor(k)} freqLabels={freqLabels}
                    note={periodNote(k)} accent={SEG_COLORS[k]}
                  />
                ))}
              </Card>

              <Card title={t.reserveTitle} note={t.reserveNote}>
                <MoneyRow
                  id="f-reserve" label={t.reserve} value={v.reserve}
                  onChange={handleChange("reserve")} onBlur={handleBlur("reserve")}
                  onFocus={handleFocus("reserve")} placeholder={placeholderFor("reserve")}
                  currency={currency} accent={C.reserve}
                />
                {calc.suggested > 0 && (
                  <div className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setV((p) => ({ ...p, reserve: fmt(calc.suggested) }))}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ color: C.pine, border: `1px solid ${C.line}`, background: C.surface }}
                    >
                      {t.suggest}: {fmt(calc.suggested)} {currency}
                    </button>
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: C.faint }}>
                      {t.suggestNote(fmt(calc.recurringMonthly), currency)}
                    </p>
                  </div>
                )}
              </Card>

              <button
                type="button"
                onClick={() => setTab(2)}
                className="w-full rounded-xl py-3.5 text-sm mb-2"
                style={{ background: C.pine, color: "#fff", fontWeight: 500 }}
              >
                {t.next}
              </button>
            </div>
          )}

          {tab === 2 && (
            <div className="tab-pane">
              {!calc.started ? (
                <Card>
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm mb-4" style={{ color: C.muted }}>{t.empty}</p>
                    <button
                      type="button"
                      onClick={() => setTab(0)}
                      className="text-sm px-4 py-2 rounded-full"
                      style={{ color: C.pine, border: `1px solid ${C.line}` }}
                    >
                      {t.emptyCta}
                    </button>
                  </div>
                </Card>
              ) : (
                <>
                  <Card title={t.stackTitle}>
                    <div className="px-4 pb-4 flex gap-3">
                      <div
                        className="w-8 rounded-md overflow-hidden flex flex-col shrink-0 self-stretch"
                        style={{ minHeight: 220, background: "#EAEEEA" }}
                      >
                        {stack.map((s) => (
                          <div
                            key={s.key}
                            style={{
                              height: `${s.pct}%`,
                              background: s.color,
                              transition: "height 350ms cubic-bezier(.4,0,.2,1)",
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 py-0.5">
                        {stack.map((s) => (
                          <div
                            key={s.key}
                            className="flex items-baseline justify-between gap-2 min-w-0"
                          >
                            <span className="flex items-baseline gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: s.color, transform: "translateY(-1px)" }}
                              />
                              <span
                                className="text-xs leading-snug"
                                style={{ color: C.inkSoft, overflowWrap: "anywhere" }}
                              >
                                {s.label}
                              </span>
                            </span>
                            <span
                              className="text-xs shrink-0 whitespace-nowrap"
                              style={{
                                fontFamily: F.mono,
                                color: C.muted,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {fmt(s.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-4 py-3.5" style={{ borderTop: `1px solid ${C.line}`, background: C.surface }}>
                      <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                        {negative ? t.deficitNote : t.resultNote}
                      </p>
                    </div>
                  </Card>

                  <Card>
                    <div className="px-4 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: C.muted }}>{t.quality}</span>
                        <span className="text-xs" style={{ fontFamily: F.mono, color: C.inkSoft }}>
                          {t.q[calc.qi]}
                        </span>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="h-1 flex-1 rounded-full"
                            style={{ background: i <= calc.qi ? C.brass : "#E4E9E4" }} />
                        ))}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: C.faint }}>
                        {t.qNote[calc.qi]}
                      </p>
                    </div>
                  </Card>

                  <Card>
                    <button
                      type="button"
                      onClick={() => setShowCalc(!showCalc)}
                      className="w-full px-4 py-3.5 text-left text-sm"
                      style={{ color: C.pine }}
                    >
                      {showCalc ? t.hideCalc : t.showCalc}
                    </button>
                    {showCalc && (
                      <div className="px-4 pb-4" style={{ borderTop: `1px solid ${C.line}` }}>
                        <div className="pt-3" style={{ fontFamily: F.mono }}>
                          <Row label={t.available} value={fmt(calc.available)} bold />
                          <Row label={`— ${t.cash}`} value={fmt(num("cash"))} sub />
                          <Row label={`— ${t.bank}`} value={fmt(num("bank"))} sub />
                          {calc.eligible > 0 && (
                            <Row label={`— ${t.collections} (${reliability}%)`} value={fmt(calc.eligible)} sub />
                          )}
                          <div className="h-2" />
                          {calc.segs.map((s) => (
                            <Row key={s.key} label={`${t.less} ${t[s.key].toLowerCase()}`} value={`−${fmt(s.amount)}`} />
                          ))}
                          {calc.reserve > 0 && (
                            <Row label={`${t.less} ${t.reserve.toLowerCase()}`} value={`−${fmt(calc.reserve)}`} />
                          )}
                          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                            <Row label={t.equals} value={fmt(calc.safe)} bold
                              color={negative ? C.oxblood : C.pine} />
                          </div>
                        </div>
                        <p className="text-xs mt-3 leading-relaxed" style={{ color: C.faint }}>
                          {t.method}
                        </p>
                      </div>
                    )}
                  </Card>

                  <div className="px-1 mb-3">
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs"
                      style={{ color: C.muted, textDecoration: "underline" }}
                    >
                      {t.reset}
                    </button>
                  </div>

                  <p className="text-xs leading-relaxed px-1 pb-2" style={{ color: C.faint }}>
                    {t.privacy}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ------------------ footer ------------------ */}
        <footer
          className="px-4 pt-3 pb-3"
          style={{ borderTop: `1px solid ${C.line}`, background: C.card }}
        >
          {tab === 2 && (
            <p className="text-xs leading-relaxed mb-3" style={{ color: C.faint }}>
              {t.footerDisclaimer}
            </p>
          )}
          <p className="text-xs" style={{ color: C.muted }}>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://www.linkedin.com/in/dorin-maraku-resume/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.pine, fontWeight: 500, textDecoration: "none" }}
            >
              dmarax
            </a>
            <span style={{ color: C.faint }}> · {t.footerRights}</span>
          </p>
        </footer>

        {/* exactly the height of the fixed nav, so the footer ends flush
            against it with no visible gap */}
        <div style={{ height: 74, background: C.surface }} />

        {/* ------------------ bottom nav ------------------ */}
        <div
          className="fixed bottom-0 w-full"
          style={{
            maxWidth: 440,
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(12px)",
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div className="flex">
            {t.tabs.map((label, i) => {
              const active = tab === i;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTab(i)}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5"
                >
                  <Icon name={["in", "out", "result"][i]} active={active} />
                  <span
                    className="text-xs"
                    style={{ color: active ? C.pine : C.faint, fontWeight: active ? 500 : 400 }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ height: 8 }} />
        </div>
      </div>
    </div>
  );
}
