const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { TEXT_CHANNELS, TAGS, LEADERBOARD } = require("../config/constants");
const { getDefaultHeaders } = require("../utils/headers");

const nf = new Intl.NumberFormat("en-US");
let isFetching = false;
let lastVcomMessage = null;

async function trackVcomLeaderboard(client) {
    if (isFetching) return;
    isFetching = true;

    try {
        const channel = await client.channels.fetch(TEXT_CHANNELS.INTEL);
        if (!channel) return;

        const squads = [];
        for (let page = 1; page <= LEADERBOARD.MAX_PAGES; page++) {
            try {
                const resp = await axios.get(
                    LEADERBOARD.API_BASE.replace("{}", page),
                    { headers: getDefaultHeaders() }
                );
                squads.push(...(resp.data?.data || []));
            } catch (pageErr) {
                console.warn(`Page ${page} fetch failed:`, pageErr);
                continue;
            }
            if (squads.length >= LEADERBOARD.MAX_ENTRIES) break;
        }

        if (squads.length > LEADERBOARD.MAX_ENTRIES) squads.length = LEADERBOARD.MAX_ENTRIES;

        const idx = squads.findIndex(sq => sq.tagl?.toUpperCase() === TAGS.VCOM.toUpperCase());
        if (idx === -1) {
            console.log("VCoM not found in top pages.");
            return;
        }

        const vcom = squads[idx];
        const pos = idx + 1;
        const score = vcom.astat?.dr_era5_hist || 0;
        const higher = idx > 0 ? squads[idx - 1].astat.dr_era5_hist : null;
        const lower = idx < squads.length - 1 ? squads[idx + 1].astat.dr_era5_hist : null;
        const toNext = higher !== null ? nf.format(higher - score) : "N/A";
        const toDrop = lower !== null ? nf.format(score - lower) : "N/A";

        const fiftiethScore = squads[49]?.astat?.dr_era5_hist ?? null;
        let fiftiethLabel, fiftiethValue;
        if (fiftiethScore === null) {
            fiftiethLabel = "50th Place";
            fiftiethValue = "N/A";
        } else if (pos <= 50) {
            fiftiethLabel = "Points Above 50th Place";
            fiftiethValue = nf.format(score - fiftiethScore);
        } else {
            fiftiethLabel = "Points to 50th Place";
            fiftiethValue = nf.format(fiftiethScore - score);
        }

        const embed = new EmbedBuilder()
            .setTitle("VCoM Leaderboard Status")
            .addFields(
                { name: "Place", value: `${pos}` },
                { name: "Score", value: `${score}` },
                { name: "To Next Place", value: toNext },
                { name: "To Drop Place", value: toDrop },
                { name: fiftiethLabel, value: fiftiethValue }
            )
            .setColor("#de1bc4")
            .setFooter({ text: "Updated" })
            .setTimestamp();

        const fetched = await channel.messages.fetch({ limit: 1 });
        const mostRecent = fetched.first();

        if (lastVcomMessage && mostRecent?.id === lastVcomMessage.id) {
            lastVcomMessage = await lastVcomMessage.edit({ embeds: [embed] });
        } else {
            if (lastVcomMessage) {
                try { await lastVcomMessage.delete(); } catch {}
            }
            lastVcomMessage = await channel.send({ embeds: [embed] });
        }

    } catch (err) {
        console.error("trackVcomLeaderboard error:", err);
    } finally {
        isFetching = false;
    }
}

module.exports = { trackVcomLeaderboard };
