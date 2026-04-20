import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express from "express";
import multer from "multer";
import path from "path";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import fs from "fs";

import Task from "./models/Tasks.js";
import User from "./models/User.js";
import Timetable from "./models/Timetable.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

/* ================= UPLOAD FOLDER ================= */
const uploadPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

/* ================= FILE UPLOAD ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ================= CONFIG ================= */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadPath));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

const JWT_SECRET = process.env.JWT_SECRET;

/* ================= AUTH ================= */
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token ❌" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token ❌" });
  }
};

/* ================= ROLE CHECK ================= */
const checkRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied ❌" });
  }
  next();
};

/* ================= TEST ================= */
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

/* ================= CREATE TASK ================= */
app.post(
  "/api/tasks",
  authMiddleware,
  checkRole(["teacher", "admin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      let {
        text,
        deadline,
        subject,
        assignedTo,
        branch,
        year,
        semester,
      } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Task text required" });
      }

      let emails = [];

      if (assignedTo) {
        if (typeof assignedTo === "string") {
          try {
            assignedTo = JSON.parse(assignedTo);
          } catch {
            assignedTo = assignedTo.split(",").map((e) => e.trim());
          }
        }
      }

      if (branch && year && semester) {
        const students = await User.find({
          role: "student",
          branch,
          year,
          semester,
        });
        emails = students.map((s) => s.email);
      } else if (assignedTo && assignedTo.length > 0) {
        emails = assignedTo;
      }

      const fileUrl = req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "";

      const task = await Task.create({
        text,
        userId: req.user.id,
        deadline,
        subject,
        assignedTo: emails,
        branch,
        year,
        semester,
        fileUrl,

        studentSubmissions: emails.map((email) => ({
          studentEmail: email,
          submitted: false,
          answer: "",
          fileUrl: "",
          submittedAt: null,
          isLate: false,
          grade: "",
          feedback: "",
        })),
      });

      res.json(task);
    } catch (err) {
      console.error("CREATE TASK ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================= GET TASKS ================= */
app.get("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let tasks;

    if (user.role === "student") {
      tasks = await Task.find({
        assignedTo: user.email,
      }).sort({ createdAt: -1 });
    } else {
      tasks = await Task.find({
        userId: req.user.id,
      }).sort({ createdAt: -1 });
    }

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SUBMIT TASK ================= */
app.put(
  "/api/tasks/:id/submit",
  authMiddleware,
  checkRole(["student"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      const task = await Task.findById(req.params.id);

      if (!task) return res.status(404).json({ error: "Task not found" });

      const fileUrl = req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "";

      let submission = task.studentSubmissions.find(
        (s) =>
          s.studentEmail.toLowerCase().trim() ===
          user.email.toLowerCase().trim()
      );

      if (submission) {
  submission.submitted = true;
  submission.answer = req.body.answer || "";

  if (fileUrl) {
    submission.fileUrl = fileUrl; // only overwrite if file exists
  }

  submission.submittedAt = new Date();
}
      await task.save();
      res.json({ message: "Submitted ✅" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
/* ================= GRADE TASK ================= */
app.put("/api/tasks/:id/grade", authMiddleware, checkRole(["teacher", "admin"]), async (req, res) => {
  try {
    const { studentEmail, grade, feedback } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const submission = task.studentSubmissions.find(
  (s) =>
    s.studentEmail.toLowerCase().trim() ===
    studentEmail.toLowerCase().trim()
);
    if (!submission) {
      return res.status(404).json({ error: "Student submission not found" });
    }

    submission.grade = grade;
    submission.feedback = feedback;

    await task.save();

    res.json({ message: "Graded successfully ✅", task });
  } catch (err) {
    console.error("GRADE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LEADERBOARD ================= */
app.get("/api/leaderboard", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: "student" });

    const leaderboard = users
      .map((user) => ({
        name: user.name,
        email: user.email,
        xp: user.xp,
      }))
      .sort((a, b) => b.xp - a.xp);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= TIMETABLE SAVE ================= */
app.post("/api/timetable", async (req, res) => {
  try {
    let { userEmail, table } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "Email required" });
    }

    userEmail = userEmail.toLowerCase();

    const updated = await Timetable.findOneAndUpdate(
      { userEmail },
      { $set: { table } },
      { new: true, upsert: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("TIMETABLE SAVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= TIMETABLE GET (🔥 MISSING BEFORE) ================= */
app.get("/api/timetable/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const data = await Timetable.findOne({ userEmail: email });

    if (!data) {
      return res.json({ table: {} });
    }

    res.json(data);
  } catch (err) {
    console.error("TIMETABLE GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ================= DELETE TASK ================= */
app.delete(
  "/api/tasks/:id",
  authMiddleware,
  checkRole(["teacher", "admin"]),
  async (req, res) => {
    try {
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Optional: only creator can delete
      if (task.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not allowed ❌" });
      }

      await Task.findByIdAndDelete(req.params.id);

      res.json({ message: "Task deleted successfully ✅" });
    } catch (err) {
      console.error("DELETE ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================= DB CONNECT ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running 🚀");
  console.log("JWT:", process.env.JWT_SECRET);
console.log("MONGO:", process.env.MONGO_URI);
});