// State
let currentUser = null;
let liveEvents = null;
let seenChatMessageIds = new Set();

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

async function apiCall(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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

async function checkSkillIssue() {
  if (!currentUser) return;

  try {
    const result = await apiCall(`/check-predictions/${currentUser.id}`);
    if (result.badPredictionCount > 0) {
      skillIssueAlert.innerHTML = `
        <span>Skill issue detected!</span><br>
        <small>${result.badPredictionCount} of ${result.totalPredictions} predictions were way off.</small>
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

logoutBtn.addEventListener("click", () => {
  currentUser = null;
  authPage.style.display = "flex";
  mainPage.style.display = "none";
  loginTab.click();
  skillIssueAlert.style.display = "none";
  disconnectLiveEvents();
});

leaderboardBtn.addEventListener("click", () => {
  homePage.style.display = "none";
  leaderboardPage.style.display = "block";
  loadLeaderboard();
});

homeBtn.addEventListener("click", () => {
  leaderboardPage.style.display = "none";
  homePage.style.display = "block";
});

function showMainPage() {
  authPage.style.display = "none";
  mainPage.style.display = "block";
  userDisplay.textContent = currentUser.isAdmin ? `${currentUser.username} Admin` : currentUser.username;
  loadMatches();
  loadPredictions();
  loadChat();
  connectLiveEvents();
}

function connectLiveEvents() {
  disconnectLiveEvents();

  liveEvents = new EventSource("/events");

  liveEvents.addEventListener("chat", (event) => {
    appendChatMessage(JSON.parse(event.data));
  });

  liveEvents.addEventListener("score", () => {
    loadMatches();
    loadPredictions();
    loadLeaderboard();
    checkSkillIssue();
  });

  liveEvents.onerror = () => {
    console.error("Live updates disconnected. Browser will retry automatically.");
  };
}

function disconnectLiveEvents() {
  if (liveEvents) {
    liveEvents.close();
    liveEvents = null;
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadMatches() {
  try {
    const matches = await apiCall("/matches");
    renderMatches(matches);
  } catch (error) {
    matchesList.innerHTML = '<p class="empty-state">Unable to load matches</p>';
  }
}

function renderMatches(matches) {
  if (!matches.length) {
    matchesList.innerHTML = '<p class="empty-state">No matches available</p>';
    return;
  }

  matchesList.innerHTML = matches.map((match) => `
    <div class="match-card">
      <div class="match-info">
        <div class="match-teams">
          <div class="team home-team">
            <span class="flag">${match.homeFlag || ""}</span>
            <span class="team-name">${match.homeTeam}</span>
          </div>
          <div class="vs-badge">VS</div>
          <div class="team away-team">
            <span class="team-name">${match.awayTeam}</span>
            <span class="flag">${match.awayFlag || ""}</span>
          </div>
        </div>
        <p class="match-details">${formatDate(match.date)}</p>
        <p class="match-details">${match.stage}</p>
        ${renderMatchResult(match)}
      </div>
      <form class="prediction-form" data-match-id="${match.id}">
        <div class="prediction-inputs">
          <input type="number" min="0" max="10" placeholder="0" required />
          <span class="score-divider">:</span>
          <input type="number" min="0" max="10" placeholder="0" required />
        </div>
        <button type="submit" class="predict-btn">Predict</button>
        <p class="form-message"></p>
      </form>
      ${renderResultForm(match)}
    </div>
  `).join("");

  document.querySelectorAll(".prediction-form").forEach((form) => {
    form.addEventListener("submit", submitPrediction);
  });

  document.querySelectorAll(".result-form").forEach((form) => {
    form.addEventListener("submit", submitResult);
  });
}

function renderMatchResult(match) {
  if (!match.result || match.result.homeScore === null || match.result.awayScore === null) {
    return "";
  }

  return `<p class="match-details live-score">Final: ${match.homeTeam} ${match.result.homeScore} - ${match.result.awayScore} ${match.awayTeam}</p>`;
}

function renderResultForm(match) {
  if (!currentUser || !currentUser.isAdmin) return "";

  const homeValue = match.result && match.result.homeScore !== null ? match.result.homeScore : "";
  const awayValue = match.result && match.result.awayScore !== null ? match.result.awayScore : "";

  return `
    <form class="result-form" data-match-id="${match.id}">
      <p class="admin-label">Admin result</p>
      <div class="prediction-inputs">
        <input type="number" min="0" max="20" placeholder="0" value="${homeValue}" required />
        <span class="score-divider">:</span>
        <input type="number" min="0" max="20" placeholder="0" value="${awayValue}" required />
      </div>
      <button type="submit" class="result-btn">Announce result and award points</button>
      <p class="form-message"></p>
    </form>
  `;
}

async function submitPrediction(event) {
  event.preventDefault();

  if (!currentUser) {
    alert("You must be logged in to make predictions");
    return;
  }

  const form = event.target;
  const inputs = form.querySelectorAll("input[type='number']");
  const messageDiv = form.querySelector(".form-message");

  try {
    messageDiv.textContent = "Submitting...";

    await apiCall("/predict", {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        matchId: Number(form.dataset.matchId),
        homeScore: Number(inputs[0].value),
        awayScore: Number(inputs[1].value)
      })
    });

    matchesList.classList.add("shake-animation");
    setTimeout(() => {
      matchesList.classList.remove("shake-animation");
    }, 500);

    messageDiv.textContent = "Prediction saved. Points are awarded after the final result.";
    form.reset();

    setTimeout(() => {
      messageDiv.textContent = "";
      loadPredictions();
    }, 2000);
  } catch (error) {
    messageDiv.textContent = error.message;
  }
}

async function submitResult(event) {
  event.preventDefault();

  const form = event.target;
  const inputs = form.querySelectorAll("input[type='number']");
  const messageDiv = form.querySelector(".form-message");

  try {
    messageDiv.textContent = "Announcing result...";
    const result = await apiCall(`/scores/${form.dataset.matchId}`, {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        homeScore: Number(inputs[0].value),
        awayScore: Number(inputs[1].value)
      })
    });

    const awardedCount = result.awardedPredictions.filter((prediction) => prediction.points > 0).length;
    messageDiv.textContent = `Result announced. ${awardedCount} prediction(s) got points.`;
    loadMatches();
    loadPredictions();
    loadLeaderboard();
  } catch (error) {
    messageDiv.textContent = error.message;
  }
}

async function loadPredictions() {
  try {
    const predictions = await apiCall("/predictions");
    renderPredictions(predictions);
  } catch (error) {
    predictionsList.innerHTML = '<p class="empty-state">Unable to load predictions</p>';
  }
}

function renderPredictions(predictions) {
  if (!predictions.length) {
    predictionsList.innerHTML = '<p class="empty-state">No predictions yet. Be the first to predict!</p>';
    return;
  }

  predictionsList.innerHTML = predictions.slice(0, 10).map((pred) => `
    <div class="prediction-item">
      <strong>${pred.username}</strong>
      <div class="prediction-match">
        <span class="flag-team">${pred.match.homeFlag || ""} ${pred.match.homeTeam}</span>
        <span class="prediction-score">${pred.homeScore} - ${pred.awayScore}</span>
        <span class="flag-team">${pred.match.awayTeam} ${pred.match.awayFlag || ""}</span>
      </div>
      <small class="prediction-result">${pred.predictedWinner}</small>
      <small class="prediction-result points-result">${pred.awardedPoints || 0} pts awarded</small>
    </div>
  `).join("");
}

async function loadLeaderboard() {
  try {
    const leaderboard = await apiCall("/leaderboard");
    renderLeaderboard(leaderboard);
  } catch (error) {
    leaderboardList.innerHTML = '<p class="empty-state">Unable to load leaderboard</p>';
  }
}

function renderLeaderboard(leaderboard) {
  if (!leaderboard.length) {
    leaderboardList.innerHTML = '<p class="empty-state">No predictions yet</p>';
    return;
  }

  leaderboardList.innerHTML = leaderboard.map((entry, index) => {
    const rank = index + 1;
    const isCurrentUser = currentUser && currentUser.username === entry.username ? " Current" : "";

    return `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#${rank}</div>
        <div class="leaderboard-name">${entry.username}${isCurrentUser}</div>
        <div class="leaderboard-points">${entry.points} pts</div>
      </div>
    `;
  }).join("");
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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
  } catch (error) {
    console.error("Chat error:", error);
  }
});

async function loadChat() {
  try {
    const messages = await apiCall("/chat");
    renderChat(messages);
  } catch (error) {
    console.error("Error loading chat:", error);
  }
}

function renderChat(messages) {
  seenChatMessageIds = new Set();

  if (!messages.length) {
    chatMessages.innerHTML = '<p class="empty-state">No messages yet. Start the conversation!</p>';
    return;
  }

  chatMessages.innerHTML = messages.map(createChatMessageHtml).join("");
  messages.forEach((message) => seenChatMessageIds.add(message.id));
  scrollChatToBottom();
}

function appendChatMessage(message) {
  if (seenChatMessageIds.has(message.id)) return;

  const emptyState = chatMessages.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  chatMessages.insertAdjacentHTML("beforeend", createChatMessageHtml(message));
  seenChatMessageIds.add(message.id);
  scrollChatToBottom();
}

function createChatMessageHtml(msg) {
  const messageClass = msg.type === "score" ? "chat-message score-announcement" : "chat-message";

  return `
    <div class="${messageClass}">
      <strong>${escapeHtml(msg.username)}</strong>
      <p>${escapeHtml(msg.message)}</p>
      <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
    </div>
  `;
}

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(text).replace(/[&<>"']/g, (match) => map[match]);
}

function init() {
  authPage.style.display = "flex";
  mainPage.style.display = "none";
}

init();
