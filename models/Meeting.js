const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  doubtId: { type: mongoose.Schema.Types.ObjectId, ref: "Doubt", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  meetingLink: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // optional: track juniors/seniors in meeting
  createdAt: { type: Date, default: Date.now }
});

// Static method to fetch meetings for a particular doubt
meetingSchema.statics.getMeetingsByDoubt = async function(doubtId) {
  return this.find({ doubtId }).populate("createdBy", "name role");
};

module.exports = mongoose.model("Meeting", meetingSchema);
