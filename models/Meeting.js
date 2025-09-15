const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  meetingLink: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Meeting", meetingSchema);
