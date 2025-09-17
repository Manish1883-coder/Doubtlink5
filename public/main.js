// public/main.js
const API_BASE = "https://doubtlink5.onrender.com"; // same origin (frontend + backend served together)
let token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("user")) || null;

// ---------------- AUTH ----------------

// Signup
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email")?.value || prompt("Enter email:");
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const year = document.getElementById("year")?.value || "";
  const course = document.getElementById("course")?.value || "";

  try {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, year, course }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = data.user.role === "junior" ? "junior.html" : "senior.html";
    } else {
      alert(data.error || "Signup failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error during signup");
  }
});

// Login
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = data.user.role === "junior" ? "junior.html" : "senior.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error during login");
  }
});

// ---------------- JUNIOR ----------------

// Load current user profile
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed to load profile");
    currentUser = await res.json();
    document.getElementById("juniorName")?.innerText = currentUser.name || "N/A";
    document.getElementById("juniorYear")?.innerText = currentUser.year || "N/A";
    document.getElementById("juniorCourse")?.innerText = currentUser.course || "N/A";
  } catch (err) { console.error(err); }
}

// Load all seniors for dropdown
async function loadSeniors() {
  try {
    const res = await fetch(`${API_BASE}/seniors`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed to load seniors");
    const seniors = await res.json();
    const seniorSelect = document.getElementById("seniorSelect");
    if (!seniorSelect) return;

    seniorSelect.innerHTML = `<option value="all">All Seniors</option>`; // reset first

    seniors.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s._id;
      opt.innerText = `${s.name} (${s.year || "N/A"} - ${s.course || "N/A"})`;
      seniorSelect.appendChild(opt);
    });
  } catch (err) { console.error(err); }
}

// Post a new doubt
async function postDoubt() {
  const input = document.getElementById("doubtInput");
  const imageInput = document.getElementById("imageInput"); // file input
  const senior = document.getElementById("seniorSelect")?.value || "all";
  if (!input || (!input.value.trim() && (!imageInput || !imageInput.files[0]))) return alert("Enter a doubt or upload image");

  try {
    const formData = new FormData();
    formData.append("text", input.value);
    formData.append("senior", senior);
    if (imageInput && imageInput.files[0]) formData.append("image", imageInput.files[0]);

    const res = await fetch(`${API_BASE}/doubts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      input.value = "";
      if (imageInput) imageInput.value = "";
      loadDoubts();
    } else {
      alert(data.error || "Failed to post doubt");
    }
  } catch (err) {
    console.error(err);
    alert("Error posting doubt");
  }
}

// Load doubts
async function loadDoubts() {
  const list = document.getElementById("doubtList");
  if (!list) return;
  try {
    const res = await fetch(`${API_BASE}/doubts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const doubts = await res.json();
    list.innerHTML = "<h2>Your Doubts & Answers</h2>";
    doubts.forEach((d) => {
      const div = document.createElement("div");
      div.className = "doubt-card";
      div.innerHTML = `
        <h4>${d.title || "Doubt"}</h4>
        <p>${d.text || d.description}</p>
        ${d.imageUrl ? `<img src="${d.imageUrl}" alt="Doubt Image" style="max-width:200px; display:block; margin-top:0.5rem;">` : ""}
        <p><strong>Asked by:</strong> ${d.askedBy?.name}</p>
        <p><strong>Assigned to:</strong> ${d.seniorAssigned?.name || "All Seniors"}</p>
        <p><strong>Answer:</strong> ${d.reply || "<em>Not answered yet</em>"}</p>
        ${d.meetingLink ? `<a href="${d.meetingLink}" target="_blank" class="meeting-btn">Join Meeting</a>` : ""}
      `;
      list.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

// ---------------- SENIOR ----------------
async function answerDoubt(doubtId) {
  const answer = prompt("Enter your answer:");
  if (!answer) return;
  try {
    const res = await fetch(`${API_BASE}/doubts/${doubtId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("Answer submitted ✅");
      loadDoubts();
      loadLeaderboard();
    } else {
      alert(data.error || "Failed to answer");
    }
  } catch (err) { console.error(err); alert("Error answering doubt"); }
}

async function startMeeting(doubtId) {
  try {
    const res = await fetch(`${API_BASE}/start-meeting/${doubtId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      window.open(data.meetingLink, "_blank");
      loadDoubts(); // refresh to show link
    } else {
      alert(data.error || "Failed to start meeting");
    }
  } catch (err) { console.error(err); alert("Error starting meeting"); }
}

// ---------------- LEADERBOARD ----------------
async function loadLeaderboard() {
  const tableBody = document.querySelector("#leaderboardTable tbody");
  if (!tableBody) return;
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const leaders = await res.json();
    tableBody.innerHTML = "";
    leaders.forEach((entry, index) => {
      const tr = document.createElement("tr");
      if (index === 0) tr.className = "top1";
      else if (index === 1) tr.className = "top2";
      else if (index === 2) tr.className = "top3";
      let badgeStars = "★".repeat(entry.senior?.badges || 0);
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.senior?.name || "Unknown"}</td>
        <td>${entry.points}</td>
        <td style="color: gold; font-size: 1.2rem;">${badgeStars}</td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

// ---------------- SOCKET.IO ----------------
const socket = io();

socket.on("receiveMessage", (msg) => {
  console.log("New message:", msg);

  // If meeting started, refresh doubts
  if (msg.type === "meeting-invite") {
    loadDoubts();
  }

  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `
    <strong>${msg.senderName || "User"}:</strong> ${msg.message || ""}
    ${msg.imageUrl ? `<br><img src="${msg.imageUrl}" alt="image" style="max-width:150px;">` : ""}
    ${msg.meetingLink ? `<br><a href="${msg.meetingLink}" target="_blank">Join Meeting</a>` : ""}
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// ---------------- AUTO INIT ----------------
window.addEventListener("DOMContentLoaded", () => {
  loadProfile(); // always load profile
  if (document.getElementById("doubtList")) {
    loadSeniors();
    loadDoubts();
  }
  if (document.getElementById("leaderboardTable")) loadLeaderboard();
});
