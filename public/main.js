// public/main.js
const API_BASE = ""; // same origin (your backend + frontend served together)
let token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("user")) || null;

// ---------------- AUTH ----------------

// Signup
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("username").value;
  const email = document.getElementById("email")?.value || prompt("Enter email:"); // adjust if missing
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const year = document.getElementById("year").value;
  const course = document.getElementById("course").value;

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
  const email = document.getElementById("username").value; // backend expects email
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
async function postDoubt() {
  const input = document.getElementById("doubtInput");
  if (!input || input.value.trim() === "") return alert("Enter a doubt first!");
  try {
    const res = await fetch(`${API_BASE}/doubts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "Doubt", description: input.value }),
    });
    const data = await res.json();
    if (res.ok) {
      input.value = "";
      loadDoubts();
    } else {
      alert(data.error || "Failed to post doubt");
    }
  } catch (err) {
    console.error(err);
    alert("Error posting doubt");
  }
}

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
        <h4>${d.title}</h4>
        <p>${d.description}</p>
        <p><strong>Asked by:</strong> ${d.askedBy?.name}</p>
        <p><strong>Answer:</strong> ${d.answer || "<em>Not answered yet</em>"}</p>
        ${d.meetingLink ? `<a href="${d.meetingLink}" target="_blank" class="meeting-btn">Join Meeting</a>` : ""}
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

// ---------------- SENIOR ----------------
async function answerDoubt(doubtId) {
  const answer = prompt("Enter your answer:");
  if (!answer) return;
  try {
    const res = await fetch(`${API_BASE}/doubts/${doubtId}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("Answer submitted ✅");
      loadDoubts();
    } else {
      alert(data.error || "Failed to answer");
    }
  } catch (err) {
    console.error(err);
    alert("Error answering doubt");
  }
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
    } else {
      alert(data.error || "Failed to start meeting");
    }
  } catch (err) {
    console.error(err);
    alert("Error starting meeting");
  }
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
      let badgeStars = "★".repeat(entry.badges || 0);
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.senior?.name || "Unknown"}</td>
        <td>${entry.points}</td>
        <td style="color: gold;">${badgeStars}</td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// ---------------- SOCKET.IO ----------------
const socket = io();

socket.on("receiveMessage", (msg) => {
  console.log("New message:", msg);
  // Optionally update chat UI
});

// ---------------- AUTO INIT ----------------
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("doubtList")) loadDoubts();
  if (document.getElementById("leaderboardTable")) loadLeaderboard();
});
