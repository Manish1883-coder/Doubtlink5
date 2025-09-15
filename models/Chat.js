const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String },
  imageUrl: { type: String },
  type: { 
    type: String, 
    enum: ["text", "image", "meeting-invite"], 
    default: "text" 
  }, // 💬 Meeting invite support
  meetingLink: { type: String, default: null }, // 🔗 Jitsi link in chat
}, { timestamps: true });

module.exports = mongoose.model("Chat", chatSchema);
