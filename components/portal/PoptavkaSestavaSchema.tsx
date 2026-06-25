"use client";

import { findZastreseniVariant } from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";
import { schodyVolbaFromState } from "@/lib/client-portal/sestava-konfigurator-form";

type Props = {
  state: SestavaKonfiguratorState;
  katalog?: PortalSestavaKatalog;
  className?: string;
};

/** Jednoduché schéma — boční pohled se popsanými bloky. */
export default function PoptavkaSestavaSchema({ state, katalog, className }: Props) {
  if (state.rezim === "atypicka") {
    return (
      <svg
        viewBox="0 0 360 180"
        className={
          className ?? "h-auto w-full rounded-xl border border-white/10 bg-slate-950/60"
        }
        role="img"
        aria-label="Atypické technické zadání"
      >
        <rect x="20" y="20" width="320" height="140" rx="10" fill="#1e293b" stroke="#64748b" />
        <text x="180" y="68" fill="#f8fafc" fontSize="14" textAnchor="middle" fontWeight="bold">
          Atypické zadání
        </text>
        <text x="180" y="92" fill="#94a3b8" fontSize="11" textAnchor="middle">
          Ruční technický návrh
        </text>
        <text x="180" y="118" fill="#cbd5e1" fontSize="10" textAnchor="middle">
          WEST COUNTY posoudí zadání individuálně
        </text>
      </svg>
    );
  }

  const variant =
    katalog && state.zastreseni_variant_id
      ? findZastreseniVariant(katalog, state.zastreseni_variant_id)
      : null;

  const roofW = state.zastreseni_sirka_m ?? variant?.sirka_m ?? state.podium_sirka_m ?? 10;
  const roofD = state.zastreseni_hloubka_m ?? variant?.hloubka_m ?? state.podium_hloubka_m ?? 8;
  const podW = state.podium_sirka_m ?? Math.min(8, roofW);
  const podH = state.podium_vyska_m ?? 1;
  const scale = 220 / Math.max(roofW, 12);
  const baseY = 150;
  const originX = 40;

  const stageW = roofW * scale;
  const stageH = 36;
  const podiumW = podW * scale;
  const podiumBlockH = Math.max(14, podH * 18);
  const podiumX = originX + (stageW - podiumW) / 2;

  const schody = schodyVolbaFromState(state);
  const showLed =
    state.led_pozadovano &&
    state.led_sirka_m &&
    state.led_vyska_m &&
    state.led_umisteni === "stack_na_podiu";
  const showLedGate =
    state.led_pozadovano && state.led_umisteni === "mimo_stage_branka";
  const showMantinel = state.led_pozadovano && state.led_umisteni === "mantinel";

  return (
    <svg
      viewBox="0 0 360 220"
      className={className ?? "h-auto w-full rounded-xl border border-white/10 bg-slate-950/60"}
      role="img"
      aria-label="Schéma sestavy stage"
    >
      <text x="12" y="16" fill="#94a3b8" fontSize="10">
        Schéma sestavy (orientační)
      </text>

      {/* Zastřešení / mobilní stage */}
      {state.stage_typ === "zastresene" ? (
        <>
          <polygon
            points={`${originX},${baseY - stageH} ${originX + stageW},${baseY - stageH} ${originX + stageW / 2},${baseY - stageH - 22} ${originX},${baseY - stageH - 22}`}
            fill="#334155"
            stroke="#64748b"
          />
          <text x={originX + stageW / 2} y={baseY - stageH - 28} fill="#cbd5e1" fontSize="9" textAnchor="middle">
            Zastřešení {roofW}×{roofD} m
          </text>
        </>
      ) : state.stage_typ === "mobilni" ? (
        <>
          <rect
            x={originX}
            y={baseY - stageH}
            width={stageW}
            height={stageH}
            fill="#1e293b"
            stroke="#64748b"
          />
          <text x={originX + stageW / 2} y={baseY - stageH - 6} fill="#cbd5e1" fontSize="9" textAnchor="middle">
            Mobilní stage
          </text>
        </>
      ) : (
        <text x="180" y="80" fill="#64748b" fontSize="11" textAnchor="middle">
          Vyberte typ stage
        </text>
      )}

      {/* Pódium */}
      {state.podium_sirka_m && state.podium_hloubka_m ? (
        <>
          <rect
            x={podiumX}
            y={baseY - podiumBlockH}
            width={podiumW}
            height={podiumBlockH}
            fill="#111827"
            stroke="#475569"
          />
          <text x={podiumX + podiumW / 2} y={baseY + 14} fill="#94a3b8" fontSize="9" textAnchor="middle">
            Pódium {state.podium_sirka_m}×{state.podium_hloubka_m} m
          </text>
        </>
      ) : null}

      {/* Schody */}
      {schody === "vlevo" || schody === "vlevo_vpravo" ? (
        <rect x={podiumX - 14} y={baseY - 10} width="12" height="18" fill="#4b5563" stroke="#9ca3af" />
      ) : null}
      {schody === "vpravo" || schody === "vlevo_vpravo" ? (
        <rect x={podiumX + podiumW + 2} y={baseY - 10} width="12" height="18" fill="#4b5563" stroke="#9ca3af" />
      ) : null}

      {/* Praktikábl */}
      {state.praktikabl_typ !== "zadny" ? (
        <>
          <rect
            x={podiumX + podiumW * 0.35}
            y={baseY - podiumBlockH - 12}
            width={podiumW * 0.3}
            height="10"
            fill="#7c3aed"
            fillOpacity="0.7"
            stroke="#a78bfa"
          />
          <text x={podiumX + podiumW / 2} y={baseY - podiumBlockH - 16} fill="#ddd6fe" fontSize="8" textAnchor="middle">
            Praktikábl{state.praktikabl_mobilni ? " (mobilní)" : ""}
          </text>
        </>
      ) : null}

      {/* LED stack */}
      {showLed ? (
        <rect
          x={podiumX + podiumW * 0.2}
          y={baseY - podiumBlockH - 28}
          width={podiumW * 0.6}
          height="14"
          fill="#0ea5e9"
          stroke="#38bdf8"
          rx="2"
        />
      ) : null}
      {showLed ? (
        <text x={podiumX + podiumW / 2} y={baseY - podiumBlockH - 32} fill="#bae6fd" fontSize="8" textAnchor="middle">
          LED {state.led_sirka_m}×{state.led_vyska_m} m
        </text>
      ) : null}

      {/* LED branka */}
      {showLedGate ? (
        <>
          <line x1={originX + stageW * 0.35} y1={baseY} x2={originX + stageW * 0.35} y2={baseY - 50} stroke="#94a3b8" strokeWidth="2" />
          <line x1={originX + stageW * 0.65} y1={baseY} x2={originX + stageW * 0.65} y2={baseY - 50} stroke="#94a3b8" strokeWidth="2" />
          <rect x={originX + stageW * 0.35} y={baseY - 58} width={stageW * 0.3} height="10" fill="#0ea5e9" stroke="#38bdf8" />
          <text x={originX + stageW / 2} y={baseY - 62} fill="#bae6fd" fontSize="8" textAnchor="middle">
            LED branka
          </text>
        </>
      ) : null}

      {/* Mantinel */}
      {showMantinel ? (
        <rect
          x={originX}
          y={baseY - podiumBlockH - 8}
          width={stageW}
          height="6"
          fill="#0ea5e9"
          stroke="#38bdf8"
        />
      ) : null}

      {/* PA */}
      {state.zvuk_preset || state.zvuk_setup_id ? (
        <>
          {state.stage_typ === "mobilni" ? (
            <>
              <circle cx={originX - 8} cy={baseY - 24} r="5" fill="#f59e0b" />
              <circle cx={originX + stageW + 8} cy={baseY - 24} r="5" fill="#f59e0b" />
            </>
          ) : (
            <>
              <rect x={originX - 10} y={baseY - stageH - 8} width="8" height="12" fill="#f59e0b" rx="1" />
              <rect x={originX + stageW + 2} y={baseY - stageH - 8} width="8" height="12" fill="#f59e0b" rx="1" />
            </>
          )}
          <text x={originX + stageW / 2} y="12" fill="#fcd34d" fontSize="9" textAnchor="middle">
            PA systém
          </text>
        </>
      ) : null}

      {/* Světla */}
      {state.svetla_preset || state.svetla_setup_id ? (
        <text x={originX + stageW / 2} y="26" fill="#fde047" fontSize="9" textAnchor="middle">
          Světelná sestava
        </text>
      ) : null}

      {/* Kamery / dron */}
      {(state.kamery_pocet > 0 || state.dron) && (
        <text x="12" y="210" fill="#cbd5e1" fontSize="9">
          {state.kamery_pocet > 0 ? `Kamery ${state.kamery_pocet}×` : ""}
          {state.kamery_pocet > 0 && state.dron ? " · " : ""}
          {state.dron ? "Dron" : ""}
          {" (s obsluhou)"}
        </text>
      )}

      {state.cista_vyska_m ? (
        <text x={originX + stageW + 12} y={baseY - stageH} fill="#93c5fd" fontSize="9">
          ↕ {state.cista_vyska_m} m
        </text>
      ) : null}

      {state.kotveni_typ === "ibc_boxy" ? (
        <>
          <rect x={originX - 6} y={baseY - 6} width="8" height="6" fill="#374151" stroke="#6b7280" />
          <rect x={originX + stageW - 2} y={baseY - 6} width="8" height="6" fill="#374151" stroke="#6b7280" />
        </>
      ) : null}
      {state.kotveni_typ === "zatloukane" ? (
        <text x="12" y="196" fill="#86efac" fontSize="9">
          Kotvení: zatloukané
        </text>
      ) : null}
    </svg>
  );
}
