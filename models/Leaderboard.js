const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
  senior: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, default: 0 },
  rank: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
