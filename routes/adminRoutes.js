import express from "express";
const router = express.Router();

// Example admin route
router.get("/ping", (req, res) => {
  res.json({ message: "Admin routes working ✅" });
});

export default router;