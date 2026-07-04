const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

let users = [
  { id: 1, username: "Adiiii", password: "pass123", points: 0 },
  { id: 2, username: "aaronsk", password: "pass123", points: 0 },
  { id: 3, username: "milano", password: "pass123", points: 0 }
];

let matches = [
  {
    id: 1,
    homeTeam: "Canada",
    awayTeam: "Morocco",
    homeFlag: "🇨🇦",
    awayFlag: "🇲🇦",
    date: "2026-07-04T22:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 2,
    homeTeam: "Paraguay",
    awayTeam: "France",
    homeFlag: "🇵🇾",
    awayFlag: "🇫🇷",
    date: "2026-07-05T02:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 3,
    homeTeam: "Brazil",
    awayTeam: "Norway",
    homeFlag: "🇧🇷",
    awayFlag: "🇳🇴",
    date: "2026-07-06T01:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 4,
    homeTeam: "Mexico",
    awayTeam: "England",
    homeFlag: "🇲🇽",
    awayFlag: "🇬🇧",
    date: "2026-07-06T05:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 5,
    homeTeam: "Portugal",
    awayTeam: "Spain",
    homeFlag: "🇵🇹",
    awayFlag: "🇪🇸",
    date: "2026-07-07T00:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 6,
    homeTeam: "USA",
    awayTeam: "Belgium",
    homeFlag: "🇺🇸",
    awayFlag: "🇧🇪",
    date: "2026-07-07T05:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 7,
    homeTeam: "Argentina",
    awayTeam: "Egypt",
    homeFlag: "🇦🇷",
    awayFlag: "🇪🇬",
    date: "2026-07-07T21:30",
    stage: "Round of 16",
    venue: "TBD"
  },
  {
    id: 8,
    homeTeam: "Switzerland",
    awayTeam: "Colombia",
    homeFlag: "🇨🇭",
    awayFlag: "🇨🇴",
    date: "2026-07-08T01:30",
    stage: "Round of 16",
    venue: "TBD"
  }
];

let predictions = [];
let currentUser = null;
let chatMessages = [];

const matchResults = {
  1: { homeScore: null, awayScore: null },
  2: { homeScore: null, awayScore: null },
  3: { homeScore: null, awayScore: null },
  4: { homeScore: null, awayScore: null },
  5: { homeScore: null, awayScore: null },
  6: { homeScore: null, awayScore: null },
  7: { homeScore: null, awayScore: null },
  8: { homeScore: null, awayScore: null }
};

function getWinner(homeScore, awayScore) {
  if (homeScore > awayScore) return "Home Win";
  if (awayScore > homeScore) return "Away Win";
  return "Draw";
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  res.json({ success: true, user: { id: user.id, username: user.username, points: user.points } });
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ error: "Username already exists." });
  }

  const newUser = {
    id: Math.max(...users.map((u) => u.id), 0) + 1,
    username,
    password,
    points: 0
  };

  users.push(newUser);
  res.status(201).json({ success: true, user: { id: newUser.id, username: newUser.username, points: newUser.points } });
});

app.get("/leaderboard", (req, res) => {
  const leaderboard = users
    .filter((user) => predictions.some((p) => p.userId === user.id))
    .sort((a, b) => b.points - a.points)
    .map((user, index) => ({
      rank: index + 1,
      username: user.username,
      points: user.points
    }));
  res.json(leaderboard);
});

app.get("/matches", (req, res) => {
  res.json(matches);
});

app.post("/matches", (req, res) => {
  const { homeTeam, awayTeam, date, stage, venue } = req.body;

  if (!homeTeam || !awayTeam || !date) {
    return res.status(400).json({ error: "Home team, away team, and date are required." });
  }

  const match = {
    id: Date.now(),
    homeTeam,
    awayTeam,
    date,
    stage: stage || "Group Stage",
    venue: venue || "TBD"
  };

  matches.unshift(match);
  res.status(201).json(match);
});

app.get("/predictions", (req, res) => {
  res.json(predictions);
});

app.post("/predict", (req, res) => {
  const { userId, matchId, homeScore, awayScore } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in to make predictions." });
  }

  const user = users.find((u) => u.id === Number(userId));
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const match = matches.find((item) => String(item.id) === String(matchId));
  if (!match) {
    return res.status(404).json({ error: "Match not found." });
  }

  const home = Number(homeScore);
  const away = Number(awayScore);

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return res.status(400).json({ error: "Scores must be non-negative integers." });
  }

  const prediction = {
    id: Date.now(),
    userId: Number(userId),
    username: user.username,
    matchId: Number(matchId),
    homeScore: home,
    awayScore: away,
    predictedWinner: getWinner(home, away),
    submittedAt: new Date().toISOString(),
    match
  };

  user.points += 5;
  predictions.unshift(prediction);
  res.json({ success: true, prediction, userPoints: user.points });
});

app.get("/check-predictions/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const userPredictions = predictions.filter((p) => p.userId === userId);
  const badPredictions = userPredictions.filter((pred) => {
    const result = matchResults[pred.matchId];
    if (!result.homeScore || !result.awayScore) return false;

    const scoreDiff = Math.abs(pred.homeScore - result.homeScore) + Math.abs(pred.awayScore - result.awayScore);
    return scoreDiff >= 5;
  });

  res.json({ badPredictionCount: badPredictions.length, totalPredictions: userPredictions.length });
});

app.post("/chat", (req, res) => {
  const { userId, username, message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  const chatMessage = {
    id: Date.now(),
    userId,
    username,
    message: message.substring(0, 300),
    timestamp: new Date().toISOString()
  };

  chatMessages.unshift(chatMessage);
  if (chatMessages.length > 100) chatMessages.pop();

  res.json({ success: true, message: chatMessage });
});

app.get("/chat", (req, res) => {
  res.json(chatMessages.slice(0, 50));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});