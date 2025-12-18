const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Mock data storage (in production, use a real database)
const mockData = {
    users: new Map(),
    hostingAccounts: new Map(),
    sessions: new Map(),
    announcements: [],
    referrals: new Map(),
    withdrawals: []
};

// ==============================================
// API ROUTES
// ==============================================

// Auth Routes
app.get('/api/auth/discord/login', (req, res) => {
    // In production, this would redirect to Discord OAuth
    res.json({
        success: true,
        authUrl: 'https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=identify%20email'
    });
});

app.get('/api/auth/session', (req, res) => {
    const sessionId = req.cookies.session;
    
    if (sessionId && mockData.sessions.has(sessionId)) {
        const user = mockData.sessions.get(sessionId);
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

app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.cookies.session;
    if (sessionId) {
        mockData.sessions.delete(sessionId);
    }
    res.clearCookie('session');
    res.json({ success: true });
});

app.get('/api/auth/check-suspension', (req, res) => {
    res.json({
        success: true,
        isSuspended: false,
        isBanned: false
    });
});

app.get('/api/auth/security-check', (req, res) => {
    res.json({
        success: true,
        isBanned: false,
        isSuspended: false
    });
});

// Bot Management Routes
app.post('/api/bot/start', (req, res) => {
    res.json({
        success: true,
        message: 'Bot started successfully'
    });
});

app.post('/api/bot/stop', (req, res) => {
    res.json({
        success: true,
        message: 'Bot stopped successfully'
    });
});

app.post('/api/bot/restart', (req, res) => {
    res.json({
        success: true,
        message: 'Bot restarted successfully'
    });
});

app.get('/api/bot/status', (req, res) => {
    res.json({
        success: true,
        status: {
            running: false,
            uptime: 0,
            memory: 0,
            cpu: 0
        }
    });
});

app.get('/api/bot/logs', (req, res) => {
    res.json({
        success: true,
        logs: 'No logs available'
    });
});

// File Management Routes
app.get('/api/files', (req, res) => {
    res.json({
        success: true,
        files: [],
        storage: {
            used: 0,
            limit: 500,
            percentage: 0
        }
    });
});

app.post('/api/files/upload', (req, res) => {
    res.json({
        success: true,
        message: 'File uploaded successfully'
    });
});

app.delete('/api/files/:path', (req, res) => {
    res.json({
        success: true,
        message: 'File deleted successfully'
    });
});

// Admin Routes
app.get('/api/admin/users', (req, res) => {
    res.json({
        success: true,
        users: [],
        stats: {
            total: 0,
            active: 0,
            suspended: 0,
            banned: 0
        }
    });
});

app.get('/api/admin/announcements', (req, res) => {
    res.json({
        success: true,
        announcements: mockData.announcements
    });
});

app.post('/api/admin/announcements', (req, res) => {
    const announcement = {
        id: Date.now().toString(),
        title: req.body.title,
        message: req.body.message,
        type: req.body.type || 'info',
        created_at: Math.floor(Date.now() / 1000)
    };
    mockData.announcements.push(announcement);
    
    res.json({
        success: true,
        announcement: announcement
    });
});

app.get('/api/admin/server-management/check-access', (req, res) => {
    // Mock authorization check
    res.json({
        success: true,
        hasAccess: true
    });
});

app.get('/api/admin/server-management/servers', (req, res) => {
    res.json({
        success: true,
        servers: [],
        stats: {
            total: 0,
            running: 0,
            stopped: 0,
            suspended: 0,
            banned: 0
        }
    });
});

app.get('/api/admin/webhooks/check-admin', (req, res) => {
    res.json({
        success: true,
        isAuthorized: true
    });
});

app.get('/api/admin/webhooks', (req, res) => {
    res.json({
        success: true,
        webhooks: {}
    });
});

app.post('/api/admin/webhooks', (req, res) => {
    res.json({
        success: true,
        message: 'Webhook saved successfully'
    });
});

app.post('/api/admin/webhooks/test', (req, res) => {
    res.json({
        success: true,
        message: 'Test webhook sent successfully'
    });
});

// Referral Routes
app.get('/api/referrals/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            referral_count: 0,
            referral_balance: 0,
            total_earned: 0,
            available_for_withdrawal: 0
        }
    });
});

app.get('/api/referrals/admin/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            referral_reward: 0.25,
            pending_paypal: 0
        }
    });
});

app.get('/api/referrals/admin/withdrawals', (req, res) => {
    res.json({
        success: true,
        withdrawals: [],
        stats: {
            pending: 0,
            hold: 0,
            completed: 0
        }
    });
});

app.get('/api/referrals/admin/credit-logs', (req, res) => {
    res.json({
        success: true,
        logs: []
    });
});

// Catch-all route - serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔌 API endpoints available at: http://localhost:${PORT}/api`);
});
