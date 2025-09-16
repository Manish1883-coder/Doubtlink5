const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
  senior: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, default: 0 },
  rank: { type: Number }, // optional, can be calculated dynamically
}, { timestamps: true });

// Pre-save hook to automatically update points from senior user
leaderboardSchema.pre("save", async function(next) {
  try {
    const User = require("./User");
    const seniorUser = await User.findById(this.senior);
    if (seniorUser) {
      this.points = seniorUser.points; // sync points with User
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Static method to fetch leaderboard sorted by points
leaderboardSchema.statics.getTopSeniors = async function(limit = 10) {
  return this.find()
    .populate("senior", "name points badges")
    .sort({ points: -1 })
    .limit(limit);
};

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
