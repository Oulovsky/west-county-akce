import { redirect } from "next/navigation";

/** Sklad dashboard — pouze přesměrování; hlavní obrazovka je /sklad/sprava */
export default function SkladRedirectPage() {
  redirect("/sklad/sprava");
}
