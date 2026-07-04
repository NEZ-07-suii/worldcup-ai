// State
let currentUser = null;
let liveEvents = null;
let seenChatMessageIds = new Set();
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartedAt = 0;

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
const liveUpdateText = document.getElementById("liveUpdateText");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const emojiButtons = document.querySelectorAll(".emoji-btn");

const userDisplay = document.getElementById("userDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const heroLeaderboardBtn = document.getElementById("heroLeaderboardBtn");
const homeBtn = document.getElementById("homeBtn");

const teamCodes = {
  Argentina: { display: "ARG", flag: "ar" },
  Belgium: { display: "BEL", flag: "be" },
  Brazil: { display: "BRA", flag: "br" },
  Canada: { display: "CAN", flag: "ca" },
  Colombia: { display: "COL", flag: "co" },
  Egypt: { display: "EGY", flag: "eg" },
  England: { display: "ENG", flag: "gb-eng" },
  France: { display: "FRA", flag: "fr" },
  Mexico: { display: "MEX", flag: "mx" },
  Morocco: { display: "MAR", flag: "ma" },
  Norway: { display: "NOR", flag: "no" },
  Paraguay: { display: "PAR", flag: "py" },
  Portugal: { display: "POR", flag: "pt" },
  Spain: { display: "ESP", flag: "es" },
  Switzerland: { display: "SUI", flag: "ch" },
  USA: { display: "USA", flag: "us" }
};

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
  showLeaderboardPage();
});

if (heroLeaderboardBtn) {
  heroLeaderboardBtn.addEventListener("click", () => {
    showLeaderboardPage();
  });
}

function showLeaderboardPage() {
  homePage.style.display = "none";
  leaderboardPage.style.display = "block";
  loadLeaderboard();
}

homeBtn.addEventListener("click", () => {
  leaderboardPage.style.display = "none";
  homePage.style.display = "block";
});

