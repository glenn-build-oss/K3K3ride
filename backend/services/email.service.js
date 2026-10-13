/**
 * K3K3 Backend — Email Service
 * 
 * Handles sending emails for admin OTP notifications.
 * Uses Nodemailer with Gmail SMTP.
 */

const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER || 'k3k3ride@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'K3K3ride <k3k3ride@gmail.com>';

let transporter = null;

/**
 * Initialize email transporter
 */
function initTransporter() {
  if (!EMAIL_PASSWORD) {
    console.warn('[Email] EMAIL_PASSWORD not set in .env - email service disabled');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    console.log('[Email] Email service initialized');
    return transporter;
  } catch (error) {
    console.error('[Email] Failed to initialize email service:', error);
    return null;
  }
}

/**
 * Send an email
 */
async function sendEmail(to, subject, htmlContent, textContent = null) {
  if (!transporter) {
    transporter = initTransporter();
    if (!transporter) {
      return { success: false, error: 'Email service not configured' };
    }
  }

  try {
    const mailOptions = {
      from: EMAIL_FROM,
      to: to,
      subject: subject,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send OTP email for admin login
 */
async function sendAdminOTP(email, otpCode) {
  const subject = 'K3K3 Admin - Verification Code';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #FFD60A, #E6C000); padding: 20px; text-align: center;">
        <h1 style="color: #0c0d10; margin: 0;">K3K3ride</h1>
      </div>
      <div style="padding: 30px; background: #f5f5f5;">
        <h2 style="color: #333;">Admin Verification Code</h2>
        <p style="color: #666; font-size: 16px;">Your verification code is:</p>
        <div style="background: #fff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #FFD60A; letter-spacing: 5px;">${otpCode}</span>
        </div>
        <p style="color: #666;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you did not request this code, please ignore this email.</p>
      </div>
    </div>
  `;

  const textContent = `Your K3K3 Admin verification code is: ${otpCode}. This code will expire in 5 minutes. Do not share this code with anyone.`;

  return sendEmail(email, subject, htmlContent, textContent);
}

/**
 * Send password changed security notification to user's registered email
 */
async function sendPasswordChangedEmail(email, userName = 'Passenger') {
  const subject = 'Security Alert: Your K3K3 Password Has Been Changed';
  const timestamp = new Date().toUTCString();
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: #0f172a; padding: 24px; text-align: center; border-bottom: 3px solid #FFD60A;">
        <h1 style="color: #FFD60A; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">K3K3ride</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Security & Account Protection</p>
      </div>
      <div style="padding: 28px 24px; color: #1e293b;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Password Successfully Updated</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          This email confirms that the password for your K3K3ride passenger account was recently updated on <strong>${timestamp}</strong>.
        </p>
        <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #334155;">
          <strong>Didn't make this change?</strong><br>
          If you did not authorize this password update, please contact K3K3 security support immediately at support@k3k3ride.com to secure your account.
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          This is an automated security notice. K3K3 will never ask for your password via email or phone.
        </p>
      </div>
    </div>
  `;
  const textContent = `Hello ${userName}, this confirms that your K3K3 account password was updated on ${timestamp}. If you did not make this change, contact support@k3k3ride.com immediately.`;

  // Always log to outbox file for audit verification
  try {
    const outboxPath = path.join(__dirname, '..', 'data', 'email_outbox.json');
    let outbox = [];
    if (fs.existsSync(outboxPath)) {
      try { outbox = JSON.parse(fs.readFileSync(outboxPath, 'utf8')); } catch (_) {}
    }
    outbox.unshift({
      id: 'eml_' + require('crypto').randomBytes(6).toString('hex'),
      to: email,
      subject,
      type: 'PASSWORD_CHANGED',
      user_name: userName,
      timestamp,
      sent_at: new Date().toISOString()
    });
    fs.writeFileSync(outboxPath, JSON.stringify(outbox.slice(0, 100), null, 2), 'utf8');
  } catch (err) {
    console.warn('[Email] Outbox log notice:', err.message);
  }

  return sendEmail(email, subject, htmlContent, textContent);
}

module.exports = {
  sendEmail,
  sendAdminOTP,
  sendPasswordChangedEmail,
  initTransporter
};
