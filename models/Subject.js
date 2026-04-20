import mongoose from "mongoose";
const subjectSchema = new mongoose.Schema({
  name: String,
  credits: Number,
  userEmail: String,
});

export default mongoose.model("Subject", subjectSchema);