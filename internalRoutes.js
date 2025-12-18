const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const sessionStore = require('./sessionStore');

const USER_FILES_BASE_DIR = path.join(__dirname, 'user_files');

// Helper function to get process stats
async function getProcessStats(pid) {
    try {
        if (process.platform === 'linux') {
            const statPath = `/proc/${pid}/stat`;
            if (!fs.existsSync(statPath)) {
                return null;
            }
            
            const stat = fs.readFileSync(statPath, 'utf-8');
            const statParts = stat.split(' ');
            
            const statusPath = `/proc/${pid}/status`;
            const status = fs.readFileSync(statusPath, 'utf-8');
            const vmRSSMatch = status.match(/VmRSS:\s+(\d+)/);
            const memoryKB = vmRSSMatch ? parseInt(vmRSSMatch[1]) : 0;
            
            return {
                memory: memoryKB * 1024,
                cpu: 0,
                alive: true
            };
        } else {
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

// Helper to collect all user services info
async function getAllServicesInfo() {
    const services = [];
    
    // Get all user directories
    if (!fs.existsSync(USER_FILES_BASE_DIR)) {
        return services;
    }
    
    const userDirs = fs.readdirSync(USER_FILES_BASE_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    for (const userId of userDirs) {
        const userDir = path.join(USER_FILES_BASE_DIR, userId);
        
        // Get user info from session store (simplified)
        let username = `User-${userId}`;
        let userEmail = '';
        
        // Count files and get total size
        let fileCount = 0;
        let totalSize = 0;
        try {
            const files = fs.readdirSync(userDir);
            fileCount = files.length;
            for (const file of files) {
                const filePath = path.join(userDir, file);
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    totalSize += stat.size;
                }
            }
        } catch (error) {
            // Skip if error reading directory
        }
        
        // Check for running processes (simplified - in real implementation, track from botRoutes)
        const isRunning = false; // Placeholder
        const uptime = 0;
        
        // Determine service type
        let serviceType = 'unknown';
        if (fs.existsSync(path.join(userDir, 'main.py'))) {
            serviceType = 'python';
        } else if (fs.existsSync(path.join(userDir, 'index.js'))) {
            serviceType = 'javascript';
        }
        
        services.push({
            id: userId,
            name: `Service-${userId.substring(0, 8)}`,
            owner: {
                username: username,
                discord_id: userId
            },
            language: serviceType,
            is_running: isRunning,
            status: isRunning ? 'running' : 'offline',
            uptime: uptime,
            memory: 0,
            cpu: 0,
            fileCount: fileCount,
            storageUsed: totalSize,
            ip: '127.0.0.1',
            ban_status: null,
            createdAt: new Date().toISOString()
        });
    }
    
    return services;
}

// Check if user has admin access
function checkAdminAccess(req, res, next) {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.has(sessionId)) {
        return res.status(401).json({ 
            success: false, 
            error: 'Not authenticated',
            code: '403-PERM-DENIED'
        });
    }
    
    const user = sessionStore.get(sessionId);
    // In a real implementation, check if user has admin role
    // For now, allow all authenticated users
    
    next();
}

// GET /api/internal/check-access - Check admin access
router.get('/check-access', checkAdminAccess, (req, res) => {
    res.json({
        success: true,
        hasAccess: true
    });
});

// GET /api/internal/servers - Get all managed servers/services
router.get('/servers', checkAdminAccess, async (req, res) => {
    try {
        const services = await getAllServicesInfo();
        
        const stats = {
            total: services.length,
            running: services.filter(s => s.status === 'running').length,
            stopped: services.filter(s => s.status === 'offline').length,
            suspended: services.filter(s => s.status === 'suspended').length,
            banned: services.filter(s => s.status === 'banned').length
        };
        
        res.json({
            success: true,
            servers: services,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting servers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve servers'
        });
    }
});

// GET /api/internal/resources - Get overall resource usage
router.get('/resources', checkAdminAccess, async (req, res) => {
    try {
        const services = await getAllServicesInfo();
        
        const totalMemory = services.reduce((sum, s) => sum + s.memory, 0);
        const avgCpu = services.length > 0 
            ? services.reduce((sum, s) => sum + s.cpu, 0) / services.length 
            : 0;
        
        const totalStorage = services.reduce((sum, s) => sum + s.storageUsed, 0);
        const storageLimit = 500 * 1024 * 1024 * services.length; // 500MB per service
        
        res.json({
            success: true,
            resources: {
                memory: {
                    used: totalMemory,
                    total: 2 * 1024 * 1024 * 1024, // 2GB total (example)
                    percentage: (totalMemory / (2 * 1024 * 1024 * 1024)) * 100
                },
                cpu: {
                    usage: avgCpu,
                    cores: require('os').cpus().length
                },
                storage: {
                    used: totalStorage,
                    total: storageLimit,
                    percentage: storageLimit > 0 ? (totalStorage / storageLimit) * 100 : 0
                },
                services: {
                    total: services.length,
                    active: services.filter(s => s.status === 'running').length
                }
            }
        });
    } catch (error) {
        console.error('Error getting resources:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve resources'
        });
    }
});

module.exports = router;
