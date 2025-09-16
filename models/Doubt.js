const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  isSolved: { type: Boolean, default: false },
  meetingLink: { type: String, default: null }, // 🔗 Jitsi meeting link
}, { timestamps: true });

// Auto-populate asker and answerer info when fetching doubts
doubtSchema.pre(/^find/, function(next) {
  this.populate("askedBy", "name role");
  this.populate("answeredBy", "name role");
  next();
});

module.exports = mongoose.model("Doubt", doubtSchema);
