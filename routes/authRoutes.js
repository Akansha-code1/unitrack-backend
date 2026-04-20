import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const password = req.body.password;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        email: user.email,
        id: user._id,
        role: user.role,
      },
    });

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= SIGNUP ================= */
router.post("/signup", async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const password = req.body.password;
    const name = req.body.name;
    const role = req.body.role || "student";

    // 🔥 NEW FIELDS ADDED (ONLY THIS PART NEW)
    const branch = req.body.branch || "";
    const year = req.body.year || "";
    const semester = req.body.semester || "";

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,

      // 🔥 SAVED HERE
      branch,
      year,
      semester,
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        email: newUser.email,
        id: newUser._id,
        role: newUser.role,

        // 🔥 OPTIONAL SEND BACK
        branch: newUser.branch,
        year: newUser.year,
        semester: newUser.semester,
      },
    });

  } catch (err) {
    console.log("SIGNUP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= AUTH MIDDLEWARE ================= */
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* ================= ADMIN MIDDLEWARE ================= */
const adminMiddleware = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

/* ================= ADMIN ROUTES ================= */

// GET all users
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  const users = await User.find({}, "-password");
  res.json(users);
});

// DELETE user
router.delete("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
});

// TOGGLE admin role
router.put("/users/:id/role", authMiddleware, adminMiddleware, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.role = user.role === "admin" ? "user" : "admin";
  await user.save();

  res.json({ message: `Role updated to ${user.role}`, user });
});

export default router;