import { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "8px 10px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#fff",
};

export const inputStyleSmall: CSSProperties = {
  ...inputStyle,
  textAlign: "right",
};

export const selectStyle: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "8px 10px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#fff",
};

export const valueBoxRight: CSSProperties = {
  width: "100%",
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: "8px 10px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#e2e8f0",
  fontWeight: 600,
};

export const valueBoxLeft: CSSProperties = {
  ...valueBoxRight,
  justifyContent: "flex-start",
};

export const mutedBoxRight: CSSProperties = {
  ...valueBoxRight,
  color: "#64748b",
};

export const dangerBoxRight: CSSProperties = {
  ...valueBoxRight,
  color: "#fb7185",
  textDecoration: "underline",
};

const tableControlBase: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 32,
  padding: "4px 6px",
  fontSize: 12,
  lineHeight: "1.25",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#fff",
  outline: "none",
};

export const tableInputStyle: CSSProperties = {
  ...tableControlBase,
};

export const tableInputStyleSmall: CSSProperties = {
  ...tableControlBase,
  textAlign: "center",
};

export const tableSelectStyle: CSSProperties = {
  ...tableControlBase,
  flex: 1,
  minWidth: 0,
  width: "auto",
};

export const tableValueBoxRight: CSSProperties = {
  ...tableControlBase,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  color: "#e2e8f0",
  textAlign: "center",
};

/** Zobrazené hodnoty v pravé části tabulky (vč. jednotky) — centrovaně v buňce. */
export const tableValueBoxLeft: CSSProperties = {
  ...tableValueBoxRight,
};

export const tableMutedBoxRight: CSSProperties = {
  ...tableValueBoxRight,
  color: "#64748b",
};

export const tableDangerBoxRight: CSSProperties = {
  ...tableValueBoxRight,
  color: "#fb7185",
  textDecoration: "underline",
};
