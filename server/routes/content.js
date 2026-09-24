"use strict";

const express = require("express");
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const EDITABLE_FIELDS = [
  "businessName",
  "tagline",
  "heroEyebrow",
  "heroHeadline",
  "heroLead",
  "aboutName",
  "aboutTag",
  "aboutText",
  "phone",
  "email",
  "footerNote",
];

router.get("/", (req, res) => {
  const db = store.read();
  res.json(db.content);
});

router.put("/", requireAuth, (req, res) => {
  const db = store.read();
  const body = req.body || {};

  for (const field of EDITABLE_FIELDS) {
    if (typeof body[field] === "string") {
      db.content[field] = body[field].trim();
    }
  }

  store.write(db);
  res.json(db.content);
});

module.exports = router;
