/**
 * K3K3 Backend — Resend Email Service
 * 
 * Provides transactional email delivery using the Resend REST API (https://resend.com).
 * Features:
 *  - Secure OTP email delivery for admin 2FA and user authentication.
 *  - Branded responsive HTML templates with K3K3 yellow/black theme.
 *  - Zero external npm bloat: uses native https requests.
 *  - Safe fallback: if RESEND_API_KEY is not configured yet, logs OTP securely to console.
 */

const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'K3K3ride <onboarding@resend.dev>';

/**
 * Checks if Resend API key is configured.
 * @returns {boolean}
 */
function isResendConfigured() {
  const key = process.env.RESEND_API_KEY || '';
  return Boolean(key && key.startsWith('re_'));
}

/**
 * Dispatches an email via the Resend REST API.
 * @param {object} param0
 * @param {string} param0.to - Recipient email address
 * @param {string} param0.subject - Email subject line
 * @param {string} param0.html - HTML body
 * @param {string} [param0.text] - Plain text fallback
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
function sendEmail({ to, subject, html, text }) {
  return new Promise((resolve) => {
    const apiKey = process.env.RESEND_API_KEY || '';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'K3K3ride <onboarding@resend.dev>';

    if (!isResendConfigured()) {
      console.warn('[Resend] RESEND_API_KEY is not configured in .env. Email dispatch skipped.');
      return resolve({
        success: false,
        error: 'RESEND_API_KEY is not configured. Please supply your Resend API key.',
        simulated: true
      });
    }

    const payload = JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]+>/g, ' ').trim()
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Resend] Email successfully sent to ${to} (ID: ${parsed.id})`);
            resolve({ success: true, id: parsed.id });
          } else {
            console.error(`[Resend] API Error (${res.statusCode}):`, parsed);
            resolve({ success: false, error: parsed.message || 'Failed to send email via Resend' });
          }
        } catch (parseErr) {
          console.error('[Resend] Response parse error:', parseErr, data);
          resolve({ success: false, error: 'Invalid response from Resend API' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Resend] Network request failed:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Generates branded HTML template for verification OTP.
 * @param {string} code - 6-digit OTP code
 * @param {string} [purpose] - Purpose (e.g., 'Admin 2FA Login', 'Account Verification')
 * @returns {string} Branded HTML
 */
function buildOtpEmailHtml(code, purpose = 'Verification') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K3K3 Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0c0d10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#14171f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#FFD60A 0%,#E6C000 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#0c0d10;letter-spacing:-0.5px;">K3K3<span style="font-weight:400;">ride</span></h1>
              <p style="margin:4px 0 0 0;font-size:12px;font-weight:700;color:#332900;text-transform:uppercase;letter-spacing:1px;">Campus &amp; City Transportation</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <h2 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#ffffff;">${purpose} Code</h2>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#94a3b8;">
                Use the one-time verification code below to complete your login. This code is valid for <strong>5 minutes</strong>.
              </p>

              <!-- OTP Code Display Card -->
              <div style="background:#0c0d10;border:1px solid rgba(255,214,10,0.3);border-radius:14px;padding:24px 16px;text-align:center;margin:24px 0;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:900;color:#FFD60A;letter-spacing:10px;display:inline-block;padding-left:10px;">
                  ${code}
                </span>
              </div>

              <!-- Security Warning -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px 16px;margin:20px 0;">
                <tr>
                  <td style="font-size:12px;line-height:1.5;color:#fca5a5;">
                    <strong style="color:#ef4444;">Security Notice:</strong> Never share this code with anyone, including K3K3 staff. We will never ask for your code over the phone or WhatsApp.
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                If you did not request this verification code, you can safely ignore this email. Someone may have entered your email by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);background:#0e1017;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">
                &copy; ${new Date().getFullYear()} K3K3ride Technologies. All rights reserved. &bull; Ho, Volta Region, Ghana
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a 6-digit OTP code to an email address via Resend.
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.code - 6-digit OTP
 * @param {string} [options.role] - User role (e.g., 'admin', 'finance', 'support', 'passenger', 'rider')
 * @param {string} [options.purpose] - Action purpose (e.g., '2FA Login', 'Account Verification')
 * @returns {Promise<{success: boolean, id?: string, error?: string, simulated?: boolean}>}
 */
