// Save these as a Foundry macro (script)
// Optional: Global Progress Clocks Module
const token = canvas.tokens.controlled[0];
const targetToken = game.user.targets.first();
const motivationOrPitfalls = [
    "Benevolence", "Discovery", "Freedom", "Greed", "Higher Authority",
    "Justice", "Legacy", "Peace", "Power", "Protection", "Revelry", "Vengeance"
];

if (!token) {
    ui.notifications.warn("Please select your token first.");
    return;
}

if (token.actor.type !== 'hero') {
    ui.notifications.warn("Selected token is not an Hero.");
    return;
}

if (!targetToken) {
    ui.notifications.warn("Please target the NPC you are negotiating with.");
    return;
}

const rollData = token.actor.getRollData();
const targetActor = targetToken.actor;
const clocksActive = window.clockDatabase !== undefined;

async function setClock(clockName, change) {
    if (!clocksActive) return;

    const clock = window.clockDatabase.getName(clockName);
    if (!clock) {
        ui.notifications.warn(`Clock named "${clockName}" not found in database.`);
        return;
    }

    let newValue = clock.value + change;
    if (newValue < 0) newValue = 0;
    if (clock.max && newValue > clock.max) newValue = clock.max;

    await window.clockDatabase.update({ id: clock.id, value: newValue });
}


async function performRoll(statKey, statLabel, html) {
    const selectedSubject = html.find('#subject-select').val();
    const skillSelect = html.find('#skill-select').val();
    const baneCount = html.find('#roll-banes').val();
    const edgeCount = html.find('#roll-edges').val();
    const modifier = html.find('#roll-modifier').val();

    const targetMotivations = targetActor.system.negotiation?.motivations || [];
    const targetPitfalls = targetActor.system.negotiation?.pitfalls || [];

    let approachType = "none";
    if (targetMotivations.has(selectedSubject.toLowerCase())) approachType = "motivation";
    if (targetPitfalls.has(selectedSubject.toLowerCase())) approachType = "pitfall";

    const charData = rollData.characteristics?.[statKey];
    if (charData?.value === undefined) {
        ui.notifications.error(`Data not found for characteristics.${statKey}.value`);
        return;
    }
    const charValue = rollData.characteristics?.[statKey]?.value ?? 0;

    let skillBonus = skillSelect !== "none" ? 2 : 0;
    let skillName = skillSelect !== "none" ? skillSelect : "None";

    const rollFormula = `2d10 + @stat + @skill + @modifier + @edgeAndBaneModifier`;
    const contest = (baneCount * -2) + (edgeCount * 2);
    let resolution = "";
    let edgeAndBaneModifier = 0;

    switch (contest) {
        case -4:
            resolution = "TIER_DECREASE";
            edgeAndBaneModifier = 0;
            break;
        case -2:
            resolution = "NEGATIVE_MODIFER";
            edgeAndBaneModifier = -2;
            break;
        case 0:
            resolution = "ZERO_MODIFIER";
            edgeAndBaneModifier = 0;
            break;
        case 2:
            resolution = "POSITIVE_MODIFIER";
            edgeAndBaneModifier = 2;
            break;
        case 4:
            resolution = "TIER_INCREASE";
            edgeAndBaneModifier = 0;
            break;
    }


    const roll = new Roll(rollFormula, { stat: charValue, skill: skillBonus, modifier: modifier, edgeAndBaneModifier: edgeAndBaneModifier });
    await roll.evaluate();
    const total = roll.total;

    // Determine Tier
    let tier = 0;
    if (total > 17) tier = 3;
    else if (total > 11) tier = 2;
    else tier = 1;

    // Apply resolution, but result can't be lower than 1 or higher than 3
    if (resolution === "TIER_DECREASE") tier = Math.max(1, tier - 1);
    if (resolution === "TIER_INCREASE") tier = Math.min(3, tier + 1);

    let resultMsg = "";
    let outcomeDesc = "";

    if (approachType === "motivation") {
        // MOTIVATION
        if (tier === 1) {
            resultMsg = "Tier 1";
            outcomeDesc = "Patience -1";
            await setClock("Patience", -1);
        } else if (tier === 2) {
            resultMsg = "Tier 2";
            outcomeDesc = "Interest +1, Patience -1";
            await setClock("Interest", 1);
            await setClock("Patience", -1);
        } else { // Tier 3
            resultMsg = "Tier 3";
            outcomeDesc = "Interest +1";
            await setClock("Interest", 1);
        }
    } else if (approachType === "pitfall") {
        // PITFALL
        resultMsg = "Pitfall";
        outcomeDesc = "Interest -1, Patience -1";
        await setClock("Patience", -1);
        await setClock("Interest", -1);
    } else {
        // STANDARD
        if (tier === 1) {
            resultMsg = "Tier 1";
            outcomeDesc = "Patience -1, Interest -1";
            await setClock("Patience", -1);
            await setClock("Interest", -1);
        } else if (tier === 2) {
            resultMsg = "Tier 2";
            outcomeDesc = "Patience -1";
            await setClock("Patience", -1);
        } else { // Tier 3
            resultMsg = "Tier 3";
            outcomeDesc = "Interest +1, Patience -1";
            await setClock("Interest", 1);
            await setClock("Patience", -1);
        }
    }

    let approachLabel = "";

    switch (approachType) {
        case "motivation":
            approachLabel = `<span style="color:green">${selectedSubject} (Motivation)</span>`;
            break;
        case "pitfall":
            approachLabel = `<span style="color:red">${selectedSubject} (Pitfall)</span>`;
            break;
        default:
            approachLabel = `<span>${selectedSubject}</span>`;
            break;
    }

    let resolutionMsg = "";
    if (resolution === "TIER_DECREASE") resolutionMsg = "(Double Bane)";
    else if (resolution === "TIER_INCREASE") resolutionMsg = "(Double Edge)";

    const content = `
    <strong>Characteristic:</strong> ${statLabel}<br>
    <strong>Appeal To:</strong> ${approachLabel}<br>
    <strong>Skill:</strong> ${skillBonus > 0 ? `${skillName} (+${skillBonus})` : "None"}<br>
    <strong>Modifiers:</strong> ${edgeCount} Edges, ${baneCount} Banes, ${modifier} Modifier<br>
    <strong>Result:</strong> ${total} (Roll: ${roll.result})<br>
    <strong>${resultMsg}</strong><i> ${resolutionMsg}</i><br>
    ${outcomeDesc}
  `;

    ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ token: token }),
        content: content,
        rolls: [roll]
    });
}

