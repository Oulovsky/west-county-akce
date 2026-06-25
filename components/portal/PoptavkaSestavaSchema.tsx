"use client";

import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";

type Props = {
  state: SestavaKonfiguratorState;
  className?: string;
};

const SCALE = 14;

function iso(x: number, y: number, z: number) {
  return {
    x: 200 + (x - y) * SCALE * 0.7,
    y: 220 - z * SCALE + (x + y) * SCALE * 0.35,
  };
}

function roofPoints(w: number, d: number) {
  const c = iso(w / 2, d / 2, 4);
  const fl = iso(0, 0, 4);
  const fr = iso(w, 0, 4);
  const br = iso(w, d, 4);
  const bl = iso(0, d, 4);
  return `${fl.x},${fl.y} ${fr.x},${fr.y} ${c.x},${c.y - 18} ${bl.x},${bl.y}`;
}

function floorPoints(w: number, d: number, h: number) {
  const fl = iso(0, 0, h);
  const fr = iso(w, 0, h);
  const br = iso(w, d, h);
  const bl = iso(0, d, h);
  return `${fl.x},${fl.y} ${fr.x},${fr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;
}

export default function PoptavkaSestavaSchema({ state, className }: Props) {
  if (state.rezim === "atypicka") {
    return (
      <svg
        viewBox="0 0 400 200"
        className={className ?? "h-auto w-full max-w-md rounded-xl border border-white/10 bg-slate-950/60"}
        role="img"
        aria-label="Atypické technické zadání"
      >
        <rect x="24" y="24" width="352" height="152" rx="12" fill="#1e293b" stroke="#64748b" />
        <text x="200" y="72" fill="#f8fafc" fontSize="14" textAnchor="middle" fontWeight="bold">
          Atypické zadání
        </text>
        <text x="200" y="98" fill="#94a3b8" fontSize="11" textAnchor="middle">
          Ruční technický návrh a nacenění
        </text>
        <text x="200" y="128" fill="#cbd5e1" fontSize="10" textAnchor="middle">
          WEST COUNTY posoudí zadání individuálně
        </text>
      </svg>
    );
  }

  const roofW = state.zastreseni_sirka_m ?? state.podium_sirka_m ?? 10;
  const roofD = state.zastreseni_hloubka_m ?? state.podium_hloubka_m ?? 8;
  const podW = state.podium_sirka_m ?? roofW * 0.8;
  const podD = state.podium_hloubka_m ?? roofD * 0.75;
  const podH = state.podium_vyska_m ?? 1.2;
  const offsetX = (roofW - podW) / 2;
  const offsetY = (roofD - podD) / 2;
  const isMobile = state.stage_typ === "mobilni";

  const showRoof = Boolean(state.stage_typ);
  const showPodium = Boolean(state.podium_sirka_m && state.podium_hloubka_m);
  const showLedOnPodium = state.led_pozadovano && state.led_umisteni === "stack_na_podiu";
  const showLedGate = state.led_pozadovano && state.led_umisteni === "mimo_stage_branka";
  const paOnStands = isMobile;
  const paOnWings = !isMobile && Boolean(state.zvuk_preset);

  const ledW = Math.min(state.led_sirka_m ?? 4, podW * 0.9);
  const ledH = Math.min(state.led_vyska_m ?? 2.5, podD * 0.5);

  return (
    <svg
      viewBox="0 0 400 320"
      className={className ?? "h-auto w-full max-w-md rounded-xl border border-white/10 bg-slate-950/60"}
      role="img"
      aria-label="Schéma sestavy stage"
    >
      <defs>
        <linearGradient id="roofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      {showRoof && state.stage_typ === "zastresene" ? (
        <polygon points={roofPoints(roofW, roofD)} fill="url(#roofGrad)" stroke="#64748b" strokeWidth="1.2" />
      ) : null}

      {showRoof && isMobile ? (
        <>
          <polygon points={floorPoints(roofW, roofD, podH)} fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <rect
            x={iso(roofW / 2 - 1, -1.5, 0).x - 20}
            y={iso(roofW / 2 - 1, -1.5, 0).y}
            width="40"
            height="8"
            rx="2"
            fill="#94a3b8"
          />
        </>
      ) : null}

      {showPodium ? (
        <polygon
          points={floorPoints(podW, podD, podH)}
          transform={`translate(${iso(offsetX, offsetY, 0).x - iso(0, 0, 0).x}, ${iso(offsetX, offsetY, 0).y - iso(0, 0, 0).y})`}
          fill="#111827"
          stroke="#374151"
          strokeWidth="1.2"
        />
      ) : null}

      {state.schody_pocet > 0 && state.schody_strany.includes("vlevo") ? (
        <rect
          x={iso(offsetX - 0.8, offsetY + podD / 2, 0).x}
          y={iso(offsetX - 0.8, offsetY + podD / 2, 0).y - 6}
          width="18"
          height="28"
          fill="#4b5563"
          stroke="#9ca3af"
          strokeWidth="0.8"
        />
      ) : null}
      {state.schody_pocet > 0 && state.schody_strany.includes("vpravo") ? (
        <rect
          x={iso(offsetX + podW + 0.2, offsetY + podD / 2, 0).x}
          y={iso(offsetX + podW + 0.2, offsetY + podD / 2, 0).y - 6}
          width="18"
          height="28"
          fill="#4b5563"
          stroke="#9ca3af"
          strokeWidth="0.8"
        />
      ) : null}

      {state.praktikabl_typ !== "zadny" && showPodium ? (
        <polygon
          points={floorPoints(2.5, 1.5, podH + 0.4)}
          transform={`translate(${iso(offsetX + podW / 2 - 1.25, offsetY + podD - 2, 0).x - iso(0, 0, 0).x}, ${iso(offsetX + podW / 2 - 1.25, offsetY + podD - 2, 0).y - iso(0, 0, 0).y})`}
          fill="#7c3aed"
          fillOpacity="0.55"
          stroke="#a78bfa"
          strokeWidth="1"
        />
      ) : null}

      {showLedOnPodium ? (
        <rect
          x={iso(offsetX + (podW - ledW) / 2, offsetY + podD - ledH - 0.3, podH).x}
          y={iso(offsetX + (podW - ledW) / 2, offsetY + podD - ledH - 0.3, podH).y - ledH * SCALE * 0.35}
          width={ledW * SCALE * 0.7}
          height={ledH * SCALE * 0.5}
          fill="#0ea5e9"
          stroke="#38bdf8"
          strokeWidth="1"
          rx="2"
        />
      ) : null}

      {showLedGate ? (
        <>
          <line
            x1={iso(roofW / 2 - 2, roofD + 1.5, 0).x}
            y1={iso(roofW / 2 - 2, roofD + 1.5, 0).y}
            x2={iso(roofW / 2 - 2, roofD + 1.5, 5).x}
            y2={iso(roofW / 2 - 2, roofD + 1.5, 5).y}
            stroke="#94a3b8"
            strokeWidth="3"
          />
          <line
            x1={iso(roofW / 2 + 2, roofD + 1.5, 0).x}
            y1={iso(roofW / 2 + 2, roofD + 1.5, 0).y}
            x2={iso(roofW / 2 + 2, roofD + 1.5, 5).x}
            y2={iso(roofW / 2 + 2, roofD + 1.5, 5).y}
            stroke="#94a3b8"
            strokeWidth="3"
          />
          <line
            x1={iso(roofW / 2 - 2, roofD + 1.5, 5).x}
            y1={iso(roofW / 2 - 2, roofD + 1.5, 5).y}
            x2={iso(roofW / 2 + 2, roofD + 1.5, 5).x}
            y2={iso(roofW / 2 + 2, roofD + 1.5, 5).y}
            stroke="#94a3b8"
            strokeWidth="2.5"
          />
          <rect
            x={iso(roofW / 2 - ledW / 2, roofD + 1.2, 1).x}
            y={iso(roofW / 2 - ledW / 2, roofD + 1.2, 1).y - 20}
            width={ledW * SCALE * 0.65}
            height={18}
            fill="#0ea5e9"
            stroke="#38bdf8"
          />
        </>
      ) : null}

      {paOnStands && state.zvuk_preset ? (
        <>
          <circle cx={iso(-1.2, podD / 2, podH + 1).x} cy={iso(-1.2, podD / 2, podH + 1).y} r="6" fill="#f59e0b" />
          <circle cx={iso(podW + 1.2, podD / 2, podH + 1).x} cy={iso(podW + 1.2, podD / 2, podH + 1).y} r="6" fill="#f59e0b" />
        </>
      ) : null}

      {paOnWings ? (
        <>
          <ellipse cx={iso(-1.5, podD / 2, 3.5).x} cy={iso(-1.5, podD / 2, 3.5).y} rx="8" ry="5" fill="#f59e0b" />
          <ellipse cx={iso(roofW + 1.5, podD / 2, 3.5).x} cy={iso(roofW + 1.5, podD / 2, 3.5).y} rx="8" ry="5" fill="#f59e0b" />
          <rect x={iso(roofW / 2 - 0.6, -0.8, 0).x} y={iso(roofW / 2 - 0.6, -0.8, 0).y} width="10" height="8" fill="#78350f" rx="1" />
        </>
      ) : null}

      {state.svetla_preset ? (
        <>
          <line x1={iso(1, 1, 3.8).x} y1={iso(1, 1, 3.8).y} x2={iso(roofW - 1, 1, 3.8).x} y2={iso(roofW - 1, 1, 3.8).y} stroke="#fde047" strokeWidth="2" />
          <line x1={iso(1, podD - 1, 3.8).x} y1={iso(1, podD - 1, 3.8).y} x2={iso(roofW - 1, podD - 1, 3.8).x} y2={iso(roofW - 1, podD - 1, 3.8).y} stroke="#fde047" strokeWidth="2" />
        </>
      ) : null}

      {(state.kamery_pocet > 0 || state.dron) && (
        <>
          {state.kamery_pocet > 0 ? (
            <text x="30" y="300" fill="#cbd5e1" fontSize="11">
              📷 {state.kamery_pocet}× kamera (s obsluhou)
            </text>
          ) : null}
          {state.dron ? (
            <text x="220" y="300" fill="#cbd5e1" fontSize="11">
              🚁 dron (s obsluhou)
            </text>
          ) : null}
        </>
      )}

      {state.cista_vyska_m ? (
        <text x="12" y="24" fill="#93c5fd" fontSize="11">
          Čistá výška: {state.cista_vyska_m} m
        </text>
      ) : null}

      {state.kotveni_typ === "ibc_boxy" ? (
        <>
          <rect x={iso(0, 0, 0).x - 8} y={iso(0, 0, 0).y + 4} width="12" height="8" fill="#1f2937" stroke="#6b7280" />
          <rect x={iso(roofW, roofD, 0).x - 4} y={iso(roofW, roofD, 0).y + 4} width="12" height="8" fill="#1f2937" stroke="#6b7280" />
        </>
      ) : null}
      {state.kotveni_typ === "zatloukane" ? (
        <text x="12" y="40" fill="#86efac" fontSize="10">
          Kotvení: zatloukané
        </text>
      ) : null}
    </svg>
  );
}
