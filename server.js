const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const mockData = require('./mockData');
const authRoutes = require('./authRoutes');

const fileRoutes = require('./fileRoutes');

const botRoutes = require('./botRoutes');

const app = express();
const PORT = config.PORT;

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/bot', botRoutes);

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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔌 API endpoints available at: http://localhost:${PORT}/api`);
});
