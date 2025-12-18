const fs = require('fs');
const path = require('path');

const sessionFilePath = path.join(__dirname, 'sessions.json');

// Ensure the sessions.json file exists
if (!fs.existsSync(sessionFilePath)) {
    fs.writeFileSync(sessionFilePath, JSON.stringify({}));
}

function readSessions() {
    const fileContent = fs.readFileSync(sessionFilePath, 'utf-8');
    return JSON.parse(fileContent);
}

function writeSessions(sessions) {
    fs.writeFileSync(sessionFilePath, JSON.stringify(sessions, null, 2));
}

const sessionStore = {
    get(sessionId) {
        const sessions = readSessions();
        return sessions[sessionId];
    },

    set(sessionId, sessionData) {
        const sessions = readSessions();
        sessions[sessionId] = sessionData;
        writeSessions(sessions);
    },

    delete(sessionId) {
        const sessions = readSessions();
        delete sessions[sessionId];
        writeSessions(sessions);
    },

    has(sessionId) {
        const sessions = readSessions();
        return sessions.hasOwnProperty(sessionId);
    }
};

module.exports = sessionStore;
