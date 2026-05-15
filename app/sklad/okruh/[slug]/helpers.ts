import { SKLAD_EMPTY_LABEL_EM } from "@/lib/sklad/constants";
import {
  badgeStyle,
  formatDateTime as formatDateTimeBase,
  toNumber,
} from "@/lib/sklad/helpers";

export { badgeStyle, toNumber };

/** Formát data s em dash — stejné chování jako dříve v okruhu. */
export function formatDateTime(value: string | null | undefined): string {
  return formatDateTimeBase(value, SKLAD_EMPTY_LABEL_EM);
}
