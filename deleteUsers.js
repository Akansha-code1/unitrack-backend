import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const deleteUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.deleteMany({}); // ✅ deletes ALL users

    console.log("Deleted users:", result.deletedCount);

    process.exit();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

deleteUsers();