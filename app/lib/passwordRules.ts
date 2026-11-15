/* The rules for a new password. One list, used by the screens (to show live ticks as you type) and by the server (which
   enforces them), so what you see is exactly what is checked. Signing in is not affected: older passwords keep working. */
export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "An uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "A lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "A number (0-9)", test: (p: string) => /\d/.test(p) },
  { id: "sym", label: "A special character (! @ # $ %)", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export const PASSWORD_MAX = 72; // the most Supabase accepts

/** "" when the password is acceptable, otherwise the sentence to show. `email` stops "my email address" being used as the password. */
export function passwordIssue(password: string, email?: string): string {
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (PASSWORD_RULES.some((r) => !r.test(password))) return "Your password must have at least 8 characters, an uppercase and a lowercase letter, a number and a special character.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "The password can't be your email address.";
  return "";
}

export const passwordOk = (password: string, email?: string) => passwordIssue(password, email) === "";
