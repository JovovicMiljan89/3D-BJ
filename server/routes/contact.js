"use strict";

const express = require("express");
const crypto = require("crypto");
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Public: submit an inquiry ----------
router.post("/", (req, res) => {
  const { name, email, material, service, message } = req.body || {};

  if (!name || !name.trim() || !message || !message.trim() || !EMAIL_RE.test(email || "")) {
    return res.status(400).json({ error: "Please fill in all required fields with a valid email." });
  }

  const db = store.read();
  const entry = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim(),
    material: (material || "").trim(),
    service: (service || "").trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  db.messages.push(entry);
  store.write(db);
  res.status(201).json({ ok: true });
});

// ---------- Admin: manage inquiries ----------
router.get("/", requireAuth, (req, res) => {
  const db = store.read();
  const messages = [...db.messages].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(messages);
});

router.patch("/:id", requireAuth, (req, res) => {
  const db = store.read();
  const msg = db.messages.find((m) => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: "Message not found." });
  if (typeof req.body?.read === "boolean") msg.read = req.body.read;
  store.write(db);
  res.json(msg);
});

router.delete("/:id", requireAuth, (req, res) => {
  const db = store.read();
  const idx = db.messages.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Message not found." });
  db.messages.splice(idx, 1);
  store.write(db);
  res.json({ ok: true });
});

module.exports = router;
