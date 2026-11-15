import { reportError } from "./_report";
/* Sends email through Brevo's transactional API.
   Env: BREVO_API_KEY (an API key from Brevo, "SMTP & API"), BREVO_SENDER_EMAIL (a sender you verified in Brevo) and
   optionally BREVO_SENDER_NAME (defaults to "QCU Robotics"). Without the first two, sending is reported as unavailable. */
const KEY = process.env.BREVO_API_KEY || "";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "QCU Robotics";

// Brevo has two kinds of key. The API sends with an "xkeysib-" API key; "xsmtpsib-" is an SMTP key and Brevo answers "Key not found" if it is used here.
const SMTP_KEY_BY_MISTAKE = KEY.startsWith("xsmtpsib-");
export const mailConfigured = () => !!(KEY && SENDER_EMAIL) && !SMTP_KEY_BY_MISTAKE;

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!mailConfigured()) {
    console.error(SMTP_KEY_BY_MISTAKE
      ? "BREVO_API_KEY is an SMTP key (starts with xsmtpsib-). Create an API key in Brevo (SMTP & API, API Keys tab; it starts with xkeysib-) and use that instead."
      : "Email isn't set up: BREVO_API_KEY or BREVO_SENDER_EMAIL is missing");
    return false;
  }
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: SENDER_EMAIL, name: SENDER_NAME }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) { const why = (await r.text().catch(() => "")).slice(0, 300); console.error("Brevo refused the email:", r.status, why); reportError("email", `Brevo refused the email (${r.status}): ${why}`); return false; }
    return true;
  } catch (e) {
    console.error("Sending email failed:", (e as Error).message);
    reportError("email", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.qcurobotics.website";
const FONT = "'Space Grotesk','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono','Consolas','Roboto Mono','Courier New',monospace";

/* The same palette as the admin sign-in screen: deep navy, slate surfaces, green accent. */
const C = { bg: "#020617", surface: "#0f172a", elevated: "#1e293b", border: "#334155", line: "#1e293b", text: "#f8fafc", body: "#cbd5e1", muted: "#94a3b8", faint: "#64748b", green: "#22c55e", greenText: "#4ade80" };

/* Mail apps that support CSS animation (Apple Mail, iPhone Mail) play a soft rise-in; Gmail and Outlook ignore it and show the
   finished email, so nothing depends on it. */
const MOTION = `<style>
@keyframes qcu-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes qcu-pop{0%{opacity:0;transform:scale(.8)}70%{transform:scale(1.06)}100%{opacity:1;transform:none}}
.qcu-in{animation:qcu-rise .6s cubic-bezier(.22,1,.36,1) both}
.qcu-d{display:inline-block;animation:qcu-pop .5s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion:reduce){.qcu-in,.qcu-d{animation:none}}
</style>`;

/** The page every email shares: brand line, the content, one small footer line. Plain tables and inline styles so it renders alike in Gmail, Outlook and phones. */
function frame(o: { preheader: string; heading: string; body: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(o.heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">${MOTION}</head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg}"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.line};border-radius:20px;padding:28px 28px 24px">
      <!-- brand -->
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px"><img src="${SITE}/logo-96.png" width="34" height="34" alt="" style="display:block;border:0;outline:none;text-decoration:none"></td>
        <td style="font:700 15px/1 ${FONT};color:${C.text}">QCU Robotics</td>
      </tr></table>
      <div class="qcu-in">
        <h1 style="margin:24px 0 0;font:700 24px/1.25 ${FONT};color:${C.text};letter-spacing:-.02em">${esc(o.heading)}</h1>
        ${o.body}
      </div>
      <p style="margin:26px 0 0;padding-top:16px;border-top:1px solid ${C.line};font:400 12px/1.6 ${FONT};color:${C.faint}">If you didn&rsquo;t ask for this, you can ignore this email. &middot; <a href="${SITE}" style="color:${C.greenText};text-decoration:none">${SITE.replace(/^https?:\/\//, "")}</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

const para = (t: string, extra = "") => `<p style="margin:12px 0 0;font:400 14px/1.7 ${FONT};color:${C.body};${extra}">${esc(t)}</p>`;

/** The email that carries a one-time code.
 *  The subject is "Your QCU Robotics … code: 482915", the form Gmail recognises as a verification email; on supported Gmail apps
 *  it then shows its own "Copy code" button above the message. (An email can't copy to the clipboard by itself.)
 *  The digits sit in boxes but are adjacent inline pieces with no spaces between them, so selecting them copies "482915". */
export function codeEmail(opts: { code: string; heading: string; intro: string; minutes: number }) {
  const { code, heading, intro, minutes } = opts;
  const boxes = [...code].map((d, i) =>
    `<span class="qcu-d" style="animation-delay:${i * 70 + 150}ms;width:40px;height:52px;margin:0 3px;background:${C.elevated};border:1px solid ${C.border};border-radius:10px;font:700 26px/52px ${MONO};color:${C.text};text-align:center">${esc(d)}</span>`).join("");

  const body = `
        ${para(intro)}
        <div style="margin-top:20px;padding:20px 12px;background:${C.bg};border:1px solid ${C.line};border-radius:14px;text-align:center">
          <p style="margin:0 0 12px;font:600 11px/1 ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.greenText}">Verification code</p>
          <div style="font-size:0;line-height:0;white-space:nowrap;-webkit-user-select:all;user-select:all">${boxes}</div>
          <p style="margin:14px 0 0;font:400 12px/1.5 ${FONT};color:${C.muted}">Expires in ${minutes} minutes</p>
        </div>`;

  const html = frame({ preheader: `Your QCU Robotics code is ${code}. It expires in ${minutes} minutes.`, heading, body });
  const text = `${heading}\n\nVerification code: ${code}\n(expires in ${minutes} minutes)\n\n${intro}\n\nIf you didn't ask for this, you can ignore this email.\n${SITE}`;
  return { html, text };
}

/** A short "something changed on your account" notice (sent to the old address when the email is changed). */
export function noticeEmail(opts: { heading: string; intro: string; details: [string, string][]; warning: string }) {
  const { heading, intro, details, warning } = opts;
  const rows = details.map(([k, v]) => `<tr><td style="padding:6px 0;font:500 13px/1.4 ${FONT};color:${C.muted};width:90px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font:600 13px/1.4 ${FONT};color:${C.text};word-break:break-all">${esc(v)}</td></tr>`).join("");
  const body = `
        ${para(intro)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:${C.bg};border:1px solid ${C.line};border-radius:14px"><tr><td style="padding:10px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>
        ${para(warning, "color:#fca5a5")}`;
  const html = frame({ preheader: intro, heading, body });
  const text = `${heading}\n\n${intro}\n\n${details.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${warning}\n${SITE}`;
  return { html, text };
}
