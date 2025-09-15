const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["junior", "senior"], required: true },
  year: { type: Number },
  course: { type: String },
  points: { type: Number, default: 0 },
  badges: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
