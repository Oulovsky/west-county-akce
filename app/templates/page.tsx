import { redirect } from "next/navigation";

/** Legacy /templates — tabulky na produkci neexistují; aktivní systém je /sklad/setupy. */
export default function TemplatesPage() {
  redirect("/sklad/setupy");
}
