const nodemailer = require('nodemailer');

const sanitizeEnvValue = (value = '') => value.trim().replace(/^['"]+|['"]+$/g, '');

const SMTP_USER = sanitizeEnvValue(process.env.SMTP_USER || '');
const SMTP_PASS = sanitizeEnvValue(process.env.SMTP_PASS || '').replace(/\s+/g, '');
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Basera Infra Home';

// Create transporter for Gmail SMTP
const createTransporter = () => {
  if (!SMTP_USER) {
    throw new Error('SMTP_USER is not configured');
  }

  if (!SMTP_PASS) {
    throw new Error('SMTP_PASS is not configured');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to: email,
      subject: 'Email Verification - OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .otp-box {
              background-color: #f0f0f0;
              border: 2px dashed #4CAF50;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
              border-radius: 5px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #4CAF50;
              letter-spacing: 5px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Basera Infra Home</h1>
            </div>
            <div class="content">
              <h2>Hello ${name || 'User'},</h2>
              <p>Thank you for signing up with Basera Infra Home!</p>
              <p>To complete your registration, please use the following One-Time Password (OTP):</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>This OTP is valid for 10 minutes</li>
                <li>Do not share this OTP with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              
              <p>Best regards,<br>Basera Infra Home Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);

    if (error && error.code === 'EAUTH') {
      throw new Error('Email service authentication failed. Please verify SMTP_USER and SMTP_PASS.');
    }

    if (error && (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET' || error.code === 'ECONNECTION')) {
      throw new Error('Email service is temporarily unreachable. Please try again.');
    }

    throw new Error('Failed to send OTP email');
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail
};
