const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const sessionStore = require('./sessionStore');
const config = require('./config');

// Auth Routes
router.get('/discord/login', (req, res) => {
    const state = uuidv4();
    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 300000 }); // 5 minutes

    const authorizationUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(config.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${state}`;
    
    res.redirect(307, authorizationUrl);
});

router.get('/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;

    if (!code || !state || state !== storedState) {
        return res.status(400).send('Invalid request or state mismatch');
    }
    
    res.clearCookie('oauth_state');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: config.DISCORD_CLIENT_ID,
                client_secret: config.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: config.DISCORD_REDIRECT_URI,
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, token_type } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${token_type} ${access_token}`,
            },
        });

        const user = userResponse.data;
        
        // --- Session Creation (to be improved in the next step) ---
        const sessionId = uuidv4();
        sessionStore.set(sessionId, user);
        res.cookie('session', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'Lax'
        });
        // ---

        res.redirect('/');

    } catch (error) {
        console.error('Error during Discord OAuth callback:', error);
        res.status(500).send('An error occurred during authentication.');
    }
});


router.get('/session', (req, res) => {
    const sessionId = req.cookies.session;
    
    if (sessionId && sessionStore.has(sessionId)) {
        const user = sessionStore.get(sessionId);
        res.json({
            success: true,
            user: user
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
});

router.post('/logout', (req, res) => {
    const sessionId = req.cookies.session;
    if (sessionId) {
        sessionStore.delete(sessionId);
    }
    res.clearCookie('session');
    res.json({ success: true });
});


router.get('/check-suspension', (req, res) => {
    res.json({
        success: true,
        isSuspended: false,
        isBanned: false
    });
});

router.get('/security-check', (req, res) => {
    res.json({
        success: true,
        isBanned: false,
        isSuspended: false
    });
});

// Demo login endpoint for testing (remove in production)
router.post('/demo-login', (req, res) => {
    const mockUser = {
        id: 'demo-user-12345',
        userId: 'admin', // Make this an admin user
        username: 'DemoAdmin',
        discriminator: '0001',
        avatar: null,
        discordId: '123456789012345678',
        email: 'admin@example.com',
        role: 'admin'
    };
    
    const sessionId = uuidv4();
    sessionStore.set(sessionId, mockUser);
    res.cookie('session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax'
    });
    
    res.json({
        success: true,
        user: mockUser
    });
});

module.exports = router;
