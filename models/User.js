const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["junior", "senior"], required: true },
  year: { type: Number },
  course: { type: String },
  points: { type: Number, default: 0 }, // Points earned by senior
  badges: [{ type: String }], // Badge names, e.g., ["Bronze", "Silver"]
}, { timestamps: true });

// Virtual to calculate badge count dynamically
userSchema.virtual("badgeCount").get(function () {
  if (this.points >= 18) return 3;
  if (this.points >= 9) return 2;
  if (this.points >= 3) return 1;
  return 0;
});

// Auto-populate badges array if needed
userSchema.pre("save", function(next) {
  const count = this.badgeCount;
  const badgeNames = ["Bronze", "Silver", "Gold"];
  this.badges = badgeNames.slice(0, count);
  next();
});

module.exports = mongoose.model("User", userSchema);
