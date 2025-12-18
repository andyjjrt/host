const fs = require('fs');

/**
 * Get process statistics (memory, CPU) for a given PID
 * @param {number} pid - Process ID
 * @returns {Object|null} Process stats or null if unavailable
 */
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
            // For non-Linux platforms, return basic info
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

module.exports = {
    getProcessStats
};
