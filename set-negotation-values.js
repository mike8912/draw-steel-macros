// Save these as a Foundry macro (script)
// Optional: Global Progress Clocks Module
const token = canvas.tokens.controlled[0];

if (!token) {
    ui.notifications.warn("Please select a token.");
    return;
}

const actor = token.actor;

// Check if actor is an NPC
if (actor.type !== 'npc') {
    ui.notifications.warn("Selected token is not an NPC.");
    return;
}

// Check for negotiation data
const negotiation = actor.system.negotiation;
if (!negotiation) {
    ui.notifications.warn("This NPC has no negotiation data.");
    return;
}

// Check for Clock Database
let clocksActive = window.clockDatabase !== undefined;

async function setClock(clockName, value) {
    if (!clocksActive) return;

    const clock = window.clockDatabase.getName(clockName);
    if (!clock) {
        ui.notifications.warn(`Clock named "${clockName}" not found in database.`);
        return;
    }

    await window.clockDatabase.update({ id: clock.id, value: value });
}


const unwrap = (obj) => (typeof obj === 'object') ? obj.value || 0 : obj || 0;
const interestVal = unwrap(negotiation.interest);
const patienceVal = unwrap(negotiation.patience);

// Update the Clocks
await setClock("Interest", interestVal);
await setClock("Patience", patienceVal);

ui.notifications.info(`Clocks set to NPC values: Interest (${interestVal}), Patience (${patienceVal}).`);

let content = `
    Start negotation with <strong>${actor.name}</strong>.<br/>
    <strong>Interest:</strong> ${interestVal}<br/>
    <strong>Patience:</strong> ${patienceVal}<br/>`;

ChatMessage.create({
    user: game.user.id,
    speaker: 'Director',
    content: content
});

// GM message with motivations and pitfalls
const motivations = negotiation.motivations;
const pitfalls = negotiation.pitfalls;
const mapSetToString = (set) => Array.from(set).join(", ");
const gmContent = `
    <strong>Motivations:</strong> ${mapSetToString(motivations)}<br/>
    <strong>Pitfalls:</strong> ${mapSetToString(pitfalls)}
`;

ChatMessage.create({
    user: game.user.id,
    speaker: 'Director',
    content: gmContent,
    whisper: ChatMessage.getWhisperRecipients("Director")
});
