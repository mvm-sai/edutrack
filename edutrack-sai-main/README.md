# 🏫 EduTrack — Teacher Attendance & WhatsApp Automation

A full-stack web app for teachers to mark student attendance and automatically send WhatsApp messages to parents — no paid API required.

---

## 📁 Project Structure

```
teacher-attendance-app/
├── parents.js              ← ⭐ UPDATE THIS: parent phone numbers
├── README.md
│
├── backend/
│   ├── server.js           ← Express entry point
│   ├── .env                ← Your env vars (copy from .env.example)
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── db/
│       │   ├── database.js ← SQLite setup + table creation
│       │   └── seed.js     ← Seeds 4 teachers & 10 students
│       ├── whatsapp/
│       │   └── client.js   ← whatsapp-web.js QR automation
│       ├── middleware/
│       │   └── auth.js     ← JWT verification
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── studentsController.js
│       │   ├── attendanceController.js
│       │   └── whatsappController.js
│       └── routes/
│           ├── auth.js
│           ├── students.js
│           ├── attendance.js
│           └── whatsapp.js
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.js         ← SPA router
        ├── api.js          ← Fetch wrapper
        ├── styles/
        │   └── main.css    ← Full design system
        ├── components/
        │   ├── toast.js
        │   └── spinner.js
        └── pages/
            ├── login.js
            ├── dashboard.js
            └── attendance.js
```

---

## ✅ Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18 or higher | `node -v` |
| npm | 8 or higher | `npm -v` |
| WhatsApp | Installed on a phone | — |

---

## 🚀 Setup & Run Instructions

### Step 1 — Install Backend Dependencies

```bash
cd teacher-attendance-app/backend
npm install
```

> ⚠️ **This will download Chromium (~170MB) for Puppeteer.** This is a one-time download.

---

### Step 2 — Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

---

### Step 3 — Configure Environment

```bash
cd ../backend
copy .env.example .env
```

Open `.env` and set a strong `JWT_SECRET` if you like (optional for local dev):
```
JWT_SECRET=my_super_secret_key_change_in_production
```

---

### Step 4 — Update Parent Phone Numbers

Open **`parents.js`** in the project root and replace the placeholder numbers:

```js
'Alice Johnson': '919876543210',   // 91 = India, then 10-digit number
```

**Format:** country code + number — no `+`, no spaces, no dashes.

---

### Step 5 — Seed the Database

```bash
cd backend
npm run seed
```

Output will show all seeded teachers and students.

---

### Step 6 — Start the Backend

```bash
cd backend
npm run dev
```

The server starts at **http://localhost:3001** and immediately initializes the WhatsApp client.

---

### Step 7 — Scan the WhatsApp QR Code

A QR code will appear in the terminal like this:

```
╔══════════════════════════════════════════════════════════╗
║        📱  SCAN THIS QR CODE WITH WHATSAPP  📱           ║
║   Open WhatsApp → Settings → Linked Devices → Link       ║
╚══════════════════════════════════════════════════════════╝

▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▀▄▀▀▀█ ▄▄▄▄▄ █
...
```

On your phone: **WhatsApp → Settings (⋮) → Linked Devices → Link a Device** → scan.

> ✅ Session is saved in `.wwebjs_auth/` — you only need to scan once!

---

### Step 8 — Start the Frontend

Open a **new terminal**:

```bash
cd frontend
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## 🔐 Login Credentials

| Name | Email | Password |
|------|-------|----------|
| Sarah Johnson | sarah@school.com | teacher123 |
| Mike Williams | mike@school.com | teacher123 |
| Emily Davis | emily@school.com | teacher123 |
| James Wilson | james@school.com | teacher123 |

---

## 👨‍🎓 Student Assignments

| Teacher | Students |
|---------|----------|
| Sarah Johnson | Alice Johnson, Bob Smith, Carol Davis |
| Mike Williams | David Wilson, Emma Brown, Frank Miller |
| Emily Davis | Grace Lee, Henry Taylor |
| James Wilson | Isabella Clark, Jack Anderson |

---

## 📱 WhatsApp Message Format

**When Present:**
```
Dear Parent,

✅ [Student Name] attended class today.

📚 Class Taken: [class details]
📝 Homework: [homework details]

Thank you.
```

**When Absent:**
```
Dear Parent,

⚠️ [Student Name] was absent today.

📚 Class Taken: [class details]
📝 Homework: [homework details]

Please ensure your child completes and submits the homework tomorrow.

Thank you.
```

---

## 🔌 API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | ❌ | Teacher login |
| GET | `/api/auth/me` | ✅ | Get current teacher |
| GET | `/api/students` | ✅ | My students + today's status |
| GET | `/api/students/:id` | ✅ | Student detail + history |
| POST | `/api/attendance/submit` | ✅ | Mark attendance + send WhatsApp |
| GET | `/api/attendance/history` | ✅ | Recent attendance records |
| GET | `/api/attendance/student/:id` | ✅ | Per-student history |
| GET | `/api/whatsapp/status` | ✅ | WhatsApp connection status |
| GET | `/api/health` | ❌ | Server health check |

---

## 🛠️ Common Issues

### "WhatsApp client not ready"
- Check the backend terminal for the QR code
- Make sure you scanned it with WhatsApp mobile
- The `.wwebjs_auth/` folder stores your session

### Re-seed with fresh data
```bash
cd backend
npm run seed:fresh
```

### Port conflicts
- Backend default: `3001` — change in `backend/.env`
- Frontend default: `5173` — change in `frontend/vite.config.js`

### Chromium download fails
- Make sure you have a stable internet connection during `npm install`
- On corporate networks, you may need to set `PUPPETEER_DOWNLOAD_HOST`

---

## 🗄️ Database

SQLite file is at: `backend/data/attendance.db`

Open with any SQLite viewer (e.g. [DB Browser for SQLite](https://sqlitebrowser.org/)).

Tables: `teachers`, `students`, `attendance`
