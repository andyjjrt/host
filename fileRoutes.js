const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sessionStore = require('./sessionStore');

const USER_FILES_BASE_DIR = path.join(__dirname, 'user_files');

// Ensure the base directory for user files exists
if (!fs.existsSync(USER_FILES_BASE_DIR)) {
    fs.mkdirSync(USER_FILES_BASE_DIR, { recursive: true });
}

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

    // Ensure user's directory exists
    if (!fs.existsSync(req.userFilesDir)) {
        fs.mkdirSync(req.userFilesDir, { recursive: true });
    }
    
    next();
};

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, req.userFilesDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });


// GET /api/files - List files and storage usage
router.get('/', getUserFilePath, (req, res) => {
    try {
        const files = fs.readdirSync(req.userFilesDir, { withFileTypes: true });
        const fileList = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            size: fs.statSync(path.join(req.userFilesDir, file.name)).size,
        }));
        
        const totalSize = fileList.reduce((acc, file) => acc + file.size, 0);
        const limit = 500 * 1024 * 1024; // 500MB limit

        res.json({
            success: true,
            files: fileList,
            storage: {
                used: totalSize,
                limit: limit,
                percentage: (totalSize / limit) * 100
            }
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ success: false, error: 'Failed to list files' });
    }
});

// POST /api/files/upload - Upload a file
router.post('/upload', getUserFilePath, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({ success: true, message: 'File uploaded successfully', file: req.file });
});

// DELETE /api/files/:path - Delete a file
router.delete('/:path', getUserFilePath, (req, res) => {
    const fileName = req.params.path;
    const filePath = path.join(req.userFilesDir, fileName);

    // Security check: ensure the path doesn't go outside the user's directory
    if (path.dirname(filePath) !== req.userFilesDir) {
        return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'File deleted successfully' });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, error: 'Failed to delete file' });
    }
});

// GET /api/files/download/:path - Download a file
router.get('/download/:path', getUserFilePath, (req, res) => {
    const fileName = req.params.path;
    const filePath = path.join(req.userFilesDir, fileName);

    // Security check: ensure the path doesn't go outside the user's directory
    if (path.dirname(filePath) !== req.userFilesDir) {
        return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                return res.status(400).json({ success: false, error: 'Cannot download a directory' });
            }
            res.download(filePath, fileName);
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ success: false, error: 'Failed to download file' });
    }
});

// GET /api/files/view/:path - View/read file content
router.get('/view/:path', getUserFilePath, (req, res) => {
    const fileName = req.params.path;
    const filePath = path.join(req.userFilesDir, fileName);

    // Security check: ensure the path doesn't go outside the user's directory
    if (path.dirname(filePath) !== req.userFilesDir) {
        return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                return res.status(400).json({ success: false, error: 'Cannot view a directory' });
            }
            
            const content = fs.readFileSync(filePath, 'utf-8');
            res.json({ 
                success: true, 
                content: content,
                name: fileName,
                size: stat.size
            });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ success: false, error: 'Failed to read file' });
    }
});

// PUT /api/files/edit/:path - Edit/update file content
router.put('/edit/:path', getUserFilePath, (req, res) => {
    const fileName = req.params.path;
    const filePath = path.join(req.userFilesDir, fileName);
    const { content } = req.body;

    if (content === undefined) {
        return res.status(400).json({ success: false, error: 'No content provided' });
    }

    // Security check: ensure the path doesn't go outside the user's directory
    if (path.dirname(filePath) !== req.userFilesDir) {
        return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                return res.status(400).json({ success: false, error: 'Cannot edit a directory' });
            }
        }
        
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: 'File updated successfully' });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ success: false, error: 'Failed to update file' });
    }
});


module.exports = router;
