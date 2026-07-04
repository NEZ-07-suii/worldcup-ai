// State
let currentUser = null;
let chatRefreshInterval = null;

// DOM Elements
const authPage = document.getElementById("authPage");
const mainPage = document.getElementById("mainPage");
const homePage = document.getElementById("homePage");
const leaderboardPage = document.getElementById("leaderboardPage");
const skillIssueAlert = document.getElementById("skillIssueAlert");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const matchesList = document.getElementById("matchesList");
const predictionsList = document.getElementById("predictionsList");
const leaderboardList = document.getElementById("leaderboardList");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const userDisplay = document.getElementById("userDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const homeBtn = document.getElementById("homeBtn");

// API Helper
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Auth Tabs
loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.style.display = "block";
  registerForm.style.display = "none";
  document.getElementById("loginError").textContent = "";
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.style.display = "block";
  loginForm.style.display = "none";
  document.getElementById("registerError").textContent = "";
});

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  const errorDiv = document.getElementById("loginError");

  try {
    const result = await apiCall("/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    currentUser = result.user;
    loginForm.reset();
    checkSkillIssue();
    showMainPage();
  } catch (error) {
    errorDiv.textContent = error.message;
  }
});

// Register
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("registerUsername").value;
  const password = document.getElementById("registerPassword").value;
  const errorDiv = document.getElementById("registerError");

  try {
    const result = await apiCall("/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    currentUser = result.user;
    registerForm.reset();
    showMainPage();
  } catch (error) {
    errorDiv.textContent = error.message;
  }
});

// Check for skill issue
async function checkSkillIssue() {
  try {
    const result = await apiCall(`/check-predictions/${currentUser.id}`);
    if (result.badPredictionCount > 0) {
      skillIssueAlert.innerHTML = `
        <span>⚠️ SKILL ISSUE DETECTED!</span><br>
        <small>You got ${result.badPredictionCount} out of ${result.totalPredictions} predictions WAY OFF 💀</small>
      `;
      skillIssueAlert.style.display = "block";
      setTimeout(() => {
        skillIssueAlert.style.display = "none";
      }, 8000);
    }
  } catch (error) {
    console.error("Error checking predictions:", error);
  }
}

// Logout
logoutBtn.addEventListener("click", () => {
  currentUser = null;
  authPage.style.display = "flex";
  mainPage.style.display = "none";
  loginTab.click();
  skillIssueAlert.style.display = "none";
  clearInterval(chatRefreshInterval);
});

// Navigation
leaderboardBtn.addEventListener("click", () => {
  homePage.style.display = "none";
  leaderboardPage.style.display = "block";
  loadLeaderboard();
});

homeBtn.addEventListener("click", () => {
  leaderboardPage.style.display = "none";
  homePage.style.display = "block";
});

// Show Main Page
function showMainPage() {
  authPage.style.display = "none";
  mainPage.style.display = "block";
  userDisplay.textContent = `👤 ${currentUser.username}`;
  loadMatches();
  loadPredictions();
  loadChat();
  chatRefreshInterval = setInterval(loadChat, 3000);
}

// Format Date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Load Matches
async function loadMatches() {
  try {
    const matches = await apiCall("/matches");
    renderMatches(matches);
  } catch (error) {
    matchesList.innerHTML = '<p class="empty-state">Unable to load matches</p>';
  }
}

// Render Matches
function renderMatches(matches) {
  if (!matches.length) {
    matchesList.innerHTML = '<p class="empty-state">No matches available</p>';
    return;
  }

  matchesList.innerHTML = matches
    .map((match) => `
      <div class="match-card">
        <div class="match-info">
          <div class="match-teams">
            <div class="team home-team">
              <span class="flag">${match.homeFlag}</span>
              <span class="team-name">${match.homeTeam}</span>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team away-team">
              <span class="team-name">${match.awayTeam}</span>
              <span class="flag">${match.awayFlag}</span>
            </div>
          </div>
          <p class="match-details">📅 ${formatDate(match.date)}</p>
          <p class="match-details">🏟️ ${match.stage}</p>
        </div>
        <form class="prediction-form" data-match-id="${match.id}">
          <div class="prediction-inputs">
            <input type="number" min="0" max="10" placeholder="0" required />
            <span class="score-divider">:</span>
            <input type="number" min="0" max="10" placeholder="0" required />
          </div>
          <button type="submit" class="predict-btn">⚽ Predict</button>
          <p class="form-message"></p>
        </form>
      </div>
    `)
    .join("");

  // Add prediction form handlers
  document.querySelectorAll(".prediction-form").forEach((form) => {
    form.addEventListener("submit", submitPrediction);
  });
}

