const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String },
  type: { type: String, default: "text" },
  meetingLink: { type: String },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
