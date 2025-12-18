const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    PORT: process.env.PORT || 3000,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback',
    SESSION_SECRET: process.env.SESSION_SECRET || 'supersecretkeyfornow', // Used for signing cookies
};
