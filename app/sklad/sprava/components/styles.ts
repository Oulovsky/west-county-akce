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
