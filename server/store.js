// Tiny synchronous JSON-file data store.
// Good enough for a single-admin, low-traffic commercial site — no DB server to run.
"use strict";

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function defaultContent() {
  return {
    businessName: "3D-BJ",
    tagline: "Print · Scan · Model",
    heroEyebrow: "3D-BJ · Print · Scan · Model",
    heroHeadline: "Your ideas, printed layer by layer.",
    heroLead:
      "Prototypes, spare parts, gifts and décor. Send us a file or an idea — we'll scan, model and print it — in up to 4 colors, or in tough engineering materials.",
    aboutName: "Bojan Jovović",
    aboutTag: "Owner · Print operator",
    aboutText:
      "Every job goes through my hands — from scanning and modeling to slicing, printing and final quality check. One person responsible, from your first message to delivery.",
    phone: "+1 (555) 010-0199",
    email: "hello@3d-bj.example",
    footerNote: "All rights reserved.",
  };
}

function seedProducts() {
  return [
    {
      id: "seed-vase",
      title: "Spiral vase",
      description: "Smooth spiral vase, printed in PLA.",
      image: "/assets/images/vase.svg",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-gear",
      title: "Gear set",
      description: "Functional mechanical gear set, printed in PETG.",
      image: "/assets/images/gear.svg",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-figurine",
      title: "Robot figurine",
      description: "Multicolor robot figurine, printed in PLA.",
      image: "/assets/images/figurine.svg",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-phone-stand",
      title: "Phone stand",
      description: "Sturdy desk phone stand, printed in PLA.",
      image: "/assets/images/phone-stand.svg",
      createdAt: new Date().toISOString(),
    },
  ];
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "changeme123";

    if (!process.env.ADMIN_PASSWORD) {
      console.warn(
        "\n[3d-bj] WARNING: no ADMIN_PASSWORD set in .env — using default password 'changeme123'.\n" +
          "         Log in and change it immediately from the admin panel (Account tab).\n"
      );
    }

    const db = {
      admin: {
        username,
        passwordHash: bcrypt.hashSync(password, 10),
      },
      content: defaultContent(),
      products: seedProducts(),
      messages: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function write(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { read, write, DATA_DIR, DB_FILE };
