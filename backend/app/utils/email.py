import os
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def send_otp_email(email_to: str, otp: str) -> bool:
    """
    Sends an OTP verification email.
    Tries SMTP first (using env vars), falls back to console + last_otp.txt.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = os.getenv("SMTP_PORT", "587").strip()
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_ssl  = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user or "no-reply@paperai.app").strip()

    subject   = "PaperAI — Your Verification Code"
    body_text = f"Your PaperAI verification code is: {otp}\nThis code expires in 10 minutes."
    body_html = f"""
<html><body style="margin:0;padding:0;background:#0d0f1a;font-family:'Inter',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f1a;padding:40px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0"
      style="background:#13151f;border-radius:16px;border:1px solid rgba(99,102,241,0.3);overflow:hidden;">
      <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
          <span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.03em;">
            Paper<span style="color:rgba(255,255,255,0.65);">AI</span>
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#e2e4f0;">Verify your email</h1>
          <p style="margin:0 0 28px;font-size:14px;color:rgba(165,180,252,0.6);line-height:1.6;">
            Enter this code to complete your PaperAI registration. Valid for <strong style="color:#a5b4fc;">10 minutes</strong>.
          </p>
          <div style="background:rgba(99,102,241,0.1);border:2px dashed rgba(99,102,241,0.4);
                      border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#818cf8;
                         font-family:'Courier New',monospace;">{otp}</span>
          </div>
          <p style="margin:0;font-size:13px;color:rgba(165,180,252,0.4);line-height:1.6;">
            If you didn't create a PaperAI account, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 40px;background:rgba(99,102,241,0.05);
                   border-top:1px solid rgba(99,102,241,0.15);text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(165,180,252,0.3);">
            PaperAI Research Platform &nbsp;·&nbsp; AI-Powered Peer Review
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>
"""

    # Always write fallback file
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        with open(os.path.join(backend_dir, "last_otp.txt"), "w") as f:
            f.write(f"OTP: {otp}\nEmail: {email_to}\nTimestamp: {datetime.utcnow().isoformat()}\n")
    except Exception:
        pass

    # Always print to console
    print(f"\n[OTP] {email_to} → {otp}\n", flush=True)
    logger.info("[OTP] %s -> %s", email_to, otp)

    # Check SMTP is configured with real credentials
    placeholder_users = ("", "your_email@gmail.com", "your@email.com")
    placeholder_passes = ("", "your_gmail_app_password_here", "your_gmail_app_password")
    if not smtp_host or smtp_user in placeholder_users or smtp_pass in placeholder_passes:
        logger.warning("SMTP not fully configured — OTP in console only. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD in .env")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"PaperAI <{smtp_from}>"
        msg["To"]      = email_to
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        port = int(smtp_port)
        if smtp_ssl or port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(smtp_from, email_to, msg.as_string())
        server.quit()
        logger.info("OTP email sent to %s", email_to)
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP auth failed for %s. For Gmail use an App Password: "
            "https://myaccount.google.com/apppasswords", smtp_user
        )
        return False
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", email_to, e)
        return False
