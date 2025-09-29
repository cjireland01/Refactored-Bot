const fs = require("fs");
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const { TEXT_CHANNELS, TAGS, LEADERBOARD } = require("../config/constants");
const { getDefaultHeaders } = require("../utils/headers");

// local cache file
const statsCacheFile = "./data/statsCache.json";
let cachedStats = null;

// load cache if it exists
if (fs.existsSync(statsCacheFile)) {
    try {
        cachedStats = JSON.parse(fs.readFileSync(statsCacheFile, "utf8"));
    } catch {
        cachedStats = null;
    }
}

async function finalPosition(client) {
    const targetChannel = client.channels.cache.get(TEXT_CHANNELS.INTEL);
    if (!targetChannel) {
        console.error("Target channel not found for getStats.");
        return;
    }

    let found = false;

    for (let page = 1; page <= LEADERBOARD.MAX_PAGES; page++) {
        try {
            const url = LEADERBOARD.API_BASE.replace("{}", page);
            const response = await axios.get(url, { headers: getDefaultHeaders() });
            if (!response.data || !response.data.data) continue;

            const data = response.data.data;
            for (const squadron of data) {
                if (squadron.tagl && squadron.tagl.toUpperCase() === TAGS.VCOM.toUpperCase()) {
                    found = true;
                    const newStats = squadron;

                    // === Calculate diffs ===
                    let posDiff = "";
                    if (cachedStats?.pos !== undefined) {
                        const diff = newStats.pos - cachedStats.pos;
                        posDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : "";
                    }

                    let membersDiff = "";
                    if (cachedStats?.members_cnt !== undefined) {
                        const diff = newStats.members_cnt - cachedStats.members_cnt;
                        membersDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : "";
                    }

                    const activityValue = newStats.astat?.activity || "N/A";

                    let winsDiff = "";
                    if (cachedStats?.astat?.wins_hist !== undefined && newStats.astat?.wins_hist !== undefined) {
                        const diff = newStats.astat.wins_hist - cachedStats.astat.wins_hist;
                        winsDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : "";
                    }

                    let battlesDiff = "";
                    if (cachedStats?.astat?.battles_hist !== undefined && newStats.astat?.battles_hist !== undefined) {
                        const diff = newStats.astat.battles_hist - cachedStats.astat.battles_hist;
                        battlesDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : "";
                    }

                    let winRateNew = "N/A";
                    let winRateDiff = "";
                    if (newStats.astat?.wins_hist && newStats.astat?.battles_hist) {
                        const rate = (newStats.astat.wins_hist / newStats.astat.battles_hist) * 100;
                        winRateNew = rate.toFixed(2) + "%";
                    }
                    if (cachedStats?.astat?.wins_hist && cachedStats?.astat?.battles_hist) {
                        const oldRate = (cachedStats.astat.wins_hist / cachedStats.astat.battles_hist) * 100;
                        const newRate = (newStats.astat.wins_hist / newStats.astat.battles_hist) * 100;
                        const diff = newRate - oldRate;
                        winRateDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff.toFixed(2)})` : "";
                    }

                    let scoreDiff = "";
                    if (cachedStats?.astat?.dr_era5_hist !== undefined && newStats.astat?.dr_era5_hist !== undefined) {
                        const diff = newStats.astat.dr_era5_hist - cachedStats.astat.dr_era5_hist;
                        scoreDiff = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : "";
                    }

                    // === Build embed ===
                    const description =
                        `Position: ${newStats.pos + 1}${posDiff}\n` +
                        `Members: ${newStats.members_cnt}${membersDiff}\n` +
                        `Activity: ${activityValue}\n` +
                        `Wins: ${newStats.astat?.wins_hist || "N/A"}${winsDiff}\n` +
                        `Battles: ${newStats.astat?.battles_hist || "N/A"}${battlesDiff}\n` +
                        `Win Rate: ${winRateNew}${winRateDiff}\n` +
                        `Score (Era 5): ${newStats.astat?.dr_era5_hist || "N/A"}${scoreDiff}`;

                    const embed = new EmbedBuilder()
                        .setTitle("VCoM Auto SRE Stats")
                        .setDescription(description)
                        .setColor("#de1bc4")
                        .setTimestamp();

                    await targetChannel.send({ embeds: [embed] });
                    console.log("VCoM Auto SRE Stats sent successfully.");

                    cachedStats = newStats;
                    fs.writeFileSync(statsCacheFile, JSON.stringify(cachedStats, null, 2));

                    return; // exit once found
                }
            }
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
        }
    }

    if (!found) {
        targetChannel.send("VCoM squadron not found in any page.");
    }
}

module.exports = { finalPosition };
