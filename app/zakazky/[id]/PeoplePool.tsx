"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import Toast from "@/components/Toast";
import { isPrepravaTypBloku } from "@/lib/zakazka-attendance";
import { updateAttendanceManualAction } from "./dochazka-actions";

type TypBloku = "sklad" | "stavba" | "akce" | "bourani";

type User = {
  user_id: string;
  user_name: string;
};

type Assignment = {
  id: string | number;
  user_id: string;
  datum_od?: string | null;
  datum_do?: string | null;
  has_conflict?: boolean;
  typ_bloku?: string | null;
  poznamka?: string | null;
  confirmation_status?: string | null;
  declined_reason?: string | null;
  responded_at?: string | null;
  attendance_rows?: AttendanceRow[];
  attendance_actual_minutes?: number;
  attendance_planned_minutes?: number;
  attendance_active?: boolean;
};

type AttendanceRow = {
  id: string;
  typ_faze?: string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
  gps_checkin_lat?: number | string | null;
  gps_checkin_lng?: number | string | null;
  gps_checkout_lat?: number | string | null;
  gps_checkout_lng?: number | string | null;
  gps_accuracy?: number | string | null;
  gps_checkout_accuracy?: number | string | null;
  manual_override?: boolean | null;
  override_reason?: string | null;
};

type Zakazka = {
  id?: string;
  zakazka_id?: string;
  datum_od?: string | null;
  datum_do?: string | null;
  cas_od?: string | null;
  cas_do?: string | null;
  odjezd_ze_skladu?: string | null;
  sraz_na_miste?: string | null;
  stavba_od?: string | null;
  stavba_do?: string | null;
  akce_od?: string | null;
  akce_do?: string | null;
  bourani_od?: string | null;
  bourani_do?: string | null;
  nazev?: string | null;
  typ_obsluhy?: string | null;
};

type OtherZakazka = {
  zakazka_id?: string;
  nazev?: string | null;
};

type OtherRow = {
  id?: string | number;
  zakazka_id?: string | null;
  user_id: string;
  datum_od?: string | null;
  datum_do?: string | null;
  typ_bloku?: string | null;
  zakazky?: OtherZakazka | null;
};

type PeopleResponse = {
  assignments?: Assignment[];
  currentZakazka?: Zakazka | null;
  other?: OtherRow[];
  error?: string;
};

type ModalState =
  | {
      mode: "add";
      userIds: string[];
      currentFrom: string;
      currentTo: string;
      typBloku: TypBloku;
      overrideReason: string;
    }
  | {
      mode: "edit";
      assignmentId: string;
      userId: string;
      userName: string;
      currentFrom: string;
      currentTo: string;
      typBloku: TypBloku;
      poznamka: string;
      confirmationStatus: string;
      declinedReason: string;
      overrideReason: string;
    };

type ConflictInfo = {
  otherName: string;
  otherFrom?: string | null;
  otherTo?: string | null;
  otherTypBloku: TypBloku;
};

type AttendanceModalState = {
  row: AttendanceRow;
  userName: string;
};

type BlockConfig = {
  key: TypBloku;
  title: string;
  description: string;
};

const BLOCKS: BlockConfig[] = [
  {
    key: "sklad",
    title: "Nakládka",
    description: "Příprava, odjezd ze skladu a sraz na místě.",
  },
  {
    key: "stavba",
    title: "Stavba",
    description: "Technická stavba před akcí.",
  },
  {
    key: "akce",
    title: "Provoz akce",
    description: "Pokrytí práce během samotné akce.",
  },
  {
    key: "bourani",
    title: "Bourání",
    description: "Demontáž a návrat po akci.",
  },
];

function normalizeTypBloku(value?: string | null): TypBloku {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "sklad";
  if (raw === "stavba") return "stavba";
  if (raw === "bourani" || raw === "bourání") return "bourani";

  return "akce";
}

function getTypBlokuLabel(value?: string | null) {
  const typ = normalizeTypBloku(value);

  if (typ === "sklad") return "Nakládka";
  if (typ === "stavba") return "Stavba";
  if (typ === "bourani") return "Bourání";

  return "Provoz akce";
}

function normalizeConfirmationStatus(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "accepted") return "accepted";
  if (raw === "declined") return "declined";

  return "pending";
}

function getConfirmationStatusLabel(value?: string | null) {
  const status = normalizeConfirmationStatus(value);

  if (status === "accepted") return "Potvrzeno";
  if (status === "declined") return "Odmítnuto";

  return "Čeká";
}

