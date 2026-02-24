import nodemailer from 'nodemailer';

/**
 * Send password reset email with the reset link.
 * Returns true if sent (or skipped because no SMTP); throws or returns false on send failure.
 * When SMTP is not configured, logs the link and resolves (no throw).
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[Password reset] No SMTP configured (set SMTP_USER and SMTP_PASS in .env). Reset link:', resetLink);
    return true;
  }

  console.log('[Password reset] Sending email to', to, 'via', host);
  const transporter = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to,
      subject: 'Reset your password',
      text: `Use this link to reset your password (valid for 1 hour):\n\n${resetLink}`,
      html: `<p>Use this link to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });
    console.log('[Password reset] Email sent successfully to', to);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Password reset] Send failed:', msg);
    throw err;
  }
}