// Get Skills from Actor Data
const heroSkills = rollData.hero?.skills || [];
let skillOptions = `<option value="none">None</option>`;
heroSkills.forEach(s => {
    // Check if skill is object or string based on system version
    const sName = typeof s === 'string' ? s : s.name;
    skillOptions += `<option value="${sName}">${sName}</option>`;
});

// Build Subject Options
let subjectOptions = `<option value="none">None</option>`;;
motivationOrPitfalls.forEach(sub => {
    subjectOptions += `<option value="${sub}">${sub}</option>`;
});

// Build Form HTML
const dialogContent = `
  <form style="margin-bottom: 10px">
    <div class="form-group">
      <label><strong>Target:</strong> ${targetToken.name}</label>
    </div>
    <hr>
    <div class="form-group">
      <label>Subject:</label>
      <select id="subject-select" style="width: 100%">
        ${subjectOptions}
      </select>
    </div>
    <div class="form-group">
      <label>Skill:</label>
      <select id="skill-select" style="width: 100%">
        ${skillOptions}
      </select>
    </div>
    <hr>
    <div class="form-group" style="display: flex; justify-content: space-between">
        <label style="display: flex; flex-direction: column; margin-right: 10px">
            <span>Edges</span>
            <select id="roll-edges">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
            </select>
        </label>
        <label style="display: flex; flex-direction: column; margin-right: 10px">
            <span>Banes</span>
            <select id="roll-banes">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
            </select>
        </label>
        <label style="display: flex; flex-direction: column">
            <span>Modifier</span>
            <Input type="number" id="roll-modifier" value="0">
        </label>
    </div>
    <hr>
  </form>
`;

// Build Buttons
const buttons = {};
const stats = { might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" };
for (const [key, label] of Object.entries(stats)) {
    buttons[key] = {
        label: label,
        callback: (html) => performRoll(key, label, html)
    };
}

new Dialog({
    title: `Negotiation: ${token.name}`,
    content: dialogContent,
    buttons: buttons,
    default: "might"
}).render(true);
