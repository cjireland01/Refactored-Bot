export function getRemainingTime(currentBR) {
  const schedule = [
    { br: 14.0, start: "2025-11-01", end: "2025-11-07" },
    { br: 12.0, start: "2025-11-07", end: "2025-11-14" },
    { br: 10.7, start: "2025-11-14", end: "2025-11-21" },
    { br: 9.7, start: "2025-11-21", end: "2025-11-28" },
    { br: 8.7, start: "2025-11-28", end: "2025-12-05" },
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
