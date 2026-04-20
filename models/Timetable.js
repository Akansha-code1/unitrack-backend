import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema({
  userEmail: String,

  table: {
    type: Object, // stores full timetable JSON
    default: {},
  },
});

export default mongoose.model("Timetable", timetableSchema);