export const NOTIFICATIONS_UNREAD_CHANGED_EVENT = "wc:notifications-unread-changed";

export function dispatchNotificationsUnreadChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UNREAD_CHANGED_EVENT));
}

export function subscribeNotificationsUnreadChanged(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handler = () => onChange();
  window.addEventListener(NOTIFICATIONS_UNREAD_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_UNREAD_CHANGED_EVENT, handler);
}
