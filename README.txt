AFYACARE HOSPITAL BOOKING SYSTEM — MYSQL VERSION
================================================
This version uses HTML, CSS and JavaScript in the browser, Node.js + Express as
its backend, and MySQL for permanent database storage.

REQUIREMENTS
- Install Node.js (LTS)
- Install MySQL Server and start its service
- Optional: install Visual Studio Code and MySQL Workbench

STEP 1 — CREATE THE DATABASE
1. Open MySQL Workbench and connect to your local MySQL server.
2. Open database.sql from this project.
3. Click the lightning bolt (Execute).
   It creates database afycare_db and tables users and appointments.

STEP 2 — CONFIGURE THE PROJECT
1. Open this project folder in VS Code.
2. Open a terminal: Terminal > New Terminal.
3. Run: npm install
4. Copy .env.example and rename the copy to .env.
5. Edit .env and enter your own MySQL password after DB_PASSWORD=.
   Do not share your .env file or database password.

STEP 3 — CREATE ADMIN LOGIN
Run: npm run seed-admin
Admin email: admin@afycare.test
Admin password: Admin123!
Change this demo password before showing the project to anyone else.

STEP 4 — START THE WEBSITE
Run: npm start
Open your browser at http://localhost:3000
Do not open index.html directly. The website must be served by the Node server.

HOW TO TEST
- Register a new patient account.
- Book an appointment.
- Sign out.
- Sign in as the admin above.
- Open My appointments and confirm or cancel a pending booking.
- Try booking the same doctor, date and time again: the database blocks an
  active duplicate appointment slot.

IMPORTANT
This is an academic demonstration, not a production-ready medical system.
The session store is in-memory and will reset on server restart. For a real
hospital deployment, configure a persistent session store, HTTPS, secure
cookies, CSRF protection, rate limiting, password reset, audit logs, backups,
proper access controls, privacy compliance and professional security review.
Do not enter real patient medical data into this demo.
