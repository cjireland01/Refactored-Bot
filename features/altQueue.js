// features/altVehicles.js
const { EmbedBuilder } = require("discord.js");
const path = require("path");
const XLSX = require("xlsx");
const { TEXT_CHANNELS, ALT_USERS } = require("../config/constants");

// === Load Excel ===
const workbook = XLSX.readFile(path.join(__dirname, "../data/userVehicles.xlsx"));
const worksheet = workbook.Sheets["matched_vehicles"];
const data = XLSX.utils.sheet_to_json(worksheet);

// === Config ===
const ALT_CHANNEL_ID = TEXT_CHANNELS.ALTQUEUE;

// === State ===
let lastAltTracker = null;

// --- Helpers ---
function getVehiclesForAlt(username, currentBR) {
    const brMin = parseFloat(currentBR) - 1.0;
    const brMax = parseFloat(currentBR);
    const result = [];

    data.forEach(row => {
        const rowName = row.Username?.toString().trim().toLowerCase();
        if (rowName === username.toLowerCase()) {
            Object.entries(row).forEach(([key, value]) => {
                const br = parseFloat(key);
                if (!isNaN(br) && br >= brMin && br <= brMax && typeof value === "string") {
                    const vehicles = value.split(",").map(v => v.trim());
                    vehicles.forEach(vehicle => {
                        result.push({ Vehicle: vehicle, BR: br.toFixed(1) });
                    });
                }
            });
        }
    });

    return result;
}

function generateAltUserEmbedContent(userVehicleMap, currentBR) {
    const embed = new EmbedBuilder()
        .setTitle(`Alt Tracker - BR: ${currentBR}`)
        .setColor("#00ff7f")
        .setTimestamp()
        .setFooter({ text: "Request access & verify squadron membership" });

    for (const [username, vehicles] of userVehicleMap.entries()) {
        if (!vehicles?.length) continue;

        const grouped = {};
        vehicles.forEach(({ Vehicle, BR }) => {
            if (!grouped[BR]) grouped[BR] = [];
            grouped[BR].push(Vehicle);
        });

        const sortedBRs = Object.keys(grouped).sort((a, b) => parseFloat(b) - parseFloat(a));
        let formatted = sortedBRs.map(br => `${br} - ${grouped[br].join(", ")}`).join("\n");

        if (formatted.length > 1000) {
            formatted = formatted.slice(0, 997) + "...";
            formatted += "\n+ some not shown";
        }

        embed.addFields({ name: username, value: formatted, inline: false });
    }

    return embed;
}

async function updateAltTrackerEmbed(client, getCurrentBRColumn) {
    try {
        const currentBR = getCurrentBRColumn();
        const userVehicleMap = new Map();

        ALT_USERS.forEach(username => {
            const userVehicles = getVehiclesForAlt(username, currentBR);
            userVehicleMap.set(username, userVehicles);
        });

        const targetChannel = await client.channels.fetch(ALT_CHANNEL_ID);
        const embed = generateAltUserEmbedContent(userVehicleMap, currentBR);

        if (lastAltTracker) {
            await lastAltTracker.edit({ embeds: [embed] });
        } else {
            lastAltTracker = await targetChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("[ERROR] Error updating alt vehicle embed:", err.message);
    }
}

module.exports = { updateAltTrackerEmbed };
