"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const store = require("./store");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const contentRoutes = require("./routes/content");
const contactRoutes = require("./routes/contact");

store.read(); // makes sure data/db.json exists (and the admin account is seeded) before we accept requests

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD) app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "3dbj.sid",
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 8 * 60 * 60 * 1000, // 8h
    },
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/contact", contactRoutes);

// Multer / generic API error handler
app.use("/api", (err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`[3d-bj] Server running: http://localhost:${PORT}`);
  console.log(`[3d-bj] Admin panel:    http://localhost:${PORT}/admin/`);
});