function showMainPage() {
  authPage.style.display = "none";
  mainPage.style.display = "block";
  userDisplay.innerHTML = renderUsername(currentUser.username, currentUser.isAdmin);
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

  liveEvents.addEventListener("score", (event) => {
    const update = JSON.parse(event.data);
    renderLiveScoreUpdate(update);
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
          ${renderTeam(match.homeTeam, "home-team")}
          <div class="vs-badge">VS</div>
          ${renderTeam(match.awayTeam, "away-team")}
        </div>
        <p class="match-details">${formatDate(match.date)}</p>
        <p class="match-details">${match.stage}</p>
        ${renderMatchResult(match)}
      </div>
      ${renderPredictionForm(match)}
      ${renderResultForm(match)}
    </div>
  `).join("");

  renderLatestMatchUpdate(matches);

  document.querySelectorAll(".prediction-form").forEach((form) => {
    form.addEventListener("submit", submitPrediction);
  });

  document.querySelectorAll(".result-form").forEach((form) => {
    form.addEventListener("submit", submitResult);
  });
}

function renderTeam(teamName, className = "") {
  return `
    <div class="team ${className}">
      ${renderFlag(teamName)}
      <span class="team-name">${escapeHtml(teamName)}</span>
    </div>
  `;
}

function getTeamCode(teamName) {
  return getTeamMeta(teamName).display;
}

function getTeamMeta(teamName) {
  const fallback = String(teamName || "").slice(0, 3).toUpperCase();
  return teamCodes[teamName] || { display: fallback, flag: "" };
}

function renderFlag(teamName, extraClass = "") {
  const meta = getTeamMeta(teamName);
  const flagImg = meta.flag
    ? `<img src="https://flagcdn.com/w80/${meta.flag}.png" alt="${escapeHtml(teamName)} flag" loading="lazy" />`
    : "";

  return `<span class="flag-badge ${extraClass}" title="${escapeHtml(teamName)}">${flagImg}<span>${meta.display}</span></span>`;
}

function renderPredictionForm(match) {
  if (currentUser && currentUser.isAdmin) {
    return `<p class="admin-only-note">Host mode: post the final score after the match.</p>`;
  }

  return `
    <form class="prediction-form" data-match-id="${match.id}">
      <div class="prediction-inputs">
        <input type="number" min="0" max="10" placeholder="0" required />
        <span class="score-divider">:</span>
        <input type="number" min="0" max="10" placeholder="0" required />
      </div>
      <button type="submit" class="predict-btn">Predict</button>
      <p class="form-message"></p>
    </form>
  `;
}

function renderMatchResult(match) {
  if (!match.result || match.result.homeScore === null || match.result.awayScore === null) {
    return `<p class="match-details pending-score">Awaiting final result. Predictions earn no points yet.</p>`;
  }

  return `<p class="match-details live-score">Final: ${match.homeTeam} ${match.result.homeScore} - ${match.result.awayScore} ${match.awayTeam}</p>`;
}

function renderResultForm(match) {
  if (!currentUser || !currentUser.isAdmin) return "";

  const homeValue = match.result && match.result.homeScore !== null ? match.result.homeScore : "";
  const awayValue = match.result && match.result.awayScore !== null ? match.result.awayScore : "";

  return `
    <form class="result-form" data-match-id="${match.id}">
      <p class="admin-label">Host result</p>
      <div class="prediction-inputs">
        <input type="number" min="0" max="20" placeholder="0" value="${homeValue}" required />
        <span class="score-divider">:</span>
        <input type="number" min="0" max="20" placeholder="0" value="${awayValue}" required />
      </div>
      <button type="submit" class="result-btn">Post result and award points</button>
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

    messageDiv.textContent = "Pick locked. Receipts open after the final result.";
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
    messageDiv.textContent = "Posting result...";
    const result = await apiCall(`/scores/${form.dataset.matchId}`, {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        homeScore: Number(inputs[0].value),
        awayScore: Number(inputs[1].value)
      })
    });

    const awardedCount = result.awardedPredictions.filter((prediction) => prediction.points > 0).length;
    messageDiv.textContent = `Result posted. ${awardedCount} prediction(s) got points.`;
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
    predictionsList.innerHTML = '<p class="empty-state">Receipts stay hidden until each result is posted.</p>';
    return;
  }

  const groupedPredictions = groupPredictionsByMatch(predictions);
  predictionsList.innerHTML = groupedPredictions.map(({ match, predictions: matchPredictions }) => `
    <article class="prediction-group">
      <div class="prediction-group-header">
        <div class="prediction-match-title">
          <span class="flag-team">${renderFlag(match.homeTeam, "mini")}${escapeHtml(match.homeTeam)}</span>
          <span class="prediction-score">vs</span>
          <span class="flag-team">${renderFlag(match.awayTeam, "mini")}${escapeHtml(match.awayTeam)}</span>
        </div>
        <small>${escapeHtml(match.stage || "Match")} predictions revealed</small>
      </div>
      <div class="prediction-group-list">
        ${matchPredictions.map(renderRevealedPrediction).join("")}
      </div>
    </article>
  `).join("");
}

function groupPredictionsByMatch(predictions) {
  const groups = new Map();

  predictions.forEach((prediction) => {
    const key = prediction.matchId;
    if (!groups.has(key)) {
      groups.set(key, { match: prediction.match, predictions: [] });
    }

    groups.get(key).predictions.push(prediction);
  });

  return Array.from(groups.values());
}

function renderRevealedPrediction(prediction) {
  return `
    <div class="prediction-item">
      <strong>${escapeHtml(prediction.username)}</strong>
      <div class="prediction-pick">
        <span>${prediction.homeScore} - ${prediction.awayScore}</span>
        <small>${prediction.predictedWinner}</small>
      </div>
      <small class="prediction-result points-result">${prediction.awardedPoints || 0} pts awarded</small>
    </div>
  `;
}

function renderLiveScoreUpdate(update) {
  if (!liveUpdateText || !update || !update.match) return;
  liveUpdateText.textContent = `${update.match.homeTeam} ${update.homeScore} - ${update.awayScore} ${update.match.awayTeam}. Leaderboard refreshed.`;
}

