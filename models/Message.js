const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, default: "" },                 // Text message content
  type: { 
    type: String, 
    enum: ["text", "image", "meeting-invite"], 
    default: "text" 
  }, // message type
  meetingLink: { type: String, default: null },           // Jitsi meeting link
  imageUrl: { type: String, default: null },             // Image URL if any
}, { timestamps: true });

// Auto-populate sender info when fetching messages
messageSchema.pre(/^find/, function(next) {
  this.populate("sender", "name role"); // populate sender name and role
  next();
});

module.exports = mongoose.model("Message", messageSchema);
