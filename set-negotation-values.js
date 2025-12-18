// Save these as a Foundry macro (script)

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
if (!window.clockDatabase) {
    ui.notifications.error("Clock Database module not active.");
    return;
}
async function setClock(clockName, value) {
    const clock = window.clockDatabase.getName(clockName);
    
    if (!clock) {
        ui.notifications.warn(`Clock named "${clockName}" not found in database.`);
        return;
    }

    // Update the clock value
    await window.clockDatabase.update({ id: clock.id, value: value });
}

// Retrieve values (Checking if they are direct numbers or objects with a 'value' property)
// This handles cases where data might be stored as { value: 3, max: 5 } or just 3.
const rawInterest = negotiation.interest;
const rawPatience = negotiation.patience;

const interestVal = (typeof rawInterest === 'object') ? (rawInterest.value || 0) : (rawInterest || 0);
const patienceVal = (typeof rawPatience === 'object') ? (rawPatience.value || 0) : (rawPatience || 0);

// Update the Clocks
await setClock("Interest", interestVal);
await setClock("Patience", patienceVal);

ui.notifications.info(`Clocks set to NPC values: Interest (${interestVal}), Patience (${patienceVal}).`);
