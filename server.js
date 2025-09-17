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
const fs = require("fs");

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// ---------------------- MIDDLEWARE ----------------------
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Serve uploaded images
app.use("/uploads", express.static(uploadsDir));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Serve frontend files
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ---------------------- MODELS ----------------------
const User = require("./models/User");
const Doubt = require("./models/Doubt");
const Message = require("./models/Message");
const Meeting = require("./models/Meeting");
const Leaderboard = require("./models/Leaderboard");

// ---------------------- MONGODB ----------------------
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ DB Error:", err));

// ---------------------- UTILS ----------------------
const generateToken = userId => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------------- ROUTES ----------------------
app.get("/api-test", (req, res) => res.send("DoubtLink backend is running ✅"));

// ---------- AUTH ----------
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, year, course } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role, year, course, points: 0, badges: 0 });
    const token = generateToken(user._id);
    res.json({ user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = generateToken(user._id);
    res.json({ user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- CURRENT USER ----------
app.get("/me", authenticate, async (req, res) => {
  const user = await User.findById(req.user._id, "-password");
  res.json(user);
});

// ---------- SENIORS ----------
app.get("/seniors", authenticate, async (req, res) => {
  try {
    const seniors = await User.find({ role: "senior" }, "name year course points badges");
    res.json(seniors);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- JUNIORS ----------
app.get("/juniors", authenticate, async (req, res) => {
  try {
    const juniors = await User.find({ role: "junior" }, "name year course");
    res.json(juniors);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- FILE UPLOAD ----------
app.post("/upload", authenticate, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------- DOUBTS ----------
app.post("/doubts", authenticate, upload.single("image"), async (req, res) => {
  try {
    if (req.user.role !== "junior") return res.status(403).json({ error: "Only juniors can post doubts" });
    const { text, senior } = req.body;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

    const doubt = await Doubt.create({
      text,
      askedBy: req.user._id,
      seniorAssigned: senior === "all" ? null : senior,
      imageUrl,
      messages: []
    });

    const populatedDoubt = await doubt.populate("askedBy", "name year course");

    // emit both events so juniors and seniors handle them
    io.emit("doubt:new", populatedDoubt);
    io.emit("receiveMessage", {
      doubtId: populatedDoubt._id,
      juniorName: populatedDoubt.askedBy.name,
      doubtText: populatedDoubt.text,
      imageUrl: populatedDoubt.imageUrl,
      seniorAssigned: populatedDoubt.seniorAssigned
    });

    res.json(populatedDoubt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/doubts", authenticate, async (req, res) => {
  try {
    const doubts = await Doubt.find()
      .populate("askedBy", "name year course")
      .populate("answeredBy", "name role");
    res.json(doubts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- ANSWER DOUBT ----------
app.post("/doubts/:id/answer", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "senior") return res.status(403).json({ error: "Only seniors can answer" });
    const { answer } = req.body;
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) return res.status(404).json({ error: "Doubt not found" });

    doubt.reply = answer;
    doubt.answeredBy = req.user._id;
    doubt.isSolved = true;
    await doubt.save();

    req.user.points += 1;
    await req.user.save();

    let leaderboard = await Leaderboard.findOne({ senior: req.user._id });
    if (!leaderboard) leaderboard = await Leaderboard.create({ senior: req.user._id, points: req.user.points });
    else { leaderboard.points = req.user.points; await leaderboard.save(); }

    io.emit("doubtReplied", doubt);

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

    io.emit("receiveMessage", {
      doubtId: doubt._id,
      senderId: req.user._id,
      message: `${req.user.name} started a meeting.`,
      type: "meeting-invite",
      meetingLink
    });

    res.json({ message: "Meeting started ✅", meetingLink });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- LEADERBOARD ----------
app.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await Leaderboard.find()
      .populate("senior", "name points badges")
      .sort({ points: -1 });
    res.json(leaderboard);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- CHAT SOCKET.IO ----------
io.on("connection", socket => {
  console.log("⚡ New client connected:", socket.id);

  socket.on("sendMessage", async data => {
    const { doubtId, senderId, message, type, meetingLink, imageUrl } = data;
    const chatMsg = await Message.create({ doubtId, sender: senderId, message, type, meetingLink, imageUrl });
    io.emit("receiveMessage", chatMsg);
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// ---------- FRONTEND ROUTES ----------
app.use((req, res, next) => {
  const apiPaths = ["/api", "/uploads", "/signup", "/login", "/doubts", "/leaderboard", "/start-meeting", "/juniors"];
  if (apiPaths.some(p => req.path.startsWith(p))) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---------------------- START SERVER ----------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
