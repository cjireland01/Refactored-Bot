import { getRemainingTime } from "./utils/schedule.js";

export const webState = {
  currentBR: "",
  brEndsIn: "",
  voiceUsers: [],
  vcomStats: {}
};

export function updateWebState({ currentBR, voiceUsers, vcomStats }) {
  webState.currentBR = currentBR;
  webState.brEndsIn = getRemainingTime(currentBR);
  webState.voiceUsers = voiceUsers || [];
  webState.vcomStats = vcomStats || {};
}