function renderLatestMatchUpdate(matches) {
  if (!liveUpdateText) return;

  const latestFinal = matches.find((match) => match.result && match.result.homeScore !== null && match.result.awayScore !== null);
  if (!latestFinal) {
    liveUpdateText.textContent = "Final scores and points land here when the result is posted.";
    return;
  }

  liveUpdateText.textContent = `Latest final: ${latestFinal.homeTeam} ${latestFinal.result.homeScore} - ${latestFinal.result.awayScore} ${latestFinal.awayTeam}.`;
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
    const isCurrentUser = currentUser && currentUser.username === entry.username;
    const medalClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
    const itemClass = rank === 1 ? "leaderboard-item champion-item" : "leaderboard-item";
    const label = rank === 1 ? '<span class="champion-badge">Main Character</span>' : "";
    const currentBadge = isCurrentUser ? '<span class="current-badge">You</span>' : "";

    return `
      <div class="${itemClass}">
        <div class="leaderboard-rank ${medalClass}">#${rank}</div>
        <div class="leaderboard-name">${escapeHtml(entry.username)} ${label} ${currentBadge}</div>
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
        message: chatInput.value
      })
    });

    chatInput.value = "";
  } catch (error) {
    console.error("Chat error:", error);
  }
});

emojiButtons.forEach((button) => {
  button.addEventListener("click", () => {
    insertEmoji(button.dataset.emoji);
  });
});

if (voiceBtn) {
  voiceBtn.addEventListener("click", toggleVoiceRecording);
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    voiceBtn.disabled = true;
    voiceBtn.title = "Voice notes are not supported in this browser";
  }
}

function insertEmoji(emoji) {
  const start = chatInput.selectionStart || chatInput.value.length;
  const end = chatInput.selectionEnd || chatInput.value.length;
  chatInput.value = `${chatInput.value.slice(0, start)}${emoji}${chatInput.value.slice(end)}`;
  chatInput.focus();
  chatInput.selectionStart = start + emoji.length;
  chatInput.selectionEnd = start + emoji.length;
}

async function loadChat() {
  try {
    const messages = await apiCall("/chat");
    renderChat(messages);
    renderChatComposer();
  } catch (error) {
    console.error("Error loading chat:", error);
  }
}

function renderChatComposer() {
  chatForm.style.display = "flex";
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
  const bodyHtml = msg.type === "voice" ? renderVoiceMessage(msg) : `<p>${escapeHtml(msg.message)}</p>`;

  return `
    <div class="${messageClass}">
      <strong>${renderUsername(msg.username, msg.username === "admin")}</strong>
      ${bodyHtml}
      <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
    </div>
  `;
}

function renderVoiceMessage(msg) {
  const caption = msg.message ? `<p>${escapeHtml(msg.message)}</p>` : "";
  const duration = msg.duration ? `<span>${Math.round(msg.duration)}s voice note</span>` : "<span>Voice note</span>";

  return `
    <div class="voice-message">
      ${caption}
      ${duration}
      <audio controls preload="none" src="${escapeAttribute(msg.audioData)}"></audio>
    </div>
  `;
}

async function toggleVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
    recordingStartedAt = Date.now();

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      sendVoiceNote(mediaRecorder.mimeType || "audio/webm");
    });

    mediaRecorder.start();
    voiceBtn.classList.add("recording");
    voiceBtn.textContent = "Stop";
    voiceStatus.textContent = "Recording voice note...";

    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
    }, 30000);
  } catch (error) {
    voiceStatus.textContent = "Microphone permission is needed for voice notes.";
  }
}

async function sendVoiceNote(audioType) {
  voiceBtn.classList.remove("recording");
  voiceBtn.textContent = "Mic";

  if (!recordedChunks.length) {
    voiceStatus.textContent = "No audio recorded.";
    return;
  }

  try {
    voiceStatus.textContent = "Sending voice note...";
    const audioBlob = new Blob(recordedChunks, { type: audioType });
    const audioData = await blobToDataUrl(audioBlob);
    const duration = Math.ceil((Date.now() - recordingStartedAt) / 1000);

    await apiCall("/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser.id,
        message: chatInput.value,
        audioData,
        audioType,
        duration
      })
    });

    chatInput.value = "";
    voiceStatus.textContent = "Voice note sent.";
    setTimeout(() => {
      voiceStatus.textContent = "";
    }, 2000);
  } catch (error) {
    voiceStatus.textContent = error.message;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

function escapeAttribute(text) {
  return escapeHtml(text).replace(/`/g, "&#096;");
}

function renderUsername(username, isAdmin = false) {
  const safeName = escapeHtml(username);
  if (!isAdmin) return safeName;

  return `${safeName}<span class="admin-star" title="Host account" aria-label="Host account"></span>`;
}

function init() {
  authPage.style.display = "flex";
  mainPage.style.display = "none";
}

init();
