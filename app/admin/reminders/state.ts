export type ReminderEngineResult = {
  notifications: {
    created: number;
    skipped: number;
    failed: number;
  };
  tomorrowEvents: number;
  departureSoon: number;
  openAttendance: number;
  unpaidWork: number;
  pendingApprovals: number;
  clientApprovals: number;
  longRepairs: number;
  overdueInvoices: number;
};

export type ReminderEngineActionState = {
  ok: boolean;
  error: string | null;
  result: ReminderEngineResult | null;
  runId: number | null;
};

export const initialReminderEngineActionState: ReminderEngineActionState = {
  ok: false,
  error: null,
  result: null,
  runId: null,
};
