// Live data the bot shares with the website.
// (The current BR and its countdown are computed fresh on each request.)
export const webState = {
  voiceUsers: [],
};

export function setVoiceUsers(users) {
  webState.voiceUsers = users || [];
}
