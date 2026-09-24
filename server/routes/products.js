"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext) || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

function removeUploadedFile(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return; // never delete seed/static assets
  const abs = path.join(UPLOAD_DIR, path.basename(imagePath));
  fs.unlink(abs, () => {});
}

// ---------- Public ----------
router.get("/", (req, res) => {
  const db = store.read();
  const products = [...db.products].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(products);
});

router.get("/:id", (req, res) => {
  const db = store.read();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

// ---------- Admin ----------
router.post("/", requireAuth, upload.single("image"), (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !title.trim()) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Title is required." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "An image is required." });
  }

  const db = store.read();
  const product = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    image: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString(),
  };
  db.products.push(product);
  store.write(db);
  res.status(201).json(product);
});

router.put("/:id", requireAuth, upload.single("image"), (req, res) => {
  const db = store.read();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: "Product not found." });
  }

  const { title, description } = req.body || {};
  if (title !== undefined) product.title = title.trim();
  if (description !== undefined) product.description = description.trim();

  if (req.file) {
    removeUploadedFile(product.image);
    product.image = `/uploads/${req.file.filename}`;
  }

  store.write(db);
  res.json(product);
});

router.delete("/:id", requireAuth, (req, res) => {
  const db = store.read();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Product not found." });

  const [removed] = db.products.splice(idx, 1);
  removeUploadedFile(removed.image);
  store.write(db);
  res.json({ ok: true });
});

module.exports = router;
