export function combineDateAndTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue || !timeValue) return null;
  return `${dateValue}T${timeValue}:00`;
}
