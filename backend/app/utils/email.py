import os
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def send_otp_email(email_to: str, otp: str) -> bool:
    """
    Sends an OTP verification email to the user.
    Reads SMTP config from environment variables.
    Falls back to console + last_otp.txt if SMTP is not configured.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = os.getenv("SMTP_PORT", "587").strip()
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "no-reply@paperlens.com").strip()

    subject = "PaperLens — Your Verification Code"
    body_text = f"Your PaperLens verification code is: {otp}\nThis code expires in 10 minutes."
    body_html = f"""
    <html>
      <head></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;
                     box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
                  <div style="display:inline-flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;
                                display:inline-flex;align-items:center;justify-content:center;
                                font-size:18px;font-weight:900;color:#fff;line-height:1;">
                      P<span style="color:rgba(255,255,255,0.6);">L</span>
                    </div>
                    <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.03em;">PaperLens</span>
                  </div>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 32px;">
                  <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.02em;">
                    Verify your email
                  </h1>
                  <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
                    Enter this code to complete your PaperLens registration. It's valid for&nbsp;<strong>10&nbsp;minutes</strong>.
                  </p>
                  <!-- OTP box -->
                  <div style="background:#f1f5f9;border:2px dashed #c7d2fe;border-radius:12px;
                               padding:24px;text-align:center;margin-bottom:28px;">
                    <span style="font-size:42px;font-weight:900;letter-spacing:12px;
                                 color:#4f46e5;font-family:'Courier New',monospace;">{otp}</span>
                  </div>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                    If you didn't create a PaperLens account, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
                  <p style="margin:0;font-size:11px;color:#cbd5e1;">
                    PaperLens Research Platform &nbsp;·&nbsp; AI-Powered Peer Review
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
    """

    # Always write fallback file for local dev convenience
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        otp_file_path = os.path.join(backend_dir, "last_otp.txt")
        with open(otp_file_path, "w") as f:
            f.write(f"OTP: {otp}\nEmail: {email_to}\nTimestamp: {datetime.utcnow().isoformat()}\n")
    except Exception as e:
        logger.error(f"Failed to write OTP fallback file: {e}")

    # Console fallback — always visible in server logs
    logger.info(
        "\n==========================================================\n"
        " [OTP VERIFICATION]\n"
        " Email: %s\n"
        " Verification OTP: %s\n"
        " (also written to: backend/last_otp.txt)\n"
        "==========================================================",
        email_to, otp
    )
    print(f"\n[OTP] {email_to} → {otp}\n", flush=True)

    # Skip SMTP if not configured (still has placeholder values)
    if not smtp_host or not smtp_user or smtp_user in ("", "your_email@gmail.com") or not smtp_pass or smtp_pass in ("", "your_gmail_app_password_here"):
        logger.warning(
            "SMTP not fully configured. OTP printed to console only. "
            "Update SMTP_USERNAME and SMTP_PASSWORD in backend/.env to send real emails."
        )
        return False

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"PaperLens <{smtp_from}>"
        message["To"] = email_to
        message.attach(MIMEText(body_text, "plain"))
        message.attach(MIMEText(body_html, "html"))

        port = int(smtp_port)
        if smtp_use_ssl or port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(smtp_from, email_to, message.as_string())
        server.quit()
        logger.info("OTP email sent successfully to %s", email_to)
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP authentication failed for %s. "
            "For Gmail, use an App Password: https://myaccount.google.com/apppasswords",
            smtp_user
        )
        return False
    except smtplib.SMTPConnectError as e:
        logger.error("SMTP connection failed to %s:%s — %s", smtp_host, smtp_port, e)
        return False
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", email_to, e)
        return False
