export type PaymentAccount = {
  label: string;
  qrAccount: string;
};

export type BankProfile = {
  bank_account_number?: string | null;
  bank_code?: string | null;
  iban?: string | null;
};

export function getPaymentAccount(profile?: BankProfile | null): PaymentAccount | null {
  const iban = profile?.iban?.trim();
  if (iban) {
    return { label: iban, qrAccount: iban.replace(/\s+/g, "").toUpperCase() };
  }

  const account = profile?.bank_account_number?.trim();
  const bank = profile?.bank_code?.trim();
  if (!account || !bank) return null;

  return { label: `${account}/${bank}`, qrAccount: `${account}/${bank}` };
}

export function hasPaymentAccount(profile?: BankProfile | null) {
  return getPaymentAccount(profile) !== null;
}

export function getMissingBankAccountMessage(profile?: BankProfile | null) {
  if (!profile) return "Profil zaměstnance nebyl nalezen.";
  if (profile.iban?.trim()) return null;
  if (profile.bank_account_number?.trim() && !profile.bank_code?.trim()) {
    return "Chybí kód banky u čísla účtu.";
  }
  if (!profile.bank_account_number?.trim() && !profile.iban?.trim()) {
    return "Není vyplněn bankovní účet ani IBAN.";
  }
  return "Není vyplněn bankovní účet.";
}
