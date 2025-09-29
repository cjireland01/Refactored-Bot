const express = require('express');
const path = require('path');

const app = express();
const PORT = 4000;

const webState = {
  currentBR: "",
  brEndsIn: "",
  voiceUsers: [],
  vcomStats: {}
};

function getRemainingTime(currentBR) {
  const schedule = [
    { br: 13.7, start: "2025-03-01", end: "2025-03-06" },
    { br: 12,   start: "2025-03-07", end: "2025-03-13" },
    { br: 10.7, start: "2025-03-14", end: "2025-03-20" },
    { br: 10,   start: "2025-03-21", end: "2025-03-27" },
    { br: 9,    start: "2025-03-28", end: "2025-04-03" },
    { br: 8.3,  start: "2025-04-04", end: "2025-04-10" },
    { br: 7.3,  start: "2025-04-11", end: "2025-04-17" },
    { br: 6.3,  start: "2025-04-18", end: "2025-04-24" },
    { br: 5.7,  start: "2025-04-25", end: "2025-04-30" }
  ];

  const now = new Date();
  for (const { br, end } of schedule) {
    if (Number(br).toFixed(1) === currentBR) {
      const endTime = new Date(`${end}T03:00:00-05:00`);
      const diffMs = endTime - now;
      const hours = Math.floor(diffMs / 1000 / 60 / 60);
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
  }
  return "Unknown";
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/status', (req, res) => {
  res.json(webState);
});

app.listen(PORT, () => {
  console.log(`Web server running at http://localhost:${PORT}`);
});

module.exports = { webState, getRemainingTime };
