import os
import logging
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


def send_otp_email(email_to: str, otp: str) -> bool:
    """
    Sends an OTP verification email to the user via the Resend HTTPS API.

    Uses Resend instead of raw SMTP because most free-tier PaaS hosts
    (Render, Heroku, etc.) block outbound SMTP ports (25/465/587) to
    prevent spam abuse — Resend's API runs over normal HTTPS, so it
    works from any host without needing a paid plan.

    Falls back to console + last_otp.txt if RESEND_API_KEY is not configured.
    """
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from = os.getenv("RESEND_FROM_EMAIL", "PaperLens <onboarding@resend.dev>").strip()

    subject = "PaperAI — Your Verification Code"
    body_text = f"Your PaperAI verification code is: {otp}\nThis code expires in 10 minutes."
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
                    <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.03em;">Paper<span style="color:rgba(255,255,255,0.7);">AI</span></span>
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
                    PaperAI Research Platform &nbsp;·&nbsp; AI-Powered Peer Review
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

    # Skip sending if Resend isn't configured
    if not resend_api_key:
        logger.warning(
            "RESEND_API_KEY not configured. OTP printed to console only. "
            "Set RESEND_API_KEY in Render's environment variables to send real emails."
        )
        return False

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": resend_from,
                "to": [email_to],
                "subject": subject,
                "html": body_html,
                "text": body_text,
            },
            timeout=10,
        )
        response.raise_for_status()
        logger.info("OTP email sent successfully to %s via Resend", email_to)
        return True

    except httpx.HTTPStatusError as e:
        logger.error(
            "Resend API error sending to %s: %s — %s",
            email_to, e.response.status_code, e.response.text
        )
        return False
    except Exception as e:
        logger.error("Failed to send OTP email to %s via Resend: %s", email_to, e)
        return False