// Submit Prediction with shake animation
async function submitPrediction(e) {
  e.preventDefault();

  if (!currentUser) {
    alert("You must be logged in to make predictions");
    return;
  }

  const form = e.target;
  const inputs = form.querySelectorAll("input[type='number']");
  const homeScore = inputs[0].value;
  const awayScore = inputs[1].value;
  const matchId = form.dataset.matchId;
  const messageDiv = form.querySelector(".form-message");

  try {
    messageDiv.textContent = "Submitting...";

    const result = await apiCall("/predict", {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        matchId: Number(matchId),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore)
      })
    });

    // Trigger shake animation
    matchesList.classList.add("shake-animation");
    setTimeout(() => {
      matchesList.classList.remove("shake-animation");
    }, 500);

    messageDiv.textContent = `✓ Prediction saved! +5 points (Total: ${result.userPoints}) 🔥`;
    currentUser.points = result.userPoints;
    userDisplay.textContent = `👤 ${currentUser.username}`;
    form.reset();

    setTimeout(() => {
      messageDiv.textContent = "";
      loadPredictions();
    }, 2000);
  } catch (error) {
    messageDiv.textContent = error.message;
  }
}

// Load Predictions
async function loadPredictions() {
  try {
    const predictions = await apiCall("/predictions");
    renderPredictions(predictions);
  } catch (error) {
    predictionsList.innerHTML = '<p class="empty-state">Unable to load predictions</p>';
  }
}

// Render Predictions
function renderPredictions(predictions) {
  if (!predictions.length) {
    predictionsList.innerHTML = '<p class="empty-state">No predictions yet. Be the first to predict!</p>';
    return;
  }

  predictionsList.innerHTML = predictions
    .slice(0, 10)
    .map((pred) => `
      <div class="prediction-item">
        <strong>${pred.username}</strong>
        <div class="prediction-match">
          <span class="flag-team">${pred.match.homeFlag} ${pred.match.homeTeam}</span>
          <span class="prediction-score">${pred.homeScore} - ${pred.awayScore}</span>
          <span class="flag-team">${pred.match.awayTeam} ${pred.match.awayFlag}</span>
        </div>
        <small class="prediction-result">${pred.predictedWinner}</small>
      </div>
    `)
    .join("");
}

// Load Leaderboard
async function loadLeaderboard() {
  try {
    const leaderboard = await apiCall("/leaderboard");
    renderLeaderboard(leaderboard);
  } catch (error) {
    leaderboardList.innerHTML = '<p class="empty-state">Unable to load leaderboard</p>';
  }
}

// Render Leaderboard
function renderLeaderboard(leaderboard) {
  if (!leaderboard.length) {
    leaderboardList.innerHTML = '<p class="empty-state">No predictions yet</p>';
    return;
  }

  leaderboardList.innerHTML = leaderboard
    .map((entry, index) => {
      let medalClass = "";
      let medal = "";
      if (index === 0) {
        medalClass = "gold";
        medal = "🥇";
      } else if (index === 1) {
        medalClass = "silver";
        medal = "🥈";
      } else if (index === 2) {
        medalClass = "bronze";
        medal = "🥉";
      } else {
        medal = "#" + (index + 1);
      }

      const isCurrentUser = currentUser && currentUser.username === entry.username ? " ⭐" : "";

      return `
        <div class="leaderboard-item">
          <div class="leaderboard-rank ${medalClass}">${medal}</div>
          <div class="leaderboard-name">${entry.username}${isCurrentUser}</div>
          <div class="leaderboard-points">⭐ ${entry.points} pts</div>
        </div>
      `;
    })
    .join("");
}

// Chat functionality
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!chatInput.value.trim()) return;

  try {
    await apiCall("/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        username: currentUser.username,
        message: chatInput.value
      })
    });

    chatInput.value = "";
    loadChat();
  } catch (error) {
    console.error("Chat error:", error);
  }
});

// Load Chat
async function loadChat() {
  try {
    const messages = await apiCall("/chat");
    renderChat(messages);
  } catch (error) {
    console.error("Error loading chat:", error);
  }
}

// Render Chat
function renderChat(messages) {
  if (!messages.length) {
    chatMessages.innerHTML = '<p class="empty-state">No messages yet. Start the conversation!</p>';
    return;
  }

  chatMessages.innerHTML = messages
    .map((msg) => `
      <div class="chat-message">
        <strong>${msg.username}</strong>
        <p>${escapeHtml(msg.message)}</p>
        <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
      </div>
    `)
    .join("");

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Escape HTML to prevent injection
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Initialize
function init() {
  authPage.style.display = "flex";
  mainPage.style.display = "none";
}

init();
