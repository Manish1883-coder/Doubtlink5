const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isSolved: { type: Boolean, default: false },
  meetingLink: { type: String, default: null }, // 🔗 Jitsi meeting link
}, { timestamps: true });

module.exports = mongoose.model("Doubt", doubtSchema);
