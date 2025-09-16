const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, default: "" },               // Text message content
  imageUrl: { type: String, default: null },            // Optional uploaded image URL
  type: { 
    type: String, 
    enum: ["text", "image", "meeting-invite"], 
    default: "text" 
  }, // "text" = normal message, "image" = image file, "meeting-invite" = Jitsi link
  meetingLink: { type: String, default: null },         // Jitsi meeting link if type is "meeting-invite"
}, { timestamps: true });

// Populate sender info automatically when queried
chatSchema.pre(/^find/, function(next) {
  this.populate("sender", "name role"); // always populate sender name and role
  next();
});

module.exports = mongoose.model("Chat", chatSchema);
