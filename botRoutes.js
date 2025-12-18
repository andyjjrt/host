const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sessionStore = require('./sessionStore');

const USER_FILES_BASE_DIR = path.join(__dirname, 'user_files');

// In-memory store for running bot processes
// Each entry: { process, startTime, pid }
const runningBots = new Map();

// Middleware to get user and their file path from session
const getUserFilePath = (req, res, next) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.has(sessionId)) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = sessionStore.get(sessionId);
    if (!user || !user.id) {
        return res.status(400).json({ success: false, error: 'Invalid user data in session' });
    }

    req.user = user;
    req.userFilesDir = path.join(USER_FILES_BASE_DIR, user.id);
    
    next();
};

// Helper function to get process resource usage
async function getProcessStats(pid) {
    try {
        // Read /proc/[pid]/stat for CPU and memory info on Linux
        if (process.platform === 'linux') {
            const statPath = `/proc/${pid}/stat`;
            if (!fs.existsSync(statPath)) {
                return null;
            }
            
            const stat = fs.readFileSync(statPath, 'utf-8');
            const statParts = stat.split(' ');
            
            // Read memory from /proc/[pid]/status
            const statusPath = `/proc/${pid}/status`;
            const status = fs.readFileSync(statusPath, 'utf-8');
            const vmRSSMatch = status.match(/VmRSS:\s+(\d+)/);
            const memoryKB = vmRSSMatch ? parseInt(vmRSSMatch[1]) : 0;
            
            // Get CPU usage (simplified - would need multiple samples for accurate CPU%)
            const utime = parseInt(statParts[13]);
            const stime = parseInt(statParts[14]);
            const totalTime = utime + stime;
            
            return {
                memory: memoryKB * 1024, // Convert to bytes
                cpu: 0, // Placeholder - accurate CPU% requires sampling over time
                alive: true
            };
        } else {
            // For non-Linux systems, return basic info
            return {
                memory: 0,
                cpu: 0,
                alive: true
            };
        }
    } catch (error) {
        return null;
    }
}

// POST /api/bot/start - Start the bot
router.post('/start', getUserFilePath, (req, res) => {
    const userId = req.user.id;

    if (runningBots.has(userId)) {
        return res.status(400).json({ success: false, error: 'Bot is already running' });
    }

    // Determine the startup command (this is a simplified example)
    // In a real app, this would be based on user's project type (e.g., python, node)
    const mainPy = path.join(req.userFilesDir, 'main.py');
    let command = 'node';
    let args = ['index.js'];

    if (fs.existsSync(mainPy)) {
        command = 'python';
        args = ['main.py'];
    }

    const logPath = path.join(req.userFilesDir, 'bot.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const botProcess = spawn(command, args, {
        cwd: req.userFilesDir,
        detached: true, // Allows the bot to run even if the main app crashes
        stdio: ['ignore', logStream, logStream]
    });

    botProcess.unref(); // The parent process can exit independently of the child

    runningBots.set(userId, {
        process: botProcess,
        startTime: Date.now(),
        pid: botProcess.pid
    });

    res.json({ success: true, message: 'Bot started successfully' });
});

// POST /api/bot/stop - Stop the bot
router.post('/stop', getUserFilePath, (req, res) => {
    const userId = req.user.id;
    const botData = runningBots.get(userId);

    if (!botData) {
        return res.status(400).json({ success: false, error: 'Bot is not running' });
    }

    botData.process.kill();
    runningBots.delete(userId);

    res.json({ success: true, message: 'Bot stopped successfully' });
});

// POST /api/bot/restart - Restart the bot
router.post('/restart', getUserFilePath, (req, res) => {
    const userId = req.user.id;
    const botData = runningBots.get(userId);

    if (botData) {
        botData.process.kill();
        runningBots.delete(userId);
    }
    
    // Simplified: re-use the start logic
    // A more robust implementation would wait for the process to exit before starting again
    const mainPy = path.join(req.userFilesDir, 'main.py');
    let command = 'node';
    let args = ['index.js'];

    if (fs.existsSync(mainPy)) {
        command = 'python';
        args = ['main.py'];
    }

    const logPath = path.join(req.userFilesDir, 'bot.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const newBotProcess = spawn(command, args, {
        cwd: req.userFilesDir,
        detached: true,
        stdio: ['ignore', logStream, logStream]
    });
    
    newBotProcess.unref();
    runningBots.set(userId, {
        process: newBotProcess,
        startTime: Date.now(),
        pid: newBotProcess.pid
    });

    res.json({ success: true, message: 'Bot restarted successfully' });
});

// GET /api/bot/status - Get bot status
router.get('/status', getUserFilePath, async (req, res) => {
    const userId = req.user.id;
    const botData = runningBots.get(userId);
    const isRunning = !!botData;

    if (!isRunning) {
        return res.json({
            success: true,
            status: {
                running: false,
                uptime: 0,
                memory: 0,
                cpu: 0
            }
        });
    }

    // Calculate uptime
    const uptime = Math.floor((Date.now() - botData.startTime) / 1000);
    
    // Get resource usage
    const stats = await getProcessStats(botData.pid);
    
    if (!stats) {
        // Process might have died
        runningBots.delete(userId);
        return res.json({
            success: true,
            status: {
                running: false,
                uptime: 0,
                memory: 0,
                cpu: 0
            }
        });
    }

    res.json({
        success: true,
        status: {
            running: true,
            uptime: uptime,
            memory: stats.memory,
            cpu: stats.cpu,
            pid: botData.pid
        }
    });
});

// GET /api/bot/logs - Get bot logs
router.get('/logs', getUserFilePath, (req, res) => {
    const logPath = path.join(req.userFilesDir, 'bot.log');
    if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf-8');
        res.json({ success: true, logs: logs });
    } else {
        res.json({ success: true, logs: 'No logs available' });
    }
});


module.exports = router;
