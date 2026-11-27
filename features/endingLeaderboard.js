import fs from "fs";
import path from "path";
import axios from "axios";
import { EmbedBuilder } from "discord.js";
import { TEXT_CHANNELS, TAGS, LEADERBOARD } from "../config/constants.js";
import { getDefaultHeaders } from "../utils/headers.js";
import { DATA_DIR } from "../utils/paths.js";
import { recordStats } from "../utils/stats.js";

// Previous report, kept on disk so each report can show what changed
const statsCacheFile = path.join(DATA_DIR, "statsCache.json");

function loadCache() {
    try {
        return JSON.parse(fs.readFileSync(statsCacheFile, "utf8"));
    } catch {
        return null;
    }
}

function saveCache(stats) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(statsCacheFile, JSON.stringify(stats, null, 2));
}

// " (+3)" / " (-2)" / "" when there is nothing to compare or nothing changed
function diffText(newVal, oldVal, digits = 0) {
    if (newVal == null || oldVal == null) return "";
    const diff = newVal - oldVal;
    if (diff === 0) return "";
    const shown = digits ? diff.toFixed(digits) : String(diff);
    return ` (${diff > 0 ? "+" : ""}${shown})`;
}

const winRate = (stats) =>
    stats?.astat?.wins_hist && stats?.astat?.battles_hist
        ? (stats.astat.wins_hist / stats.astat.battles_hist) * 100
        : null;

function buildDescription(now, before) {
    const rate = winRate(now);
    return (
        `Position: ${now.pos + 1}${diffText(now.pos, before?.pos)}\n` +
        `Members: ${now.members_cnt}${diffText(now.members_cnt, before?.members_cnt)}\n` +
        `Activity: ${now.astat?.activity || "N/A"}\n` +
        `Wins: ${now.astat?.wins_hist || "N/A"}${diffText(now.astat?.wins_hist, before?.astat?.wins_hist)}\n` +
        `Battles: ${now.astat?.battles_hist || "N/A"}${diffText(now.astat?.battles_hist, before?.astat?.battles_hist)}\n` +
        `Win Rate: ${rate !== null ? rate.toFixed(2) + "%" : "N/A"}${diffText(rate, winRate(before), 2)}\n` +
        `Score (Era 5): ${now.astat?.dr_era5_hist || "N/A"}${diffText(now.astat?.dr_era5_hist, before?.astat?.dr_era5_hist)}`
    );
}

export async function finalPosition(client) {
    const targetChannel = client.channels.cache.get(TEXT_CHANNELS.INTEL);
    if (!targetChannel) {
        console.error("Target channel not found for getStats.");
        return;
    }

    for (let page = 1; page <= LEADERBOARD.MAX_PAGES; page++) {
        try {
            const url = LEADERBOARD.API_BASE.replace("{}", page);
            const response = await axios.get(url, { headers: getDefaultHeaders() });
            const squadrons = response.data?.data;
            if (!squadrons) continue;

            const vcom = squadrons.find(s => s.tagl && s.tagl.toUpperCase() === TAGS.VCOM.toUpperCase());
            if (!vcom) continue;

            const embed = new EmbedBuilder()
                .setTitle("VCoM Auto SRE Stats")
                .setDescription(buildDescription(vcom, loadCache()))
                .setColor("#de1bc4")
                .setTimestamp();

            await targetChannel.send({ embeds: [embed] });
            console.log("VCoM Auto SRE Stats sent successfully.");
            saveCache(vcom);

            // The twice-daily report always goes into the stats history
            try {
                recordStats(vcom, typeof vcom.pos === "number" ? vcom.pos + 1 : null, { force: true });
            } catch (statsErr) {
                console.warn("[stats] Could not record snapshot:", statsErr.message);
            }
            return;
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
        }
    }

    targetChannel.send("VCoM squadron not found in any page.");
}
