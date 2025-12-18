# ALN Hosting Platform

A comprehensive web-based hosting management platform for Discord bots with both frontend and backend functionality.

## 🌟 Features

### User Features
- **Discord OAuth Authentication** - Secure login with Discord
- **Dashboard** - Overview of hosting status and statistics
- **File Manager** - Upload, download, and manage bot files
- **Console** - Real-time logs and bot output
- **Bot Controls** - Start, stop, and restart your bot
- **Settings** - Configure bot environment and settings
- **Referral System** - Earn credits by referring users
- **Storage Management** - Track and manage file storage

### Admin Features
- **User Management** - View and manage all users
- **Server Management** - Control all hosting servers
- **Permissions** - Fine-grained access control
- **Webhooks** - Discord webhook notifications
- **Announcements** - System-wide announcements
- **Referral Management** - Manage withdrawal requests
- **Analytics** - Platform statistics and metrics

### Security Features
- **VPN/Proxy Detection** - Prevent abuse
- **Account Suspension** - Temporary account restrictions
- **IP Banning** - Block malicious IPs
- **Admin Connect Mode** - Secure admin access to user accounts
- **Session Management** - Secure cookie-based sessions

## 📋 Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn package manager
- Modern web browser

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd host
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Access the application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
host/
├── index.html          # Main HTML file with SPA structure
├── styles.css          # Comprehensive CSS styling
├── script.js           # Frontend JavaScript functionality
├── server.js           # Backend Express server
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## 🔧 Configuration

### Server Configuration
Edit `server.js` to configure:
- Port number (default: 3000)
- CORS settings
- API endpoints
- Mock data storage

### Frontend Configuration
Edit `script.js` to configure:
- API endpoint URL
- Feature flags
- UI settings

## 🎨 Customization

### Styling
The application uses CSS custom properties (variables) for easy theming. Edit `styles.css`:

```css
:root {
    --bg-primary: #0f0f1e;
    --bg-secondary: #1a1a2e;
    --accent-primary: #5865F2;
    /* ... more variables */
}
```

### Features
Toggle features in `script.js` by modifying function calls and routes.

## 🔌 API Endpoints

### Authentication
- `GET /api/auth/discord/login` - Initiate Discord OAuth
- `GET /api/auth/session` - Get current session
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/check-suspension` - Check account status

### Bot Management
- `POST /api/bot/start` - Start bot
- `POST /api/bot/stop` - Stop bot
- `POST /api/bot/restart` - Restart bot
- `GET /api/bot/status` - Get bot status
- `GET /api/bot/logs` - Get bot logs

### File Management
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `DELETE /api/files/:path` - Delete file

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/announcements` - Get announcements
- `POST /api/admin/announcements` - Create announcement
- `GET /api/admin/server-management/servers` - List servers

### Referrals
- `GET /api/referrals/stats` - Get referral statistics
- `GET /api/referrals/admin/withdrawals` - Get withdrawal requests

## 🔒 Security Notes

This is a **demo/starter implementation**. For production use:

1. **Implement Real Authentication**
   - Configure Discord OAuth with real credentials
   - Use secure session management (e.g., Redis)
   - Implement CSRF protection

2. **Use a Real Database**
   - Replace in-memory storage with PostgreSQL/MongoDB
   - Implement proper data validation
   - Use ORM/ODM for database operations

3. **Add Security Middleware**
   - Rate limiting
   - Input validation and sanitization
   - Helmet.js for security headers
   - HTTPS enforcement

4. **Environment Variables**
   - Store sensitive data in `.env` file
   - Never commit secrets to version control

5. **Error Handling**
   - Implement proper error logging
   - Use error monitoring services
   - Handle edge cases

## 🧪 Testing

Currently, the application serves mock data. To test:

1. Start the server: `npm start`
2. Open browser to `http://localhost:3000`
3. You'll see the login page
4. Click "Sign in with Discord" (will show mock response)
5. Explore the UI and features

## 📝 Development Roadmap

- [ ] Implement real Discord OAuth
- [ ] Add database integration
- [ ] Implement file upload/download
- [ ] Add WebSocket for real-time logs
- [ ] Implement actual bot hosting functionality
- [ ] Add payment integration
- [ ] Mobile responsive improvements
- [ ] Dark/light theme toggle
- [ ] Multi-language support

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Discord: https://discord.gg/Mqzh86Jyts
- Issues: Create an issue on GitHub

## 👏 Acknowledgments

- Font Awesome for icons
- Google Fonts for Inter font family
- Discord for OAuth integration inspiration

---

**Note**: This is a starter template. Implement proper security, database, and authentication before deploying to production.
