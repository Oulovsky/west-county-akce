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

export const TYP_AKCE_LABELS: Record<string, string> = {
  koncert: "Koncert",
  festival: "Festival",
  firemni_akce: "Firemní akce",
  svatba: "Svatba",
  galavecer: "Galavečer",
  sport: "Sportovní akce",
  konference: "Konference",
  jine: "Jiné",
};

export const POPTAVKA_STAV_LABELS: Record<PoptavkaStav, string> = {
  koncept: "Koncept",
  odeslana: "Odeslána — čeká na reakci",
  /** @deprecated V DB se nezapisuje; label jen pro kompatibilitu typů. */
  ceka_na_schvaleni: "Odeslána",
  v_revizi: "Zajímá — k doplnění",
  schvalena: "Schváleno k převodu",
  zamitnuta: "Zamítnutá",
  prevadena_do_zakazky: "Převedena do zakázky",
  objednavka_odeslana: "Objednávka odeslána — čeká na klienta",
  objednavka_potvrzena: "Objednávka potvrzena klientem",
  objednavka_odmitnuta: "Objednávka odmítnuta klientem",
};

/** Texty stavů zobrazené klientovi v portálu. */
export const CLIENT_POPTAVKA_STAV_LABELS: Record<PoptavkaStav, string> = {
  koncept: "Rozpracováno",
  odeslana: "Čeká na kontrolu",
  /** @deprecated V DB se nezapisuje; label jen pro kompatibilitu typů. */
  ceka_na_schvaleni: "Čeká na kontrolu",
  v_revizi: "Vráceno k doplnění",
  schvalena: "Schváleno, připravujeme zakázku",
  zamitnuta: "Zamítnuto",
  prevadena_do_zakazky: "Převedeno na zakázku",
  objednavka_odeslana: "Závazná objednávka k potvrzení",
  objednavka_potvrzena: "Objednávka potvrzena",
  objednavka_odmitnuta: "Objednávka odmítnuta",
};
