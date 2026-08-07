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
    If SMTP settings are not configured, prints the OTP to the console
    and writes it to backend/last_otp.txt as a fallback.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "no-reply@paperlens.com")

    subject = f"PaperLens — Verification Code: {otp}"
    body_text = f"Your verification code is: {otp}\nThis code is valid for 10 minutes."
    body_html = f"""
    <html>
      <body style="font-family: sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 24px;">Welcome to PaperLens!</h2>
        <p>Thank you for signing up. To complete your registration and activate your account, please enter the following verification code:</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e1b4b;">{otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">PaperLens Research Platform</p>
      </body>
    </html>
    """

    # Always write to last_otp.txt for local testing/development convenience
    try:
        # Determine paths relative to this file
        # This file is backend/app/utils/email.py, backend root is 3 levels up
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        otp_file_path = os.path.join(backend_dir, "last_otp.txt")
        with open(otp_file_path, "w") as f:
            f.write(f"OTP: {otp}\nEmail: {email_to}\nTimestamp: {datetime.utcnow().isoformat()}\n")
    except Exception as e:
        logger.error(f"Failed to write OTP fallback file: {e}")

    # Fallback/Print to console
    console_message = (
        f"\n"
        f"==========================================================\n"
        f" [OTP VERIFICATION FALLBACK]\n"
        f" Email: {email_to}\n"
        f" Verification OTP: {otp}\n"
        f" Written to: backend/last_otp.txt\n"
        f"==========================================================\n"
    )
    print(console_message, flush=True)

    # Check if SMTP is configured enough to send real email
    if not (smtp_host and smtp_port):
        logger.info("SMTP_HOST or SMTP_PORT not configured. Using console fallback.")
        return False

    try:
        # Construct MIME Message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = smtp_from
        message["To"] = email_to

        part1 = MIMEText(body_text, "plain")
        part2 = MIMEText(body_html, "html")
        message.attach(part1)
        message.attach(part2)

        # Connect and send
        port = int(smtp_port)
        if smtp_use_ssl or port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port)
        else:
            server = smtplib.SMTP(smtp_host, port)
            server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, email_to, message.as_string())
        server.quit()
        logger.info(f"OTP email sent successfully to {email_to}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email via SMTP to {email_to}: {e}")
        return False