async function sendEmailOTP({ to, code, role = 'user', purpose = 'Account Verification' }) {
  if (!to || !code) {
    return { success: false, error: 'Recipient email and OTP code are required.' };
  }

  const subject = `Your K3K3 Verification Code: ${code}`;
  const html = buildOtpEmailHtml(code, `${role.toUpperCase()} ${purpose}`);
  return await sendEmail({ to, subject, html });
}

/**
 * Builds HTML template for staff activity notification (sign-in / sign-out).
 */
function buildStaffActivityEmailHtml({ name, email, department, role, action, ip, userAgent, timestamp }) {
  const isLogin = (action || '').toUpperCase() === 'LOGIN';
  const actionLabel = isLogin ? 'Signed In' : 'Signed Out';
  const badgeBg = isLogin ? '#10B981' : '#F97316';
  const badgeText = isLogin ? 'SESSION ACTIVE' : 'SESSION ENDED';
  const dateStr = timestamp ? new Date(timestamp).toUTCString() : new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K3K3 Staff Activity Alert</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0c0d10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#14171f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#FFD60A 0%,#E6C000 100%);padding:24px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:900;color:#0c0d10;letter-spacing:-0.5px;">K3K3<span style="font-weight:400;">ride</span></h1>
              <p style="margin:4px 0 0 0;font-size:11px;font-weight:800;color:#332900;text-transform:uppercase;letter-spacing:1px;">Security &amp; Audit Trail</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <div style="display:inline-block;padding:4px 10px;border-radius:20px;background:${badgeBg}22;border:1px solid ${badgeBg}66;color:${badgeBg};font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:14px;">
                ${badgeText}
              </div>
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;">
                Staff Member ${actionLabel}
              </h2>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#94a3b8;">
                This notification was generated because a staff member account accessed the K3K3 Admin Portal.
              </p>

              <!-- Activity Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#0c0d10;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;width:35%;">Staff Name</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#ffffff;font-size:13px;font-weight:700;">${name || 'Staff Member'}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;">Email Address</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#FFD60A;font-family:monospace;font-size:13px;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;">Department / Role</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#38bdf8;font-size:13px;font-weight:600;">${department || role || 'Operations'}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;">Action Type</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:${badgeBg};font-size:13px;font-weight:800;">${actionLabel.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;">Timestamp</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#cbd5e1;font-size:12px;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;font-weight:700;">IP Address</td>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:#94a3b8;font-family:monospace;font-size:12px;">${ip || '127.0.0.1'}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;color:#64748b;font-size:12px;font-weight:700;">Device / Browser</td>
                  <td style="padding:12px 18px;color:#94a3b8;font-size:11px;line-height:1.4;">${userAgent || 'Browser'}</td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                This audit log is automatically dispatched to the Super Admin alert inbox (<span style="color:#FFD60A;">k3k3ride@gmail.com</span>). No action is required unless this activity is unrecognized.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);background:#0e1017;padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">
                &copy; ${new Date().getFullYear()} K3K3ride Admin Security &bull; Ho, Volta Region, Ghana
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a staff login/logout audit notification to k3k3ride@gmail.com via Resend.
 */
async function sendStaffActivityNotification({ name, email, department, role, action, ip, userAgent, timestamp }) {
  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || 'k3k3ride@gmail.com';
  const isLogin = (action || '').toUpperCase() === 'LOGIN';
  const actionLabel = isLogin ? 'Sign-in' : 'Sign-out';
  const subject = `[K3K3 Staff Alert] ${actionLabel}: ${name || email} (${department || role || 'Staff'})`;
  const html = buildStaffActivityEmailHtml({ name, email, department, role, action, ip, userAgent, timestamp });

  return await sendEmail({ to: notifyEmail, subject, html });
}

module.exports = {
  isResendConfigured,
  sendEmail,
  sendEmailOTP,
  sendStaffActivityNotification,
  buildOtpEmailHtml,
  buildStaffActivityEmailHtml
};