function getConfirmationStatusVariant(value?: string | null) {
  const status = normalizeConfirmationStatus(value);

  if (status === "accepted") return "success";
  if (status === "declined") return "danger";

  return "warning";
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const parts = trimmed ? trimmed.split(/\s+/) : [];

  return {
    firstName: parts[0] || "Bez",
    lastName: parts.slice(1).join(" ") || "jména",
  };
}

function toInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function joinDateAndTime(date?: string | null, time?: string | null) {
  if (!date || !time) return "";
  return `${date.slice(0, 10)}T${time.slice(0, 5)}`;
}

function overlaps(
  aFrom?: string | null,
  aTo?: string | null,
  bFrom?: string | null,
  bTo?: string | null
) {
  if (!aFrom || !aTo || !bFrom || !bTo) return false;

  const aStart = new Date(aFrom);
  const aEnd = new Date(aTo);
  const bStart = new Date(bFrom);
  const bEnd = new Date(bTo);

  if (
    Number.isNaN(aStart.getTime()) ||
    Number.isNaN(aEnd.getTime()) ||
    Number.isNaN(bStart.getTime()) ||
    Number.isNaN(bEnd.getTime())
  ) {
    return false;
  }

  return aStart < bEnd && aEnd > bStart;
}

function hasInvalidRange(from?: string | null, to?: string | null) {
  if (!from || !to) return false;

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return true;

  return fromTime >= toTime;
}

