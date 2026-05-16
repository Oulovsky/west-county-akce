"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

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
  id?: string;
  zakazka_id?: string;
  nazev?: string | null;
};

type OtherRow = {
  id?: string | number;
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
      mode: "edit";
      assignmentId: string;
      userId: string;
      userName: string;
      currentFrom: string;
      currentTo: string;
      typBloku: TypBloku;
    }
  | {
      mode: "conflict";
      assignmentId: string | null;
      userId: string;
      userName: string;
      currentFrom: string;
      currentTo: string;
      typBloku: TypBloku;
      otherAssignmentId: string | null;
      otherZakazkaNazev: string;
      otherFrom: string;
      otherTo: string;
      otherTypBloku: TypBloku;
    };

type PersonChipProps = {
  firstName: string;
  lastName: string;
  tone: "assigned" | "available" | "conflict";
  onClick: () => void;
  badge?: string;
  warningMark?: boolean;
  secondaryBadge?: string;
  details?: string[];
  conflictDetail?: string | null;
};

type BlockConfig = {
  key: TypBloku;
  title: string;
  description: string;
};

const BLOCKS: BlockConfig[] = [
  {
    key: "sklad",
    title: "Sklad / logistika",
    description: "Odjezd ze skladu až sraz na místě.",
  },
  {
    key: "stavba",
    title: "Stavba",
    description: "Blok stavby před akcí.",
  },
  {
    key: "akce",
    title: "Akce",
    description: "Hlavní průběh akce.",
  },
  {
    key: "bourani",
    title: "Bourání",
    description: "Samostatný blok bourání.",
  },
];

