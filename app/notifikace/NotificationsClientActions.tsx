"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { dispatchNotificationsUnreadChanged } from "@/lib/notifications/unread-count-sync";
import {
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

const actionButtonClass =
  "rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={actionButtonClass}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsReadAction();
          dispatchNotificationsUnreadChanged();
          router.refresh();
        })
      }
    >
      {pending ? "Ukládám…" : "Označit vše přečtené"}
    </button>
  );
}

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={actionButtonClass}
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("id", notificationId);
          await markNotificationReadAction(formData);
          dispatchNotificationsUnreadChanged();
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Přečteno"}
    </button>
  );
}

export function DismissNotificationButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={actionButtonClass}
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("id", notificationId);
          await dismissNotificationAction(formData);
          dispatchNotificationsUnreadChanged();
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Skrýt"}
    </button>
  );
}
