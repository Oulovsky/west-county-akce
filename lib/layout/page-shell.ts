/** Sdílené třídy pro šířku stránky — padding řeší AppShell, obsah je vždy plná šířka. */
export const PAGE_SHELL_CLASS = "w-full min-w-0";

export const PAGE_STACK_CLASS = `${PAGE_SHELL_CLASS} space-y-5`;

export const PAGE_STACK_SM_CLASS = `${PAGE_SHELL_CLASS} space-y-4`;

/** Veřejné stránky bez AppShell (login, dotazník, …). */
export const PAGE_STANDALONE_CLASS = `${PAGE_SHELL_CLASS} px-2 py-6 sm:px-3 lg:px-4`;
