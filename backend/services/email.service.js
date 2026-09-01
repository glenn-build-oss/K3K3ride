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

module.exports = {
  sendEmail,
  sendAdminOTP,
  initTransporter
};
