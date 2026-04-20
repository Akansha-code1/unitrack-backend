import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  studentEmail: {
    type: String,
    required: true,
  },

  submitted: {
    type: Boolean,
    default: false,
  },

  // ✍️ TEXT ANSWER
  answer: {
    type: String,
    default: "",
  },
taskFile: String,
  // 📎 FILE (store file URL or path)
  fileUrl: {
    type: String,
    default: "",
  },

  // 🕒 SUBMISSION TIME
  submittedAt: {
    type: Date,
  },

  // ⏰ LATE SUBMISSION
  isLate: {
    type: Boolean,
    default: false,
  },

  // 🎯 GRADING
 grade: {
  type: String,
  default: "",
},

  feedback: {
    type: String,
    default: "",
  },
});

const taskSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },

    // 👨‍🏫 Teacher who created task
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deadline: {
      type: Date,
    },

    priority: {
      type: String,
      default: "Medium",
    },

    subject: {
      type: String,
      default: "General",
    },
    fileUrl: {
  type: String,
  default: "",
},

    // 🎓 Students assigned
    assignedTo: [
      {
        type: String,
        required: true,
      },
    ],

    // 📊 Student submissions
    studentSubmissions: [submissionSchema],

    // Optional teacher tracking
    done: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);