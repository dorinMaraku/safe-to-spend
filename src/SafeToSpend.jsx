import { useState, useMemo, useCallback } from "react";

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