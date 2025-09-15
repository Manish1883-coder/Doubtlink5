// ---------------------- IMPORTS ----------------------
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// ---------------------- MIDDLEWARE ----------------------
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // serve uploaded images

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Serve frontend files from "public"
app.use(express.static(path.join(__dirname, "public")));

// ---------------------- MODELS ----------------------
const User = require("./models/User");
const Doubt = require("./models/Doubt");
const Message = require("./models/Message");
const Meeting = require("./models/Meeting");
const Leaderboard = require("./models/Leaderboard");

// ---------------------- MONGODB CONNECTION ----------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ DB Error:", err));

// ---------------------- UTILITY FUNCTIONS ----------------------
const generateToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// JWT Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------------- ROUTES ----------------------

// Test route
app.get("/api-test", (req, res) => res.send("DoubtLink backend is running ✅"));

// ---------- AUTH ----------
// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, year, course } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role, year, course });
    const token = generateToken(user._id);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = generateToken(user._id);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DOUBTS ----------
app.post("/doubts", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "junior") return res.status(403).json({ error: "Only juniors can post doubts" });
    const { title, description } = req.body;
    const doubt = await Doubt.create({ title, description, askedBy: req.user._id });
    res.json(doubt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/doubts", authenticate, async (req, res) => {
  try {
    const doubts = await Doubt.find().populate("askedBy", "name role").populate("answeredBy", "name role");
    res.json(doubts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/doubts/:id/answer", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "senior") return res.status(403).json({ error: "Only seniors can answer" });
    const { answer } = req.body;
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) return res.status(404).json({ error: "Doubt not found" });

    doubt.answer = answer;
    doubt.answeredBy = req.user._id;
    doubt.isSolved = true;
    await doubt.save();

    req.user.points += 1;
    await req.user.save();

    let leaderboard = await Leaderboard.findOne({ senior: req.user._id });
    if (!leaderboard) leaderboard = await Leaderboard.create({ senior: req.user._id, points: req.user.points });
    else { leaderboard.points = req.user.points; await leaderboard.save(); }

    res.json(doubt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- START MEETING ----------
app.post("/start-meeting/:doubtId", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "senior") return res.status(403).json({ error: "Only seniors can start meetings" });
    const doubt = await Doubt.findById(req.params.doubtId);
    if (!doubt) return res.status(404).json({ error: "Doubt not found" });

    const meetingLink = `https://meet.jit.si/DoubtLink-${doubt._id}-${Date.now()}`;
    doubt.meetingLink = meetingLink;
    await doubt.save();

    await Meeting.create({
      doubtId: doubt._id,
      createdBy: req.user._id,
      meetingLink
    });

    await Message.create({
      doubtId: doubt._id,
      sender: req.user._id,
      type: "meeting-invite",
      meetingLink,
      message: `${req.user.name} started a meeting for this doubt.`
    });

    res.json({ message: "Meeting started ✅", meetingLink });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- LEADERBOARD ----------
app.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await Leaderboard.find().populate("senior", "name points badges").sort({ points: -1 });
    res.json(leaderboard);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- CHAT SOCKET.IO ----------
io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  socket.on("sendMessage", async (data) => {
    const { doubtId, senderId, message, type, meetingLink, imageUrl } = data;
    const chatMsg = await Message.create({ doubtId, sender: senderId, message, type, meetingLink, imageUrl });
    io.emit("receiveMessage", chatMsg);
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// ---------- FRONTEND ROUTES ----------
app.get(/^\/(?!api|signup|login|doubts|leaderboard|start-meeting).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------- START SERVER ----------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
