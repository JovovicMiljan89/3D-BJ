"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Very small brute-force guard: 5 attempts per IP, 15 min lockout window.
const attempts = new Map(); // ip -> { count, first }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isLocked(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
}

function clearFailures(ip) {
  attempts.delete(ip);
}

router.post("/login", (req, res) => {
  const ip = req.ip;
  if (isLocked(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const db = store.read();
  const ok =
    username === db.admin.username && bcrypt.compareSync(password, db.admin.passwordHash);

  if (!ok) {
    recordFailure(ip);
    return res.status(401).json({ error: "Invalid username or password." });
  }

  clearFailures(ip);
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ ok: true, username });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const db = store.read();
  if (!bcrypt.compareSync(currentPassword, db.admin.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  db.admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  store.write(db);
  res.json({ ok: true });
});

module.exports = router;