function PersonChip({
  firstName,
  lastName,
  tone,
  onClick,
  badge,
  warningMark = false,
  secondaryBadge,
  details = [],
  conflictDetail = null,
}: PersonChipProps) {
  const toneClassName =
    tone === "conflict"
      ? "border-orange-500/40 bg-orange-500/15 hover:bg-orange-500/20"
      : tone === "assigned"
        ? "border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/20"
        : "border-slate-700 bg-slate-900/70 hover:bg-slate-800/80";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-w-[160px] rounded-2xl border px-4 py-3 text-left transition ${toneClassName}`}
    >
      <div className="text-sm text-slate-300">{firstName}</div>
      <div className="text-base font-semibold text-white">{lastName || "\u00A0"}</div>

      {badge || secondaryBadge ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {badge ? (
            <Badge variant={tone === "conflict" ? "warning" : "default"}>{badge}</Badge>
          ) : null}

          {secondaryBadge ? <Badge variant="default">{secondaryBadge}</Badge> : null}
        </div>
      ) : null}

      {details.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs font-medium text-slate-300">
          {details.map((detail) => (
            <div key={detail}>{detail}</div>
          ))}
        </div>
      ) : null}

      {conflictDetail ? (
        <div className="mt-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100">
          {conflictDetail}
        </div>
      ) : null}

      {warningMark ? (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-200 text-xs font-bold text-orange-900 shadow">
          !
        </div>
      ) : null}
    </button>
  );
}

function normalizeTypBloku(value?: string | null): TypBloku {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sklad") return "sklad";
  if (raw === "stavba") return "stavba";
  if (raw === "bourani") return "bourani";

  return "akce";
}

function getTypBlokuLabel(value?: string | null) {
  const typ = normalizeTypBloku(value);

  if (typ === "sklad") return "Sklad";
  if (typ === "stavba") return "Stavba";
  if (typ === "bourani") return "Bourání";

  return "Akce";
}

export default function PeoplePool({ zakazkaId }: { zakazkaId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [current, setCurrent] = useState<Zakazka | null>(null);
  const [other, setOther] = useState<OtherRow[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [zakazkaId]);

  async function parseJsonSafe(response: Response) {
    const text = await response.text();

    if (!text) {
      return {};
    }

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
      window.alert(error instanceof Error ? error.message : "Načtení lidí selhalo.");
    }
  }

  function toInput(v?: string | null) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  }

  function join(d?: string | null, t?: string | null) {
    if (!d || !t) return "";
    return `${d.slice(0, 10)}T${t.slice(0, 5)}`;
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

    return aStart < bEnd && aEnd > bStart;
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
      from: current.akce_od ?? join(current.datum_od, current.cas_od),
      to: current.akce_do ?? join(current.datum_do, current.cas_do),
    };
  }

  function getCurrentZakazkaLabel(typBloku?: string | null) {
    return `${current?.nazev || "Aktuální zakázka"} – ${getTypBlokuLabel(typBloku)}`;
  }

  function getConflictForRange(userId: string, from?: string | null, to?: string | null) {
    for (const r of other.filter((x) => x.user_id === userId)) {
      if (overlaps(from, to, r.datum_od, r.datum_do)) {
        return {
          otherAssignmentId: r.id != null ? String(r.id) : null,
          otherName: r.zakazky?.nazev || "Jiná zakázka",
          from: toInput(r.datum_od),
          to: toInput(r.datum_do),
          otherTypBloku: normalizeTypBloku(r.typ_bloku),
        };
      }
    }

    return null;
  }

  function getConflictForAssignment(a: Assignment) {
    return getConflictForRange(a.user_id, a.datum_od, a.datum_do);
  }

  function formatDateTimeShort(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString("cs-CZ", {
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

  function formatConflictDetail(conflict: ReturnType<typeof getConflictForRange>) {
    if (!conflict) return null;

    const name = conflict.otherName?.trim();
    const range = formatAssignmentRange(conflict.from, conflict.to);
    const hasRange = range !== "Čas není zadaný";

    if (name && name !== "Jiná zakázka") {
      return hasRange ? `Kolize: ${name} · ${range}` : `Kolize: ${name}`;
    }

    return hasRange
      ? `Kolize s jinou zakázkou · ${range}`
      : "Kolize s jinou zakázkou";
  }

  function getConflictForPoolUser(userId: string, typBloku: TypBloku) {
    if (!current) return null;

    const range = getRangeForBlok(typBloku);

    return getConflictForRange(userId, range.from, range.to);
  }

  async function assign(userId: string, typBloku: TypBloku) {
    const conflict = getConflictForPoolUser(userId, typBloku);
    const user = users.find((x) => x.user_id === userId);
    const range = getRangeForBlok(typBloku);

    if (conflict && user) {
      setModal({
        mode: "conflict",
        assignmentId: null,
        userId,
        userName: user.user_name,
        currentFrom: toInput(range.from),
        currentTo: toInput(range.to),
        typBloku,
        otherAssignmentId: conflict.otherAssignmentId,
        otherZakazkaNazev: conflict.otherName,
        otherFrom: conflict.from,
        otherTo: conflict.to,
        otherTypBloku: conflict.otherTypBloku,
      });
      return;
    }

    const response = await fetch(`/api/zakazka/${zakazkaId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, typ_bloku: typBloku }),
    });

    if (!response.ok) {
      window.alert(await getErrorMessage(response, "Nepodařilo se přiřadit člověka."));
      return;
    }

    await load();
  }

  function openEdit(a: Assignment) {
    const u = users.find((x) => x.user_id === a.user_id);
    if (!u) return;

    const conflict = getConflictForAssignment(a);
    const typBloku = normalizeTypBloku(a.typ_bloku);

    if (conflict) {
      setModal({
        mode: "conflict",
        assignmentId: String(a.id),
        userId: a.user_id,
        userName: u.user_name,
        currentFrom: toInput(a.datum_od),
        currentTo: toInput(a.datum_do),
        typBloku,
        otherAssignmentId: conflict.otherAssignmentId,
        otherZakazkaNazev: conflict.otherName,
        otherFrom: conflict.from,
        otherTo: conflict.to,
        otherTypBloku: conflict.otherTypBloku,
      });
      return;
    }

    setModal({
      mode: "edit",
      assignmentId: String(a.id),
      userId: a.user_id,
      userName: u.user_name,
      currentFrom: toInput(a.datum_od),
      currentTo: toInput(a.datum_do),
      typBloku,
    });
  }

  async function save() {
    if (!modal) return;

    setSaving(true);

    try {
      if (modal.assignmentId) {
        const currentResponse = await fetch(
          `/api/zakazka/${zakazkaId}/people/${modal.assignmentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              datum_od: modal.currentFrom || null,
              datum_do: modal.currentTo || null,
            }),
          }
        );

        if (!currentResponse.ok) {
          throw new Error(await getErrorMessage(currentResponse, "Nepodařilo se uložit změny."));
        }
      } else {
        const assignResponse = await fetch(`/api/zakazka/${zakazkaId}/people`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: modal.userId,
            typ_bloku: modal.typBloku,
          }),
        });

        if (!assignResponse.ok) {
          throw new Error(
            await getErrorMessage(assignResponse, "Nepodařilo se přiřadit člověka.")
          );
        }
      }

      if (modal.mode === "conflict" && modal.otherAssignmentId) {
        const otherResponse = await fetch(
          `/api/zakazka/${zakazkaId}/people/${modal.otherAssignmentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              datum_od: modal.otherFrom || null,
              datum_do: modal.otherTo || null,
            }),
          }
        );

        if (!otherResponse.ok) {
          throw new Error(
            await getErrorMessage(otherResponse, "Nepodařilo se uložit kolizní zakázku.")
          );
        }
      }

      setModal(null);
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Uložení selhalo.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment() {
    if (!modal || !modal.assignmentId) return;

    setSaving(true);

    try {
      const response = await fetch(
        `/api/zakazka/${zakazkaId}/people/${modal.assignmentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Nepodařilo se odebrat přiřazení."));
      }

      setModal(null);
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Odebrání selhalo.");
    } finally {
      setSaving(false);
    }
  }

  const isBezObsluhy = String(current?.typ_obsluhy ?? "").trim() === "bez_obsluhy";

  const assignmentsByBlock = useMemo(() => {
    return {
      sklad: assignments.filter((a) => normalizeTypBloku(a.typ_bloku) === "sklad"),
      stavba: assignments.filter((a) => normalizeTypBloku(a.typ_bloku) === "stavba"),
      akce: assignments.filter((a) => normalizeTypBloku(a.typ_bloku) === "akce"),
      bourani: assignments.filter((a) => normalizeTypBloku(a.typ_bloku) === "bourani"),
    };
  }, [assignments]);

  const assignedUserIdsByBlock = useMemo(() => {
    return {
      sklad: new Set(assignmentsByBlock.sklad.map((a) => a.user_id)),
      stavba: new Set(assignmentsByBlock.stavba.map((a) => a.user_id)),
      akce: new Set(assignmentsByBlock.akce.map((a) => a.user_id)),
      bourani: new Set(assignmentsByBlock.bourani.map((a) => a.user_id)),
    };
  }, [assignmentsByBlock]);

  function getPoolForBlock(typBloku: TypBloku) {
    if (isBezObsluhy && typBloku === "akce") {
      return [];
    }

    return users.filter((u) => !assignedUserIdsByBlock[typBloku].has(u.user_id));
  }

  function name(n: string) {
    const p = n.split(" ");
    return { f: p[0] || "", l: p.slice(1).join(" ") };
  }

  return (
    <>
      <div className="space-y-6">
        {BLOCKS.map((block) => {
          const assigned = assignmentsByBlock[block.key];
          const pool = getPoolForBlock(block.key);
          const hidePool = isBezObsluhy && block.key === "akce";

          return (
            <Card key={block.key} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{block.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {hidePool
                      ? "Hlavní průběh akce. U zakázky bez obsluhy se do tohoto bloku lidé nepřiřazují."
                      : block.description}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{assigned.length} přiřazených</Badge>
                  {!hidePool ? <Badge variant="default">{pool.length} k dispozici</Badge> : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-300">Přiřazení lidé</div>

                {assigned.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {assigned.map((a) => {
                      const u = users.find((x) => x.user_id === a.user_id);
                      if (!u) return null;

                      const n = name(u.user_name);
                      const conflict = getConflictForAssignment(a);
                      const hasConflict = Boolean(a.has_conflict || conflict);
                      const blockLabel = getTypBlokuLabel(a.typ_bloku);

                      return (
                        <PersonChip
                          key={String(a.id)}
                          firstName={n.f}
                          lastName={n.l}
                          tone={hasConflict ? "conflict" : "assigned"}
                          onClick={() => openEdit(a)}
                          badge={hasConflict ? "Kolize" : "Přiřazeno"}
                          secondaryBadge={blockLabel}
                          details={[
                            `Blok: ${blockLabel}`,
                            `Čas: ${formatAssignmentRange(a.datum_od, a.datum_do)}`,
                          ]}
                          conflictDetail={formatConflictDetail(conflict)}
                          warningMark={hasConflict}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                    V tomto bloku zatím nikdo není přiřazený.
                  </div>
                )}
              </div>

              {!hidePool ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-300">Dostupní lidé pro blok</div>

                  {pool.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {pool.map((u) => {
                        const n = name(u.user_name);
                        const conflict = getConflictForPoolUser(u.user_id, block.key);

                        return (
                          <PersonChip
                            key={`${block.key}-${u.user_id}`}
                            firstName={n.f}
                            lastName={n.l}
                            tone={conflict ? "conflict" : "available"}
                            onClick={() => void assign(u.user_id, block.key)}
                            badge={conflict ? "Kolize" : "Dostupný"}
                            secondaryBadge={getTypBlokuLabel(block.key)}
                            warningMark={Boolean(conflict)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                      Pro tento blok už nikdo další k dispozici není.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                  U zakázky bez obsluhy je blok Akce jen informativní. Lidé se přiřazují pouze do Stavby a Bourání.
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.userName}
        widthClassName="max-w-2xl"
      >
        {modal ? (
          <div className="space-y-6">
            {modal.mode === "conflict" ? (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Kolize</Badge>
                  <div className="text-sm font-medium text-orange-100">
                    Tento člověk je ve stejném čase na jiné zakázce.
                  </div>
                </div>
                <div className="mt-2 text-sm text-orange-200/90">
                  Uprav časy tak, aby se zakázky nepřekrývaly.
                </div>
              </div>
            ) : null}

            {modal.mode === "conflict" ? (
              <Card className="space-y-4 border-orange-500/20">
                <div>
                  <div className="text-base font-semibold text-white">
                    {modal.otherZakazkaNazev || "Jiná zakázka"} – {getTypBlokuLabel(modal.otherTypBloku)}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">Kolizní zakázka</div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Od">
                    <Input
                      type="datetime-local"
                      value={modal.otherFrom}
                      onChange={(e) =>
                        setModal((m) =>
                          m && m.mode === "conflict"
                            ? { ...m, otherFrom: e.target.value }
                            : m
                        )
                      }
                    />
                  </Field>

                  <Field label="Do">
                    <Input
                      type="datetime-local"
                      value={modal.otherTo}
                      onChange={(e) =>
                        setModal((m) =>
                          m && m.mode === "conflict"
                            ? { ...m, otherTo: e.target.value }
                            : m
                        )
                      }
                    />
                  </Field>
                </div>
              </Card>
            ) : null}

            <Card className="space-y-4">
              <div>
                <div className="text-base font-semibold text-white">
                  {getCurrentZakazkaLabel(modal.typBloku)}
                </div>
                <div className="mt-1 text-sm text-slate-400">Upravované přiřazení</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Od">
                  <Input
                    type="datetime-local"
                    value={modal.currentFrom}
                    onChange={(e) =>
                      setModal((m) => (m ? { ...m, currentFrom: e.target.value } : m))
                    }
                  />
                </Field>

                <Field label="Do">
                  <Input
                    type="datetime-local"
                    value={modal.currentTo}
                    onChange={(e) =>
                      setModal((m) => (m ? { ...m, currentTo: e.target.value } : m))
                    }
                  />
                </Field>
              </div>
            </Card>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Ukládám..." : "Uložit"}
              </Button>

              {modal.assignmentId ? (
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