function formatDateTimeShort(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAssignmentRange(from?: string | null, to?: string | null) {
  const fromText = formatDateTimeShort(from);
  const toText = formatDateTimeShort(to);

  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

function formatDuration(minutes?: number | null) {
  const safeMinutes = Number(minutes ?? 0);
  if (!Number.isFinite(safeMinutes) || safeMinutes === 0) return "0 h";
  const sign = safeMinutes < 0 ? "-" : "";
  const absolute = Math.abs(safeMinutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  if (hours <= 0) return `${sign}${rest} min`;
  if (rest === 0) return `${sign}${hours} h`;
  return `${sign}${hours} h ${rest} min`;
}

function gpsText(row: AttendanceRow) {
  const points: string[] = [];
  if (row.gps_checkin_lat != null && row.gps_checkin_lng != null) {
    points.push(`Start: ${Number(row.gps_checkin_lat).toFixed(5)}, ${Number(row.gps_checkin_lng).toFixed(5)}`);
  }
  if (row.gps_checkout_lat != null && row.gps_checkout_lng != null) {
    points.push(`Konec: ${Number(row.gps_checkout_lat).toFixed(5)}, ${Number(row.gps_checkout_lng).toFixed(5)}`);
  }
  return points.length > 0 ? points.join(" · ") : "GPS není uložená";
}

function getConflictText(conflict: ConflictInfo | null) {
  if (!conflict) return null;

  const range = formatAssignmentRange(conflict.otherFrom, conflict.otherTo);
  const block = getTypBlokuLabel(conflict.otherTypBloku);
  const name = conflict.otherName || "Jiná zakázka";

  return range === "Čas není zadaný"
    ? `${name} · ${block}`
    : `${name} · ${block} · ${range}`;
}

export default function PeoplePool({ zakazkaId }: { zakazkaId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [current, setCurrent] = useState<Zakazka | null>(null);
  const [other, setOther] = useState<OtherRow[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [attendanceModal, setAttendanceModal] = useState<AttendanceModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    void load();
  }, [zakazkaId]);

  async function parseJsonSafe(response: Response) {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function getErrorMessage(response: Response, fallback: string) {
    const payload = await parseJsonSafe(response);
    return typeof payload?.error === "string" && payload.error ? payload.error : fallback;
  }

  async function load() {
    try {
      const usersResponse = await fetch("/api/users");
      if (!usersResponse.ok) {
        throw new Error(await getErrorMessage(usersResponse, "Nepodařilo se načíst seznam lidí."));
      }

      const usersJson = await parseJsonSafe(usersResponse);

      const peopleResponse = await fetch(`/api/zakazka/${zakazkaId}/people`);
      if (!peopleResponse.ok) {
        throw new Error(
          await getErrorMessage(peopleResponse, "Nepodařilo se načíst přiřazení lidí.")
        );
      }

      const peopleJson = (await parseJsonSafe(peopleResponse)) as PeopleResponse;

      setUsers(Array.isArray(usersJson) ? usersJson : []);
      setAssignments(Array.isArray(peopleJson.assignments) ? peopleJson.assignments : []);
      setCurrent(peopleJson.currentZakazka || null);
      setOther(Array.isArray(peopleJson.other) ? peopleJson.other : []);
    } catch (error) {
      setUsers([]);
      setAssignments([]);
      setCurrent(null);
      setOther([]);
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Načtení lidí selhalo.",
      });
    }
  }

  function getRangeForBlok(typBloku: TypBloku) {
    if (!current) {
      return { from: "", to: "" };
    }

    if (typBloku === "sklad") {
      return {
        from: current.odjezd_ze_skladu ?? "",
        to: current.sraz_na_miste ?? "",
      };
    }

    if (typBloku === "stavba") {
      return {
        from: current.stavba_od ?? "",
        to: current.stavba_do ?? "",
      };
    }

    if (typBloku === "bourani") {
      return {
        from: current.bourani_od ?? "",
        to: current.bourani_do ?? "",
      };
    }

    return {
      from: current.akce_od ?? joinDateAndTime(current.datum_od, current.cas_od),
      to: current.akce_do ?? joinDateAndTime(current.datum_do, current.cas_do),
    };
  }

  function getUserName(userId: string) {
    return users.find((user) => user.user_id === userId)?.user_name || "Bez jména";
  }

  function getConflictForRange(
    userId: string,
    from?: string | null,
    to?: string | null
  ): ConflictInfo | null {
    for (const row of other.filter((item) => item.user_id === userId)) {
      if (overlaps(from, to, row.datum_od, row.datum_do)) {
        return {
          otherName: row.zakazky?.nazev || "Jiná zakázka",
          otherFrom: row.datum_od,
          otherTo: row.datum_do,
          otherTypBloku: normalizeTypBloku(row.typ_bloku),
        };
      }
    }

    return null;
  }

  function getConflictForAssignment(assignment: Assignment) {
    return getConflictForRange(assignment.user_id, assignment.datum_od, assignment.datum_do);
  }

  function openAdd(typBloku: TypBloku) {
    const range = getRangeForBlok(typBloku);

    setModal({
      mode: "add",
      userIds: [],
      currentFrom: toInput(range.from),
      currentTo: toInput(range.to),
      typBloku,
      overrideReason: "",
    });
  }

  function openEdit(assignment: Assignment) {
    setModal({
      mode: "edit",
      assignmentId: String(assignment.id),
      userId: assignment.user_id,
      userName: getUserName(assignment.user_id),
      currentFrom: toInput(assignment.datum_od),
      currentTo: toInput(assignment.datum_do),
      typBloku: normalizeTypBloku(assignment.typ_bloku),
      poznamka: assignment.poznamka ?? "",
      confirmationStatus: normalizeConfirmationStatus(assignment.confirmation_status),
      declinedReason: assignment.declined_reason ?? "",
      overrideReason: "",
    });
  }

  async function save() {
    if (!modal) return;
    if (saving) return;

    if (modal.mode === "add" && modal.userIds.length === 0) {
      setToast({ type: "error", message: "Vyber alespoň jednoho člověka pro přiřazení." });
      return;
    }

    if (hasInvalidRange(modal.currentFrom, modal.currentTo)) {
      setToast({ type: "error", message: "Začátek přiřazení musí být dřív než konec." });
      return;
    }

    const hasPeopleConflict =
      modal.mode === "add"
        ? modal.userIds.some((userId) =>
            Boolean(getConflictForRange(userId, modal.currentFrom, modal.currentTo))
          )
        : Boolean(getConflictForRange(modal.userId, modal.currentFrom, modal.currentTo));
    if (hasPeopleConflict && !modal.overrideReason.trim()) {
      setToast({
        type: "error",
        message: "U kolize lidí je povinné vyplnit důvod override.",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        datum_od: modal.currentFrom || null,
        datum_do: modal.currentTo || null,
      };

      if (modal.mode === "edit") {
        const nextStatus = normalizeConfirmationStatus(modal.confirmationStatus);
        const response = await fetch(`/api/zakazka/${zakazkaId}/people/${modal.assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            poznamka: modal.poznamka,
            confirmation_status: nextStatus,
            declined_reason: nextStatus === "declined" ? modal.declinedReason : null,
            people_conflict_override_reason: modal.overrideReason.trim() || null,
          }),
        });

        if (!response.ok) {
          throw new Error(await getErrorMessage(response, "Uložení přiřazení selhalo."));
        }

        setModal(null);
        await load();
        router.refresh();
        setToast({ type: "success", message: "Přiřazení bylo upraveno." });
        return;
      }

      const failures: string[] = [];
      let successCount = 0;

      for (const userId of modal.userIds) {
        if (assignedUserIdsByBlock[modal.typBloku].has(userId)) continue;

        const response = await fetch(`/api/zakazka/${zakazkaId}/people`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            user_id: userId,
            typ_bloku: modal.typBloku,
            people_conflict_override_reason: modal.overrideReason.trim() || null,
          }),
        });

        if (response.ok) {
          successCount += 1;
          continue;
        }

        const message = await getErrorMessage(response, "Nepodařilo se přidat člověka.");
        failures.push(`${getUserName(userId)}: ${message}`);
      }

      setModal(null);
      await load();
      router.refresh();

      if (failures.length > 0) {
        const prefix =
          successCount > 0
            ? `Přidáno ${successCount} lidí. Některé se nepodařilo přidat:`
            : "Nepodařilo se přidat vybrané lidi:";
        setToast({ type: "error", message: `${prefix} ${failures.join(" ")}` });
      } else if (successCount > 0) {
        setToast({ type: "success", message: `Přidáno ${successCount} lidí.` });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Uložení selhalo.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignmentById(assignmentId: string, userName: string, typBloku: TypBloku) {
    if (saving) return;
    const confirmed = window.confirm(
      `Odebrat přiřazení člověka ${userName} z fáze ${getTypBlokuLabel(typBloku)}?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/zakazka/${zakazkaId}/people/${assignmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Nepodařilo se odebrat přiřazení."));
      }

      setModal(null);
      await load();
      router.refresh();
      setToast({ type: "success", message: "Přiřazení bylo odebráno." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Odebrání selhalo.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment() {
    if (!modal || modal.mode !== "edit") return;
    await removeAssignmentById(modal.assignmentId, modal.userName, modal.typBloku);
  }

  async function saveAttendanceOverride(formData: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      await updateAttendanceManualAction(formData);
      setAttendanceModal(null);
      await load();
      router.refresh();
      setToast({ type: "success", message: "Docházka byla ručně opravena." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Docházku se nepodařilo upravit.",
      });
    } finally {
      setSaving(false);
    }
  }

  const isBezObsluhy = String(current?.typ_obsluhy ?? "").trim() === "bez_obsluhy";

  const assignmentsByBlock = useMemo(() => {
    const workAssignments = assignments.filter(
      (assignment) => !isPrepravaTypBloku(assignment.typ_bloku)
    );

    return {
      sklad: workAssignments.filter(
        (assignment) => normalizeTypBloku(assignment.typ_bloku) === "sklad"
      ),
      stavba: workAssignments.filter(
        (assignment) => normalizeTypBloku(assignment.typ_bloku) === "stavba"
      ),
      akce: workAssignments.filter(
        (assignment) => normalizeTypBloku(assignment.typ_bloku) === "akce"
      ),
      bourani: workAssignments.filter(
        (assignment) => normalizeTypBloku(assignment.typ_bloku) === "bourani"
      ),
    };
  }, [assignments]);

  const assignedUserIdsByBlock = useMemo(() => {
    return {
      sklad: new Set(assignmentsByBlock.sklad.map((assignment) => assignment.user_id)),
      stavba: new Set(assignmentsByBlock.stavba.map((assignment) => assignment.user_id)),
      akce: new Set(assignmentsByBlock.akce.map((assignment) => assignment.user_id)),
      bourani: new Set(assignmentsByBlock.bourani.map((assignment) => assignment.user_id)),
    };
  }, [assignmentsByBlock]);

  const selectedAddUserIds = modal?.mode === "add" ? modal.userIds : [];
  const modalAddConflicts =
    modal?.mode === "add"
      ? modal.userIds
          .map((userId) => ({
            userId,
            userName: getUserName(userId),
            conflict: getConflictForRange(userId, modal.currentFrom, modal.currentTo),
          }))
          .filter((item): item is { userId: string; userName: string; conflict: ConflictInfo } =>
            Boolean(item.conflict)
          )
      : [];
  const modalEditConflict =
    modal?.mode === "edit"
      ? getConflictForRange(modal.userId, modal.currentFrom, modal.currentTo)
      : null;
  const modalUserName = modal?.mode === "edit" ? modal.userName : "";
  const modalConflictText = getConflictText(modalEditConflict);

  function toggleModalUser(userId: string) {
    setModal((state) => {
      if (!state || state.mode !== "add") return state;
      if (assignedUserIdsByBlock[state.typBloku].has(userId)) return state;

      const isSelected = state.userIds.includes(userId);
      return {
        ...state,
        userIds: isSelected
          ? state.userIds.filter((currentUserId) => currentUserId !== userId)
          : [...state.userIds, userId],
      };
    });
  }

  return (
    <>
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">Pokrytí práce</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Neřešíme odborné role. Jde o to, kdo je v daném čase k dispozici pro práci na
              zakázce.
            </p>
          </div>
          <Badge variant="default">{assignments.length} přiřazení</Badge>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {BLOCKS.map((block) => {
          const assigned = assignmentsByBlock[block.key];
          const range = getRangeForBlok(block.key);
          const hideAdd = isBezObsluhy && block.key === "akce";

          return (
            <Card key={block.key} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{block.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {hideAdd
                      ? "U zakázky bez obsluhy se do fáze Provoz akce lidé nepřiřazují."
                      : block.description}
                  </div>
                </div>
                <Badge variant="default">{assigned.length} lidí</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Čas od</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {formatDateTimeShort(range.from) || "Není zadáno"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Čas do</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {formatDateTimeShort(range.to) || "Není zadáno"}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {assigned.length > 0 ? (
                  <div className="space-y-2">
                    {assigned.map((assignment) => {
                      const userName = getUserName(assignment.user_id);
                      const nameParts = splitName(userName);
                      const conflict = getConflictForAssignment(assignment);
                      const conflictText = getConflictText(conflict);
                      const confirmationStatus = normalizeConfirmationStatus(
                        assignment.confirmation_status
                      );

                      return (
                        <div
                          key={String(assignment.id)}
                          className={[
                            "w-full rounded-2xl border px-4 py-3 text-left",
                            conflict || assignment.has_conflict
                              ? "border-orange-500/40 bg-orange-500/10"
                              : "border-slate-800 bg-slate-950/70",
                          ].join(" ")}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-sm text-slate-300">{nameParts.firstName}</div>
                              <div className="text-base font-semibold text-white">
                                {nameParts.lastName}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Badge
                                variant={getConfirmationStatusVariant(
                                  assignment.confirmation_status
                                )}
                              >
                                {getConfirmationStatusLabel(assignment.confirmation_status)}
                              </Badge>
                              {conflict || assignment.has_conflict ? (
                                <Badge variant="warning">Kolize</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-slate-300">
                            {formatAssignmentRange(assignment.datum_od, assignment.datum_do)}
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                            <div className="grid gap-2 text-xs sm:grid-cols-3">
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Plán</div>
                                <div className="mt-1 font-bold text-slate-100">
                                  {formatDuration(assignment.attendance_planned_minutes)}
                                </div>
                              </div>
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Skutečně</div>
                                <div className="mt-1 font-bold text-emerald-100">
                                  {formatDuration(assignment.attendance_actual_minutes)}
                                </div>
                              </div>
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Rozdíl</div>
                                <div className="mt-1 font-bold text-blue-100">
                                  {formatDuration(
                                    (assignment.attendance_actual_minutes ?? 0) -
                                      (assignment.attendance_planned_minutes ?? 0)
                                  )}
                                </div>
                              </div>
                            </div>
                            {assignment.attendance_active ? (
                              <div className="mt-2 inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-100">
                                Právě pracuje
                              </div>
                            ) : null}
                            {assignment.attendance_rows?.length ? (
                              <div className="mt-3 space-y-2">
                                {assignment.attendance_rows.slice(0, 3).map((row) => (
                                  <div
                                    key={row.id}
                                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300"
                                  >
                                    <div className="font-semibold text-slate-100">
                                      {formatDateTimeShort(row.checkin_at)} →{" "}
                                      {row.checkout_at ? formatDateTimeShort(row.checkout_at) : "běží"}
                                    </div>
                                    <div className="mt-1">{gpsText(row)}</div>
                                    {row.manual_override ? (
                                      <div className="mt-1 text-amber-200">
                                        Ruční oprava: {row.override_reason || "bez důvodu"}
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => setAttendanceModal({ row, userName })}
                                      className="mt-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-100 transition hover:bg-slate-800"
                                    >
                                      Ručně opravit
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-500">Zatím bez reálné docházky.</div>
                            )}
                          </div>
                          {confirmationStatus === "declined" && assignment.declined_reason ? (
                            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                              Důvod odmítnutí: {assignment.declined_reason}
                            </div>
                          ) : null}
                          {conflictText ? (
                            <div className="mt-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100">
                              Kolize: {conflictText}
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(assignment)}
                              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-100 transition hover:bg-slate-800"
                            >
                              Upravit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void removeAssignmentById(
                                  String(assignment.id),
                                  userName,
                                  normalizeTypBloku(assignment.typ_bloku)
                                )
                              }
                              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-100 transition hover:bg-slate-800"
                            >
                              Odebrat
                            </button>
                            {confirmationStatus === "declined" ? (
                              <button
                                type="button"
                                onClick={() => openAdd(block.key)}
                                className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:bg-red-500/25"
                              >
                                Nahradit
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                    V této fázi zatím nikdo není přiřazený.
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                onClick={() => openAdd(block.key)}
                disabled={hideAdd}
                className="w-full justify-center"
              >
                Přidat člověka
              </Button>
            </Card>
          );
        })}
      </div>

      <Modal
        open={Boolean(attendanceModal)}
        onClose={() => setAttendanceModal(null)}
        title="Ruční oprava docházky"
        widthClassName="max-w-lg"
      >
        {attendanceModal ? (
          <form action={(formData) => void saveAttendanceOverride(formData)} className="space-y-4">
            <input type="hidden" name="attendance_id" value={attendanceModal.row.id} />
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Člověk</div>
              <div className="mt-1 text-base font-bold text-white">{attendanceModal.userName}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Začátek práce">
                <Input
                  type="datetime-local"
                  name="checkin_at"
                  defaultValue={toInput(attendanceModal.row.checkin_at)}
                  required
                />
              </Field>
              <Field label="Konec práce">
                <Input
                  type="datetime-local"
                  name="checkout_at"
                  defaultValue={toInput(attendanceModal.row.checkout_at)}
                />
              </Field>
            </div>
            <Field label="Důvod ruční opravy">
              <Textarea
                name="override_reason"
                rows={4}
                required
                placeholder="Např. zaměstnanec zapomněl ukončit práci, špatný signál, oprava podle šéfa na místě..."
              />
            </Field>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              {gpsText(attendanceModal.row)}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Ukládám..." : "Uložit opravu"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAttendanceModal(null)} disabled={saving}>
                Zavřít
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal
            ? modal.mode === "add"
              ? `Přidat lidi · ${getTypBlokuLabel(modal.typBloku)}`
              : `Upravit přiřazení · ${modalUserName}`
            : undefined
        }
        widthClassName="max-w-xl"
      >
        {modal ? (
          <div className="space-y-5">
            {modal.mode === "add" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Vyber lidi pro fázi</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Vybráno {selectedAddUserIds.length} lidí
                    </div>
                  </div>
                  <Badge variant="default">{getTypBlokuLabel(modal.typBloku)}</Badge>
                </div>

                <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const alreadyAssigned = assignedUserIdsByBlock[modal.typBloku].has(user.user_id);
                    const checked = modal.userIds.includes(user.user_id);
                    const conflict = getConflictForRange(
                      user.user_id,
                      modal.currentFrom,
                      modal.currentTo
                    );

                    return (
                      <label
                        key={user.user_id}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
                          alreadyAssigned
                            ? "cursor-not-allowed border-slate-800 bg-slate-900/50 opacity-60"
                            : checked
                              ? "border-blue-500/50 bg-blue-500/15"
                              : conflict
                                ? "border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
                                : "border-slate-800 bg-slate-950/70 hover:bg-slate-900",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyAssigned}
                          onChange={() => toggleModalUser(user.user_id)}
                          className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-950 accent-blue-500"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-white">{user.user_name}</div>
                            {alreadyAssigned ? (
                              <Badge variant="default">už přiřazen</Badge>
                            ) : null}
                            {!alreadyAssigned && conflict ? (
                              <Badge variant="warning">Kolize</Badge>
                            ) : null}
                          </div>

                          {!alreadyAssigned && conflict ? (
                            <div className="mt-2 text-xs font-semibold text-orange-100">
                              {getConflictText(conflict)}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Člověk</div>
                <div className="mt-1 text-base font-semibold text-white">{modal.userName}</div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Od">
                <Input
                  type="datetime-local"
                  value={modal.currentFrom}
                  onChange={(event) =>
                    setModal((state) =>
                      state ? { ...state, currentFrom: event.target.value } : state
                    )
                  }
                />
              </Field>

              <Field label="Do">
                <Input
                  type="datetime-local"
                  value={modal.currentTo}
                  onChange={(event) =>
                    setModal((state) =>
                      state ? { ...state, currentTo: event.target.value } : state
                    )
                  }
                />
              </Field>
            </div>

            {modal.mode === "edit" ? (
              <div className="space-y-4">
                <Field label="Poznámka">
                  <Textarea
                    value={modal.poznamka}
                    onChange={(event) =>
                      setModal((state) =>
                        state && state.mode === "edit"
                          ? { ...state, poznamka: event.target.value }
                          : state
                      )
                    }
                    rows={3}
                    placeholder="Interní poznámka k tomuto přiřazení"
                  />
                </Field>

                <Field label="Stav potvrzení">
                  <select
                    value={modal.confirmationStatus}
                    onChange={(event) =>
                      setModal((state) =>
                        state && state.mode === "edit"
                          ? {
                              ...state,
                              confirmationStatus: event.target.value,
                              declinedReason:
                                event.target.value === "declined" ? state.declinedReason : "",
                            }
                          : state
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="pending">Čeká</option>
                    <option value="accepted">Potvrzeno</option>
                    <option value="declined">Odmítnuto</option>
                  </select>
                </Field>

                {modal.confirmationStatus === "declined" ? (
                  <Field label="Důvod odmítnutí">
                    <Textarea
                      value={modal.declinedReason}
                      onChange={(event) =>
                        setModal((state) =>
                          state && state.mode === "edit"
                            ? { ...state, declinedReason: event.target.value }
                            : state
                        )
                      }
                      rows={3}
                      placeholder="Důvod odmítnutí"
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {modal.mode === "add" && modalAddConflicts.length > 0 ? (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Kolize</Badge>
                  <div className="text-sm font-semibold text-orange-100">
                    Někteří vybraní lidé mají ve stejném čase jiné přiřazení.
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-orange-200/90">
                  {modalAddConflicts.map((item) => (
                    <div key={item.userId}>
                      {item.userName}: {getConflictText(item.conflict)}
                    </div>
                  ))}
                </div>
                <Field label="Důvod override kolize">
                  <Textarea
                    value={modal.overrideReason}
                    onChange={(event) =>
                      setModal((state) =>
                        state && state.mode === "add"
                          ? { ...state, overrideReason: event.target.value }
                          : state
                      )
                    }
                    rows={3}
                    placeholder="Proč je kolize v tomto případě provozně v pořádku?"
                  />
                </Field>
              </div>
            ) : null}

            {modal.mode === "edit" && modalConflictText ? (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Kolize</Badge>
                  <div className="text-sm font-semibold text-orange-100">
                    Tento člověk má ve stejném čase jiné přiřazení.
                  </div>
                </div>
                <div className="mt-2 text-sm text-orange-200/90">{modalConflictText}</div>
                <Field label="Důvod override kolize">
                  <Textarea
                    value={modal.overrideReason}
                    onChange={(event) =>
                      setModal((state) =>
                        state && state.mode === "edit"
                          ? { ...state, overrideReason: event.target.value }
                          : state
                      )
                    }
                    rows={3}
                    placeholder="Proč je kolize v tomto případě provozně v pořádku?"
                  />
                </Field>
              </div>
            ) : null}

            {hasInvalidRange(modal.currentFrom, modal.currentTo) ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                Začátek přiřazení musí být dřív než konec.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                onClick={() => void save()}
                disabled={saving || (modal.mode === "add" && modal.userIds.length === 0)}
              >
                {saving
                  ? "Ukládám..."
                  : modal.mode === "add"
                    ? "Přidat vybrané"
                    : "Uložit"}
              </Button>

              {modal.mode === "edit" ? (
                <Button
                  variant="secondary"
                  onClick={() => void removeAssignment()}
                  disabled={saving}
                >
                  Odebrat
                </Button>
              ) : null}

              <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
                Zavřít
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
