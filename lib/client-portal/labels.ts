import type { PoptavkaStav, SetupOblast } from "@/lib/client-portal/types";

export const SETUP_OBLAST_LABELS: Record<SetupOblast, string> = {
  stage: "Stage",
  sound: "Sound",
  lights: "Lights",
  led_wall: "LED wall",
  video: "Video",
  dron: "Dron",
  other: "Ostatní",
};

export const POPTAVKA_STAV_LABELS: Record<PoptavkaStav, string> = {
  koncept: "Koncept",
  odeslana: "Odeslána",
  ceka_na_schvaleni: "Čeká na schválení",
  v_revizi: "K doplnění",
  schvalena: "Schválená",
  zamitnuta: "Zamítnutá",
  prevadena_do_zakazky: "Převedena do zakázky",
};
