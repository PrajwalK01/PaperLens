# PaperAI — Setup Guide for New User

## What You Need First (Install These)

1. **Python 3.11+** → https://www.python.org/downloads/
   - During install: ✅ check "Add Python to PATH"

2. **Node.js 20+** → https://nodejs.org
   - Download the LTS version

3. **Git** (optional, only if cloning) → https://git-scm.com

---

## Step 1 — Get a Free Groq API Key (takes 2 minutes)

1. Go to https://console.groq.com
2. Sign up (free)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

---

## Step 2 — Set Up the Backend

Open a terminal (Command Prompt or PowerShell) in the `PaperLens` folder:

```cmd
cd backend

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt
```

Now create your `.env` file:
- Copy `.env.docker.example` and rename it to `.env` inside the `backend/` folder
- Open it and fill in:

```
GROQ_API_KEY=gsk_your_key_here
SECRET_KEY=any_random_long_string_here
```

That's the minimum. Everything else is optional.

---

## Step 3 — Start the App

**Easiest way:** Double-click `start-local.bat` in the PaperLens folder.

It opens two windows automatically:
- Backend on http://localhost:8000
- Frontend on http://localhost:5173

Then open **http://localhost:5173** in your browser.

---

## Step 4 — Create Your Account

1. Click **Sign In** → **Sign Up**
2. Enter email and password
3. Check your email for the OTP code (or check `backend/last_otp.txt` if email isn't set up)
4. Enter the 6-digit code
5. You're in!

---

## What You Can Do

| Feature | How |
|---------|-----|
| Review a paper | Upload a PDF on the Home page → Start AI Review |
| Fetch from arXiv | Switch to "arXiv ID" tab → enter ID like `2301.00001` |
| Chat about paper | Use the Research Assistant panel on the right |
| View history | Click "Review History" in the sidebar |
| Dashboard stats | Click "Dashboard" in the sidebar |

---

## Troubleshooting

**"Network Error" on upload**
→ Make sure the backend terminal is still running (don't close it)

**Review stays at 0/5 agents**
→ Check that GROQ_API_KEY is set in `backend/.env`

**OTP not arriving by email**
→ Look in `backend/last_otp.txt` — the code is always saved there

**Port already in use**
→ Run `netstat -ano | findstr :8000` and kill that process, then restart

---

## Notes

- The `.env` file contains your API keys — never share it or commit it to git
- The SQLite database (`backend/PaperLens.db`) stores all your data locally
- To reset everything: delete `PaperLens.db` and restart the backend
