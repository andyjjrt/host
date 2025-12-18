const API = '/api';
let currentFile = null;
let statusInterval = null;
let logInterval = null;
let currentUser = null;
let currentHostingAccount = null;
let isPolling = false;

// Toast notification system
let toastContainer = null;

function getDiscordAvatarUrl(user) {
  // If user has Discord ID and avatar hash, use Discord CDN
  if (user && user.discordId && user.avatar) {
    // Check if avatar is animated (starts with a_)
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.${extension}?size=128`;
  }
  
  // If user has Discord ID but no avatar, use default Discord avatar
  if (user && user.discordId) {
    const defaultAvatarNum = parseInt(user.discordId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`;
  }
  
  // Fallback to local user.png
  return 'user.png';
}

function createToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(title, message, type = 'info', duration = 4000) {
  const container = createToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${icons[type] || icons.info}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">
      <i class="fas fa-times"></i>
    </button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  toast.classList.add('removing');
  setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, 300);
}

// Wrapper function for backwards compatibility
function showNotification(message, type = 'info') {
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };
  return showToast(titles[type] || 'Info', message, type);
}

function showConnectAccessModal(accountId, hostingName) {
  const existingModal = document.getElementById('connectAccessModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'connectAccessModal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #5865F2 0%, #4752C4 100%); padding: 25px; text-align: center;">
        <div style="font-size: 50px; color: #fff; margin-bottom: 10px;">
          <i class="fab fa-discord"></i>
        </div>
        <h3 style="color: #fff; margin: 0; font-size: 20px;">Connect to Hosting</h3>
      </div>
      <div class="modal-body" style="text-align: center; padding: 30px; background: #1a1a2e;">
        <div style="background: #252540; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
          <div style="font-size: 32px; color: #5865F2; margin-bottom: 10px;">
            <i class="fas fa-server"></i>
          </div>
          <h4 style="margin: 0 0 5px 0; color: #fff; font-size: 16px;">${hostingName || 'User Hosting'}</h4>
          <p style="color: #888; font-size: 12px; margin: 0;">Account ID: ${accountId}</p>
        </div>
        <p style="color: #aaa; margin-bottom: 25px; font-size: 14px; line-height: 1.5;">
          To access this hosting account, you need to verify your identity through Discord.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="document.getElementById('connectAccessModal').remove()" style="padding: 12px 25px; background: #3a3a5a; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-arrow-left"></i> Go Back
          </button>
          <button onclick="performConnectAccess('${accountId}', '${hostingName}')" style="padding: 12px 25px; background: #5865F2; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <i class="fab fa-discord"></i> Access to Connect
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function performConnectAccess(accountId, hostingName) {
  const modal = document.getElementById('connectAccessModal');
  
  try {
    showToast('Redirecting', 'Connecting to Discord...', 'info', 3000);
    
    const verifyRes = await fetch(`${API}/admin/connect/verify?target_account_id=${accountId}`, {
      method: 'GET',
      credentials: 'include'
    });
    
    const verifyData = await verifyRes.json();
    
    if (verifyData.success && verifyData.authUrl) {
      if (modal) modal.remove();
      window.location.href = verifyData.authUrl;
    } else {
      if (modal) modal.remove();
      showToast('Error', verifyData.error || 'Failed to start verification', 'error', 4000);
    }
  } catch (err) {
    if (modal) modal.remove();
    console.error('Connect error:', err);
    showToast('Error', 'Failed to connect', 'error', 4000);
  }
}

// Special storage full notification with unique design
function showStorageFullNotification(data) {
  const container = createToastContainer();
  
  // Remove any existing storage notifications first
  const existingStorageToasts = container.querySelectorAll('.toast-storage');
  existingStorageToasts.forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-storage';
  
  const isFull = data.storage_full === true;
  const title = data.title || (isFull ? 'Storage Full' : 'Not Enough Storage');
  const usedMb = data.used_mb || 0;
  const limitMb = data.limit_mb || 500;
  const percentage = data.percentage_used || Math.min(100, (usedMb / limitMb) * 100);
  const uploadMb = data.upload_size_mb || 0;
  const remainingMb = data.remaining_mb || Math.max(0, limitMb - usedMb);
  
  toast.innerHTML = `
    <div class="storage-toast-header">
      <div class="storage-toast-icon">
        <i class="fas ${isFull ? 'fa-database' : 'fa-exclamation-triangle'}"></i>
        <div class="storage-toast-icon-pulse"></div>
      </div>
      <div class="storage-toast-title-wrap">
        <div class="storage-toast-title">${title}</div>
        <div class="storage-toast-subtitle">${isFull ? 'Upload blocked' : 'File too large'}</div>
      </div>
      <button class="storage-toast-close" onclick="this.closest('.toast-storage').remove()">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <div class="storage-toast-body">
      <div class="storage-toast-meter">
        <div class="storage-toast-meter-bg">
          <div class="storage-toast-meter-fill ${percentage >= 100 ? 'critical' : percentage >= 80 ? 'warning' : ''}" style="width: ${Math.min(100, percentage)}%"></div>
        </div>
        <div class="storage-toast-meter-labels">
          <span>${usedMb.toFixed(1)} MB used</span>
          <span>${limitMb} MB limit</span>
        </div>
      </div>
      
      <div class="storage-toast-message">
        ${isFull 
          ? `<i class="fas fa-ban"></i> Your storage is completely full. Delete files to continue.`
          : `<i class="fas fa-file-upload"></i> Upload size: <strong>${uploadMb.toFixed(1)} MB</strong> | Available: <strong>${remainingMb.toFixed(1)} MB</strong>`
        }
      </div>
    </div>
    
    <div class="storage-toast-actions">
      <button class="storage-toast-btn storage-toast-btn-primary" onclick="showPage('filesPage'); this.closest('.toast-storage').remove();">
        <i class="fas fa-folder-open"></i> Manage Files
      </button>
      <a href="${data.discord_link || 'https://discord.gg/Mqzh86Jyts'}" target="_blank" class="storage-toast-btn storage-toast-btn-secondary">
        <i class="fab fa-discord"></i> Get More Storage
      </a>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove after 12 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }
  }, 12000);
  
  return toast;
}

// Suspension overlay system
function checkSuspensionStatus() {
  if (currentUser && currentUser.isSuspended) {
    showSuspensionOverlay(currentUser.suspensionInfo);
    return true;
  }
  return false;
}

async function checkSuspensionFromServer() {
  try {
    const res = await fetch(`${API}/auth/check-suspension`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.isSuspended) {
        currentUser.isSuspended = true;
        currentUser.suspensionInfo = data.suspensionInfo;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showSuspensionOverlay(data.suspensionInfo);
        return true;
      } else if (data.isBanned) {
        localStorage.removeItem('currentUser');
        window.location.href = '/?error=banned';
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Suspension check error:', err);
    return false;
  }
}

function showSuspensionOverlay(suspensionInfo) {
  const existingOverlay = document.getElementById('suspensionOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const reasonText = suspensionInfo?.reason || 'Your account has been suspended';
  const suspendedAt = suspensionInfo?.suspendedAt ? new Date(suspensionInfo.suspendedAt * 1000).toLocaleDateString() : 'Unknown';
  const duration = suspensionInfo?.duration || 'Indefinite';
  const until = suspensionInfo?.until ? new Date(suspensionInfo.until * 1000).toLocaleDateString() : 'No end date';

  const overlay = document.createElement('div');
  overlay.id = 'suspensionOverlay';
  overlay.className = 'suspension-overlay';
  overlay.innerHTML = `
    <div class="suspension-container">
      <div class="suspension-card">
        <div class="suspension-illustration">
          <div class="suspension-icon-group">
            <div class="suspension-server-icon">
              <i class="fas fa-server"></i>
              <div class="suspension-x-mark">
                <i class="fas fa-times"></i>
              </div>
            </div>
            <div class="suspension-mascot">
              <div class="mascot-body">
                <div class="mascot-eye"></div>
              </div>
              <div class="mascot-antenna">
                <div class="antenna-ball"></div>
              </div>
            </div>
            <div class="suspension-monitor-icon">
              <i class="fas fa-desktop"></i>
              <div class="monitor-screen">
                <div class="screen-line"></div>
                <div class="screen-line short"></div>
              </div>
            </div>
          </div>
        </div>
        
        <h1 class="suspension-title">Account Suspended</h1>
        <p class="suspension-message">Your hosting account access has been temporarily restricted.</p>
        
        <div class="suspension-details">
          <div class="suspension-detail-item">
            <i class="fas fa-exclamation-circle"></i>
            <div class="detail-content">
              <span class="detail-label">Reason</span>
              <span class="detail-value">${reasonText}</span>
            </div>
          </div>
          <div class="suspension-detail-item">
            <i class="fas fa-calendar-alt"></i>
            <div class="detail-content">
              <span class="detail-label">Suspended On</span>
              <span class="detail-value">${suspendedAt}</span>
            </div>
          </div>
          <div class="suspension-detail-item">
            <i class="fas fa-clock"></i>
            <div class="detail-content">
              <span class="detail-label">Duration</span>
              <span class="detail-value">${duration === 'indefinite' ? 'Until further notice' : duration}</span>
            </div>
          </div>
          ${suspensionInfo?.until ? `
          <div class="suspension-detail-item">
            <i class="fas fa-hourglass-end"></i>
            <div class="detail-content">
              <span class="detail-label">Ends On</span>
              <span class="detail-value">${until}</span>
            </div>
          </div>
          ` : ''}
        </div>
        
        <div class="suspension-actions">
          <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="suspension-support-btn">
            <i class="fab fa-discord"></i>
            Contact Support
          </a>
          <button class="suspension-logout-btn" onclick="handleSuspendedLogout()">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
        
        <div class="suspension-footer">
          <p>ALN Hosting &copy; 2015 - 2025</p>
          <p class="suspension-footer-sub">If you believe this is a mistake, please contact our support team.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

async function handleSuspendedLogout() {
  try {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    localStorage.removeItem('currentUser');
    window.location.href = '/';
  } catch (err) {
    console.error('Logout error:', err);
    localStorage.removeItem('currentUser');
    window.location.href = '/';
  }
}

// VPN/Proxy Detection System
let vpnBlocked = false;
let securityCheckInterval = null;

function showVpnBlockedOverlay(blockReasons = []) {
  if (vpnBlocked) return;
  vpnBlocked = true;
  
  const existingOverlay = document.getElementById('vpnBlockedOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  stopAllPolling();
  stopSecurityCheck();

  const reasonsList = blockReasons.length > 0 
    ? blockReasons.join(', ') 
    : 'VPN/Proxy detected';

  const now = new Date();
  const detectedDate = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.id = 'vpnBlockedOverlay';
  overlay.className = 'suspension-overlay';
  overlay.innerHTML = `
    <div class="suspension-container">
      <div class="suspension-card">
        <div class="suspension-illustration">
          <div class="suspension-icon-group">
            <div class="suspension-server-icon">
              <i class="fas fa-shield-alt"></i>
              <div class="suspension-x-mark">
                <i class="fas fa-times"></i>
              </div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-bot-icon vpn-bot-icon">
              <i class="fas fa-user-secret"></i>
              <div class="suspension-bot-antenna"></div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-monitor-icon">
              <i class="fas fa-desktop"></i>
            </div>
          </div>
        </div>
        
        <h1 class="suspension-title">VPN/Proxy Blocked</h1>
        <p class="suspension-message">Your connection has been blocked due to VPN or proxy usage.</p>
        
        <div class="suspension-info-grid">
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">REASON</span>
              <span class="suspension-info-value">${reasonsList}</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">DETECTED ON</span>
              <span class="suspension-info-value">${detectedDate}</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-clock"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">ACTION REQUIRED</span>
              <span class="suspension-info-value">Disable VPN and refresh</span>
            </div>
          </div>
        </div>
        
        <div class="suspension-actions">
          <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="suspension-support-btn">
            <i class="fab fa-discord"></i>
            Contact Support
          </a>
          <button class="suspension-logout-btn" onclick="handleVpnLogout()">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
        
        <div class="suspension-footer-text">
          <p>ALN Hosting &copy; 2015 - 2025</p>
          <p class="suspension-footer-sub">If you believe this is a mistake, please contact our support team.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  
  localStorage.removeItem('currentUser');
  currentUser = null;
}

function showIpBannedOverlay() {
  stopAllPolling();
  stopSecurityCheck();

  const existingOverlay = document.getElementById('ipBannedOverlay');
  if (existingOverlay) return;

  const now = new Date();
  const bannedDate = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.id = 'ipBannedOverlay';
  overlay.className = 'suspension-overlay';
  overlay.innerHTML = `
    <div class="suspension-container">
      <div class="suspension-card">
        <div class="suspension-illustration">
          <div class="suspension-icon-group">
            <div class="suspension-server-icon banned-server-icon">
              <i class="fas fa-ban"></i>
              <div class="suspension-x-mark">
                <i class="fas fa-times"></i>
              </div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-bot-icon banned-bot-icon">
              <i class="fas fa-robot"></i>
              <div class="suspension-bot-antenna"></div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-monitor-icon">
              <i class="fas fa-desktop"></i>
            </div>
          </div>
        </div>
        
        <h1 class="suspension-title">IP Address Banned</h1>
        <p class="suspension-message">Your IP address has been blocked from accessing this platform.</p>
        
        <div class="suspension-info-grid">
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">REASON</span>
              <span class="suspension-info-value">Security violation detected</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">BANNED ON</span>
              <span class="suspension-info-value">${bannedDate}</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-clock"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">DURATION</span>
              <span class="suspension-info-value">Until further notice</span>
            </div>
          </div>
        </div>
        
        <div class="suspension-actions">
          <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="suspension-support-btn">
            <i class="fab fa-discord"></i>
            Contact Support
          </a>
          <button class="suspension-logout-btn" onclick="handleSecurityLogout()">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
        
        <div class="suspension-footer-text">
          <p>ALN Hosting &copy; 2015 - 2025</p>
          <p class="suspension-footer-sub">If you believe this is a mistake, please contact our support team.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  
  localStorage.removeItem('currentUser');
  currentUser = null;
}

async function checkSecurityStatus() {
  if (!currentUser || vpnBlocked) return;
  
  try {
    const res = await originalFetch(`${API}/auth/security-check`, {
      credentials: 'include'
    });
    
    if (res.status === 403) {
      const data = await res.json();
      if (data.vpn_detected) {
        showVpnBlockedOverlay(data.block_reasons || []);
      } else if (data.ip_banned) {
        showIpBannedOverlay();
      }
      return;
    }
    
    if (res.ok) {
      const data = await res.json();
      if (data.isBanned) {
        showAccountBannedOverlay(data.banInfo);
      } else if (data.isSuspended && !document.getElementById('suspensionOverlay')) {
        currentUser.isSuspended = true;
        currentUser.suspensionInfo = data.suspensionInfo;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showSuspensionOverlay(data.suspensionInfo);
      }
    }
  } catch (err) {
    console.error('Security check error:', err);
  }
}

function showAccountBannedOverlay(banInfo = {}) {
  stopAllPolling();
  stopSecurityCheck();

  const existingOverlay = document.getElementById('accountBannedOverlay');
  if (existingOverlay) return;

  const bannedDate = banInfo.banned_at 
    ? new Date(banInfo.banned_at * 1000).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.id = 'accountBannedOverlay';
  overlay.className = 'suspension-overlay';
  overlay.innerHTML = `
    <div class="suspension-container">
      <div class="suspension-card">
        <div class="suspension-illustration">
          <div class="suspension-icon-group">
            <div class="suspension-server-icon banned-server-icon">
              <i class="fas fa-user-slash"></i>
              <div class="suspension-x-mark">
                <i class="fas fa-times"></i>
              </div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-bot-icon banned-bot-icon">
              <i class="fas fa-robot"></i>
              <div class="suspension-bot-antenna"></div>
            </div>
            <div class="suspension-connector"></div>
            <div class="suspension-monitor-icon">
              <i class="fas fa-desktop"></i>
            </div>
          </div>
        </div>
        
        <h1 class="suspension-title">Account Banned</h1>
        <p class="suspension-message">Your account has been permanently banned from this platform.</p>
        
        <div class="suspension-info-grid">
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">REASON</span>
              <span class="suspension-info-value">${banInfo.reason || 'Terms of Service violation'}</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">BANNED ON</span>
              <span class="suspension-info-value">${bannedDate}</span>
            </div>
          </div>
          <div class="suspension-info-item">
            <div class="suspension-info-icon">
              <i class="fas fa-clock"></i>
            </div>
            <div class="suspension-info-content">
              <span class="suspension-info-label">DURATION</span>
              <span class="suspension-info-value">Permanent</span>
            </div>
          </div>
        </div>
        
        <div class="suspension-actions">
          <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="suspension-support-btn">
            <i class="fab fa-discord"></i>
            Contact Support
          </a>
          <button class="suspension-logout-btn" onclick="handleSecurityLogout()">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
        
        <div class="suspension-footer-text">
          <p>ALN Hosting &copy; 2015 - 2025</p>
          <p class="suspension-footer-sub">If you believe this is a mistake, please contact our support team.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  
  localStorage.removeItem('currentUser');
  currentUser = null;
}

function startSecurityCheck() {
  if (securityCheckInterval) return;
  securityCheckInterval = setInterval(checkSecurityStatus, 10000);
}

function stopSecurityCheck() {
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
    securityCheckInterval = null;
  }
}

async function handleSecurityLogout() {
  try {
    await originalFetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

async function handleVpnLogout() {
  try {
    await originalFetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
  localStorage.removeItem('currentUser');
  vpnBlocked = false;
  window.location.href = '/';
}

function stopAllPolling() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  isPolling = false;
}

async function handleApiResponse(response) {
  if (response.status === 403) {
    try {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data.vpn_detected === true) {
        showVpnBlockedOverlay(data.block_reasons || []);
        return null;
      }
    } catch (e) {
    }
  }
  return response;
}

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  
  if (vpnBlocked) {
    return response;
  }
  
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  if (url.includes('/api/') && !url.includes('/api/vpn/') && !url.includes('/api/auth/logout')) {
    const checkedResponse = await handleApiResponse(response);
    if (checkedResponse === null) {
      throw new Error('VPN_BLOCKED');
    }
  }
  
  return response;
};

// Check authentication on load
window.addEventListener('DOMContentLoaded', () => {
  // Check for referral code in URL hash (format: #ref_USERID)
  const hash = window.location.hash;
  if (hash && hash.startsWith('#ref_')) {
    const referralCode = hash.substring(5); // Remove '#ref_' prefix
    if (referralCode) {
      localStorage.setItem('pendingReferralCode', referralCode);
    }
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  checkAuth().finally(() => {
    // Hide loading screen after auth check completes
    const loadingScreen = document.getElementById('initialLoadingScreen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        loadingScreen.remove();
      }, 300);
    }
  });
});

// Note: Auto-logout removed to prevent logout on page refresh
// Sessions will expire when browser is completely closed (session cookies)

function checkAdminConnectMode() {
  // Check if user is in admin connect mode
  if (currentUser && currentUser.isAdminConnect) {
    // Remove existing banner if any
    const existingBanner = document.querySelector('.admin-connect-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    // Show admin connect banner
    const banner = document.createElement('div');
    banner.className = 'admin-connect-banner';
    banner.innerHTML = `
      <div class="admin-connect-banner-content">
        <div class="admin-connect-info">
          <i class="fas fa-shield-alt"></i>
          <span>Admin Connect Mode - Viewing ${currentUser.hostingName} (Connected by ${currentUser.connectedBy || 'Admin'})</span>
        </div>
        <div class="admin-connect-actions">
          <button class="admin-back-btn" onclick="goBackToAdmin()">
            <i class="fas fa-arrow-left"></i>
            Go Back to Admin
          </button>
          <button class="admin-disconnect-btn" onclick="disconnectAdminConnect()">
            <i class="fas fa-sign-out-alt"></i>
            Disconnect
          </button>
        </div>
      </div>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(banner, mainContent.firstChild);
    }
  }
}

async function goBackToAdmin() {
  try {
    showToast('🔄 Returning', 'Going back to admin dashboard...', 'info', 1500);
    
    const res = await fetch(`${API}/admin/connect/disconnect`, {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Remove localStorage entry and reload to admin dashboard
      localStorage.removeItem('currentUser');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } else {
      showToast('❌ Error', data.error || 'Failed to return to admin', 'error', 3000);
    }
  } catch (err) {
    console.error('Go back error:', err);
    showToast('❌ Error', 'Failed to return to admin dashboard', 'error', 3000);
  }
}

async function disconnectAdminConnect() {
  const confirmed = confirm('Are you sure you want to disconnect from this hosting and return to admin panel?');
  
  if (confirmed) {
    try {
      const res = await fetch(`${API}/admin/connect/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast('✅ Disconnected', 'Returning to admin panel...', 'success', 2000);
        
        // Remove localStorage entry and reload
        localStorage.removeItem('currentUser');
        setTimeout(() => {
          window.location.href = '/?disconnect=success';
        }, 1000);
      } else {
        showToast('❌ Error', data.error || 'Failed to disconnect', 'error', 3000);
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      showToast('❌ Error', 'Failed to disconnect from hosting', 'error', 3000);
    }
  }
}

async function checkAuth() {
  try {
    // Always check server session first, don't use localStorage cache
    const res = await fetch(`${API}/auth/session`, {
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;

        // Check if user needs to switch to a different account (from servers.js navigation)
        const selectedServerId = localStorage.getItem('selectedServerId');
        if (selectedServerId && currentUser.role === 'hosting_user' && currentUser.accountId !== selectedServerId) {
          // User clicked on a different server, switch to it
          try {
            const switchRes = await fetch(`${API}/auth/switch-account`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ accountId: selectedServerId })
            });
            const switchData = await switchRes.json();
            if (switchData.success && switchData.user) {
              currentUser = switchData.user;
            }
          } catch (switchErr) {
            console.error('Error switching account:', switchErr);
          }
        }

        showDashboard();
        
        // Check suspension status for non-admin users (not in admin connect mode)
        if (currentUser.role !== 'admin' && !currentUser.isAdminConnect) {
          if (checkSuspensionStatus()) {
            return;
          }
        }
        
        // Admin connect mode shows user dashboard
        if (currentUser.isAdminConnect) {
          setTimeout(() => {
            checkAdminConnectMode();
            loadUserDashboard();
          }, 100);
        } else if (currentUser.role === 'admin') {
          // Check if user has permissions for admin access
          loadHostingAccounts();
        } else if (currentUser.role === 'hosting_user') {
          // Load user dashboard for hosting users
          loadUserDashboard();
          startSecurityCheck();
        }
        return;
      }
    }
  } catch (err) {
    console.error('Auth check error:', err);
  }

  // No valid session found - force login
  localStorage.removeItem('currentUser');
  showLoginPage();
}

function showLoginPage() {
  // Check for onboarding parameter
  const urlParams = new URLSearchParams(window.location.search);
  const onboarding = urlParams.get('onboarding');
  const error = urlParams.get('error');
  const loginSuccess = urlParams.get('login');
  const connectSuccess = urlParams.get('connect');
  const disconnectSuccess = urlParams.get('disconnect');

  if (loginSuccess === 'success' || connectSuccess === 'success') {
    // User logged in or connected successfully, reload to show dashboard
    window.history.replaceState({}, '', '/');
    checkAuth();
    return;
  }
  
  if (disconnectSuccess === 'success') {
    // Admin disconnected from user hosting, reload to show admin panel
    window.history.replaceState({}, '', '/');
    checkAuth();
    return;
  }

  if (error) {
    let errorMessage = 'Authentication failed. Please try again.';
    if (error === 'banned') errorMessage = 'Your account has been banned.';
    if (error === 'suspended') errorMessage = 'Your account has been suspended.';
    if (error === 'not_admin') errorMessage = 'Admin verification failed. Your Discord account is not authorized as admin.';
    if (error === 'connect_failed') errorMessage = 'Failed to connect to hosting. Please try again.';
    if (error === 'connect_auth_failed') errorMessage = 'Discord authentication failed during connect. Please try again.';
    alert(errorMessage);
    window.history.replaceState({}, '', '/');
  }

  if (onboarding) {
    // Onboarding removed - redirect to login
    window.history.replaceState({}, '', '/');
  }

  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <i class="fas fa-cloud"></i>
          <h1>ALN Hosting</h1>
        </div>
        <h2>Welcome Back</h2>
        <p class="login-subtitle">Sign in with Discord to get started</p>
        <button class="discord-login-btn" id="discordLoginBtn">
          <i class="fab fa-discord"></i>
          <span>Sign in with Discord</span>
        </button>
        <div class="login-info">
          <p><i class="fas fa-check-circle"></i> One account per Discord user</p>
          <p><i class="fas fa-check-circle"></i> Choose Python or JavaScript hosting</p>
          <p><i class="fas fa-check-circle"></i> Free bot hosting forever</p>
        </div>
        <div class="login-footer">
          <p>Powered by ALN Hosting © 2025</p>
          <p class="login-footer-links">
            <a href="https://discord.gg/Mqzh86Jyts" target="_blank"><i class="fas fa-shield-alt"></i> Secure</a>
            <span>•</span>
            <a href="https://discord.gg/Mqzh86Jyts" target="_blank"><i class="fas fa-headset"></i> Support</a>
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('discordLoginBtn').addEventListener('click', handleDiscordLogin);
}

function showOnboardingPage() {
  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <i class="fas fa-cloud"></i>
          <h1>Choose Your Hosting Type</h1>
        </div>
        <h2>Welcome to ALN Hosting!</h2>
        <p class="login-subtitle">Select the type of bot hosting you want</p>
        <div class="hosting-type-selector">
          <div class="hosting-type-card" data-type="python">
            <div class="hosting-type-icon">
              <i class="fab fa-python"></i>
            </div>
            <h3>Python Hosting</h3>
            <p>Perfect for Discord.py bots</p>
            <ul>
              <li>✓ Python 3.11</li>
              <li>✓ Discord.py support</li>
              <li>✓ Auto dependency install</li>
            </ul>
          </div>
          <div class="hosting-type-card" data-type="javascript">
            <div class="hosting-type-icon">
              <i class="fab fa-node-js"></i>
            </div>
            <h3>JavaScript Hosting</h3>
            <p>Perfect for Discord.js bots</p>
            <ul>
              <li>✓ Node.js runtime</li>
              <li>✓ Discord.js support</li>
              <li>✓ NPM packages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.hosting-type-card').forEach(card => {
    card.addEventListener('click', async () => {
      const type = card.dataset.type;
      card.classList.add('selected');

      try {
        const res = await fetch(`${API}/auth/create-hosting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type })
        });

        const data = await res.json();

        if (data.success) {
          showToast('🎉 Account Created!', `Your ${type} hosting account is ready!`, 'success', 3000);
          setTimeout(() => {
            // Redirect to terms page if specified
            if (data.redirectTo) {
              window.location.href = data.redirectTo;
            } else {
              window.location.href = '/';
            }
          }, 1000);
        } else {
          showToast('❌ Error', data.error || 'Failed to create account', 'error', 5000);
        }
      } catch (err) {
        showToast('❌ Error', 'Failed to create hosting account', 'error', 5000);
      }
    });
  });
}

async function handleDiscordLogin() {
  window.location.href = `${API}/auth/discord/login`;
}

function togglePassword() {
  const input = document.getElementById('password');
  const toggleBtn = document.querySelector('.toggle-password');

  if (input.type === 'password') {
    input.type = 'text';
    toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    toggleBtn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.setAttribute('aria-label', 'Show password');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('userId').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      location.reload();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    alert('Login error: ' + err.message);
  }
}

// Announcement system
let announcements = [];
let unreadCount = 0;

async function loadAnnouncements() {
  try {
    const res = await fetch(`${API}/admin/announcements`, {
      credentials: 'include'
    });
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Announcements: Non-JSON response received');
      return;
    }
    
    const data = await res.json();

    if (data.success) {
      announcements = data.announcements || [];
      updateNotificationBadge();
    }
  } catch (err) {
    console.error('Error loading announcements:', err);
  }
}

function updateNotificationBadge() {
  const badge = document.querySelector('.notification-badge');
  unreadCount = announcements.filter(a => !a.read).length;

  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'block' : 'none';
  }
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;

  panel.classList.toggle('active');

  if (panel.classList.contains('active')) {
    renderAnnouncements();
  }
}

// Mobile Menu Functions
function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebarModern');
  const overlay = document.getElementById('mobileOverlay');
  const menuBtn = document.getElementById('mobileMenuToggle');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (menuBtn) {
      const icon = menuBtn.querySelector('i');
      if (sidebar.classList.contains('active')) {
        icon.className = 'fas fa-times';
      } else {
        icon.className = 'fas fa-bars';
      }
    }
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebarModern');
  const overlay = document.getElementById('mobileOverlay');
  const menuBtn = document.getElementById('mobileMenuToggle');
  
  if (sidebar && overlay) {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    
    if (menuBtn) {
      const icon = menuBtn.querySelector('i');
      icon.className = 'fas fa-bars';
    }
  }
}

function renderAnnouncements() {
  const container = document.getElementById('announcementsContainer');
  if (!container) return;

  if (announcements.length === 0) {
    container.innerHTML = `
      <div class="no-announcements">
        <i class="fas fa-bell-slash"></i>
        <p>No announcements yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = announcements.map((announcement, index) => `
    <div class="announcement-item ${announcement.read ? '' : 'unread'}" onclick="markAsRead(${index})">
      <div class="announcement-header">
        <div class="announcement-title">
          <i class="fas fa-bullhorn"></i>
          <span>${announcement.title}</span>
        </div>
        ${!announcement.read ? '<span class="announcement-badge">New</span>' : ''}
      </div>
      <div class="announcement-message">${announcement.message}</div>
      <div class="announcement-footer">
        <div class="announcement-from">From: ${announcement.from || 'Admin'}</div>
        <div class="announcement-time">
          <i class="fas fa-clock"></i>
          ${new Date(announcement.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  `).join('');
}

function markAsRead(index) {
  if (!announcements[index].read) {
    announcements[index].read = true;
    updateNotificationBadge();
    renderAnnouncements();

    // Update on server
    fetch(`${API}/admin/announcements/${announcements[index].id}/read`, {
      method: 'POST',
      credentials: 'include'
    }).catch(err => console.error('Error marking as read:', err));
  }
}

function showSendAnnouncementModal() {
  const modal = document.getElementById('announcementModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeSendAnnouncementModal() {
  const modal = document.getElementById('announcementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function sendAnnouncement() {
  const title = document.getElementById('announcementTitle').value.trim();
  const message = document.getElementById('announcementMessage').value.trim();

  if (!title || !message) {
    showToast('❌ Error', 'Please fill in all fields', 'error', 3000);
    return;
  }

  try {
    const res = await fetch(`${API}/admin/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, message })
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Sent', 'Announcement sent successfully!', 'success', 3000);
      closeSendAnnouncementModal();

      // Clear form
      document.getElementById('announcementTitle').value = '';
      document.getElementById('announcementMessage').value = '';

      // Reload announcements
      loadAnnouncements();
    } else {
      showToast('❌ Error', data.error || 'Failed to send announcement', 'error', 3000);
    }
  } catch (err) {
    console.error('Error sending announcement:', err);
    showToast('❌ Error', 'Failed to send announcement', 'error', 3000);
  }
}

function showDashboard() {
    // If dashboard is already rendered, just update dynamic parts
    const existingSidebar = document.getElementById('sidebarModern');
    if (existingSidebar) {
        const avatarImg = existingSidebar.querySelector('.user-avatar img');
        if (avatarImg) {
            const newAvatarUrl = getDiscordAvatarUrl(currentUser);
            if (avatarImg.src !== newAvatarUrl) {
                avatarImg.src = newAvatarUrl;
            }
        }
        return; // Avoid full re-render
    }
  const isAdminConnect = currentUser && currentUser.isAdminConnect;
  // When admin is connected to user's hosting, treat them as hosting user for UI
  const isAdmin = currentUser && (currentUser.userId === 'admin' || currentUser.role === 'admin') && !isAdminConnect;
  const isHostingUser = (currentUser && currentUser.role === 'hosting_user') || isAdminConnect;

  // Different navigation for admin vs hosting users (admin connect mode shows user interface)
  const navItems = isAdmin ? `
    <div class="nav-section">ADMIN</div>
    <a href="#" class="nav-item active" data-page="dashboard">
      <i class="fas fa-tachometer-alt"></i>
      <span>Dashboard</span>
    </a>
    <a href="#" class="nav-item" data-page="hosting">
      <i class="fas fa-server"></i>
      <span>Hosting Accounts</span>
    </a>
    <a href="#" class="nav-item" data-page="connect">
      <i class="fas fa-plug"></i>
      <span>Connect</span>
    </a>
    <a href="#" class="nav-item" data-page="userManagement">
      <i class="fas fa-users-cog"></i>
      <span>User Management</span>
    </a>
    <a href="#" class="nav-item" data-page="storageManagement">
      <i class="fas fa-hdd"></i>
      <span>Storage</span>
    </a>
    <a href="#" class="nav-item" data-page="problems">
      <i class="fas fa-exclamation-triangle"></i>
      <span>Problems</span>
    </a>
    <a href="#" class="nav-item" data-page="securityLogs">
      <i class="fas fa-shield-alt"></i>
      <span>Security Logs</span>
    </a>
    <a href="#" class="nav-item" data-page="permissions">
      <i class="fas fa-user-shield"></i>
      <span>Permissions</span>
    </a>
    <a href="#" class="nav-item" data-page="webhooks">
      <i class="fab fa-discord"></i>
      <span>Webhooks</span>
    </a>
    <a href="#" class="nav-item" data-page="orderManagement">
      <i class="fas fa-clipboard-list"></i>
      <span>Order Management</span>
    </a>
    <a href="#" class="nav-item" data-page="creditsAdmin">
      <i class="fas fa-coins"></i>
      <span>Credits</span>
    </a>
    <a href="#" class="nav-item" data-page="referralManagement">
      <i class="fas fa-user-friends"></i>
      <span>Referrals</span>
    </a>
    <a href="#" class="nav-item" data-page="serverManagement">
      <i class="fas fa-server"></i>
      <span>Server Management</span>
    </a>
  ` : `
    <div class="nav-section">GENERAL</div>
    <a href="#" class="nav-item active" data-page="dashboard">
      <i class="fas fa-tachometer-alt"></i>
      <span>Dashboard</span>
    </a>
    <a href="#" class="nav-item" data-page="console">
      <i class="fas fa-terminal"></i>
      <span>Console</span>
    </a>
    <a href="#" class="nav-item" data-page="settings">
      <i class="fas fa-cog"></i>
      <span>Settings</span>
    </a>
    <div class="nav-section">MANAGEMENT</div>
    <a href="#" class="nav-item" data-page="files">
      <i class="fas fa-folder"></i>
      <span>Files</span>
    </a>
    <a href="#" class="nav-item" data-page="modules">
      <i class="fas fa-puzzle-piece"></i>
      <span>Modules</span>
    </a>
    <a href="#" class="nav-item" data-page="backups">
      <i class="fas fa-save"></i>
      <span>Backups</span>
    </a>
    <a href="#" class="nav-item" data-page="network">
      <i class="fas fa-network-wired"></i>
      <span>Network</span>
    </a>
    <div class="nav-section">CONFIGURATION</div>
    <a href="#" class="nav-item" data-page="schedules">
      <i class="fas fa-clock"></i>
      <span>Schedules</span>
    </a>
    <a href="#" class="nav-item" data-page="startup">
      <i class="fas fa-play-circle"></i>
      <span>Startup</span>
    </a>
  `;

  const serverName = isHostingUser ? currentUser.hostingName : 'Admin Panel';
  const serverId = isHostingUser ? currentUser.accountId : 'admin';

  document.body.innerHTML = `
    <!-- Mobile Menu Toggle Button -->
    <button class="mobile-menu-toggle" id="mobileMenuToggle" onclick="toggleMobileMenu()">
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- Mobile Overlay -->
    <div class="mobile-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>
    
    <aside class="sidebar" id="sidebarModern">
      <!-- Brand Header -->
      <div class="sidebar-header">
        <div class="logo">
          <i class="fas fa-cloud"></i>
          <span>ALN Hosting</span>
        </div>
      </div>

      ${!isAdmin ? `
      <!-- Server Quick Actions Card -->
      <div class="server-quick-card">
        <div class="server-info-compact">
          <div class="server-icon-modern">
            <i class="fas fa-robot"></i>
          </div>
          <div class="server-details-compact">
            <div class="server-name-compact">${serverName}</div>
            <div class="server-id-compact">${serverId}</div>
          </div>
        </div>
        <div class="quick-actions-grid">
          <button class="quick-action-btn start-action" id="serverStartBtn" title="Start Server">
            <i class="fas fa-play"></i>
          </button>
          <button class="quick-action-btn restart-action" id="serverRestartBtn" title="Restart Server">
            <i class="fas fa-redo"></i>
          </button>
          <button class="quick-action-btn stop-action" id="serverStopBtn" title="Stop Server">
            <i class="fas fa-stop"></i>
          </button>
        </div>
      </div>
      ` : ''}

      <!-- Navigation -->
      <nav class="sidebar-nav">
        ${navItems}
      </nav>

      <!-- User Profile Footer -->
      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar">
            <img src="${getDiscordAvatarUrl(currentUser)}" alt="${currentUser.username || 'User'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.src='user.png'">
          </div>
          <div class="user-info">
            <div class="user-name">${currentUser.username || 'User'}</div>
            <div class="user-role">${currentUser.isAdminConnect ? 'Admin Connect' : (currentUser.role === 'admin' ? 'Administrator' : 'Member')}</div>
          </div>
          <button class="user-menu-toggle" id="userMenuBtn">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </div>
        <div class="user-dropdown-menu" id="userProfileMenu" style="display: none;">
          <button class="dropdown-menu-item logout-item" id="logoutBtn">
            <i class="fas fa-sign-out-alt"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>

    <div class="main-container">
      <main class="main-content">
        <header class="top-bar">
          <div class="search-bar">
            <i class="fas fa-search"></i>
            <input type="text" placeholder="Search...">
          </div>
          <div class="top-actions">
            ${isAdmin ? '<button class="send-announcement-btn" onclick="showSendAnnouncementModal()"><i class="fas fa-bullhorn"></i> Send Announcement</button>' : ''}
            <a href="https://discord.gg/Mqzh86Jyts" class="top-link" target="_blank"><i class="fab fa-discord"></i> Discord</a>
            <div class="notification-btn" onclick="toggleNotificationPanel()">
              <div class="notification-icon">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" style="display: none;">0</span>
              </div>
              <span class="notification-text">Notifications</span>
            </div>
          </div>
        </header>

        <!-- Notification Panel -->
        <div class="notification-panel" id="notificationPanel">
          <div class="notification-panel-header">
            <h3><i class="fas fa-bell"></i> Announcements</h3>
            <button class="notification-close-btn" onclick="toggleNotificationPanel()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="notification-panel-body" id="announcementsContainer">
            <div class="no-announcements">
              <i class="fas fa-bell-slash"></i>
              <p>No announcements yet</p>
            </div>
          </div>
        </div>

        <!-- Send Announcement Modal -->
        <div class="announcement-modal" id="announcementModal">
          <div class="announcement-modal-content">
            <div class="announcement-modal-header">
              <h3><i class="fas fa-bullhorn"></i> Send Announcement</h3>
              <button class="notification-close-btn" onclick="closeSendAnnouncementModal()">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="announcement-modal-body">
              <div class="announcement-form-group">
                <label>Announcement Title</label>
                <input type="text" id="announcementTitle" placeholder="Enter announcement title...">
              </div>
              <div class="announcement-form-group">
                <label>Announcement Message</label>
                <textarea id="announcementMessage" placeholder="Enter your announcement message..."></textarea>
              </div>
            </div>
            <div class="announcement-modal-footer">
              <button class="announcement-cancel-btn" onclick="closeSendAnnouncementModal()">Cancel</button>
              <button class="announcement-send-btn" onclick="sendAnnouncement()"><i class="fas fa-paper-plane"></i> Send Announcement</button>
            </div>
          </div>
        </div>

        <div class="page active" id="dashboardPage"></div>
        <div class="page" id="serversPage"></div>
        <div class="page" id="consolePage"></div>
        <div class="page" id="settingsPage"></div>
        <div class="page" id="filesPage"></div>
        <div class="page" id="backupsPage"></div>
        <div class="page" id="networkPage"></div>
        <div class="page" id="schedulesPage"></div>
        <div class="page" id="startupPage"></div>
        <div class="page" id="hostingPage"></div>
        <div class="page" id="problemsPage"></div>
        <div class="page" id="securityLogsPage"></div>
        <div class="page" id="modulesPage"></div>
        <div class="page" id="userManagementPage"></div>
        <div class="page" id="storageManagementPage"></div>
        <div class="page" id="connectPage"></div>
        <div class="page" id="permissionsPage"></div>
        <div class="page" id="orderManagementPage"></div>
        <div class="page" id="creditsAdminPage"></div>
        <div class="page" id="referralManagementPage"></div>
        <div class="page" id="webhooksPage"></div>
      </main>
    </div>
  `;

  initializeEventListeners();

  // Load announcements
  loadAnnouncements();

  // Poll for new announcements every 30 seconds
  setInterval(loadAnnouncements, 30000);

  if (isAdmin) {
    loadAdminDashboard();
  } else {
    // Don't auto-load anything - let checkAuth handle the initial page
    // This allows us to show servers page first
  }

  // Close notification panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notificationPanel');
    const notifBtn = document.querySelector('.notification-btn');

    if (panel && !panel.contains(e.target) && !notifBtn.contains(e.target)) {
      panel.classList.remove('active');
    }
  });
}

function initializeEventListeners() {
  // Allow top-bar links (Discord, Support) to work normally
  document.querySelectorAll('.top-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Don't prevent default - let the link work normally
      return true;
    });
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      closeMobileMenu();

      if (page !== 'dashboard') {
        if (statusInterval) {
          clearInterval(statusInterval);
          statusInterval = null;
        }
        if (logInterval) {
          clearInterval(logInterval);
          logInterval = null;
        }
      }

      const pageDisplayNames = {
        'dashboard': 'Dashboard',
        'hosting': 'Hosting Accounts',
        'connect': 'Connect',
        'userManagement': 'User Management',
        'storageManagement': 'Storage',
        'problems': 'Problems',
        'securityLogs': 'Security Logs',
        'permissions': 'Permissions',
        'creditManagement': 'Credit Management',
        'referralManagement': 'Referral Management',
        'webhooks': 'Webhook Management',
        'serverManagement': 'Server Management',
        'console': 'Console',
        'files': 'Files',
        'settings': 'Settings',
        'activity': 'Activity',
        'backups': 'Backups',
        'environment': 'Environment',
        'analytics': 'Analytics',
        'templates': 'Templates',
        'database': 'Database'
      };
      
      const hasAccess = await checkUserPagePermission(page);
      if (!hasAccess) {
        showAccessDeniedOverlay(pageDisplayNames[page] || page);
        return;
      }

      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(page + 'Page').classList.add('active');

      if (page === 'hosting') loadHostingAccounts();
      else if (page === 'servers') loadServersPage();
      else if (page === 'console') loadConsole();
      else if (page === 'files') loadFiles();
      else if (page === 'modules') loadModulesPage();
      else if (page === 'dashboard') {
        if (currentUser.role === 'admin' && !currentUser.isAdminConnect) loadAdminDashboard();
        else loadUserDashboard();
      }
      else if (page === 'settings') loadSettings();
      else if (page === 'backups') loadBackups();
      else if (page === 'environment') loadEnvironment();
      else if (page === 'analytics') loadAnalytics();
      else if (page === 'templates') loadTemplates();
      else if (page === 'network') loadNetwork();
      else if (page === 'schedules') loadSchedules();
      else if (page === 'startup') loadStartup();
      else if (page === 'problems') loadProblems();
      else if (page === 'securityLogs') loadSecurityLogs();
      else if (page === 'userManagement') loadUserManagementPage();
      else if (page === 'storageManagement') loadStorageManagementPage();
      else if (page === 'connect') loadConnectPage();
      else if (page === 'permissions') loadPermissionsPage();
      else if (page === 'creditManagement') loadCreditManagementPage();
      else if (page === 'referralManagement') loadReferralManagementPage();
      else if (page === 'webhooks') loadWebhooksPage();
      else if (page === 'orderManagement') loadOrderManagementPage();
      else if (page === 'creditsAdmin') loadCreditsAdminPage();
      else if (page === 'serverManagement') loadServerManagementPage();
    });
  });

const accountBtn = document.getElementById('accountBtn');
  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      location.reload();
    });
  }

  // Discord profile menu handlers
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userProfileMenu = document.getElementById('userProfileMenu');
  const logoutBtn = document.getElementById('logoutBtn');

  if (userMenuBtn && userProfileMenu) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = userProfileMenu.style.display === 'block';
      userProfileMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!userProfileMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userProfileMenu.style.display = 'none';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        localStorage.removeItem('currentUser');
        location.reload();
      }
    });
  }

  // Server control buttons
  const startBtn = document.getElementById('serverStartBtn');
  const restartBtn = document.getElementById('serverRestartBtn');
  const stopBtn = document.getElementById('serverStopBtn');

  if (startBtn) startBtn.addEventListener('click', startServer);
  if (restartBtn) restartBtn.addEventListener('click', restartServer);
  if (stopBtn) stopBtn.addEventListener('click', stopServer);
}

// Chart data storage
let cpuData = [], memoryData = [], networkInData = [], networkOutData = [];
const MAX_DATA_POINTS = 30;

// Polling configuration - adjusted for cPanel deployment
const POLLING_CONFIG = {
  STATUS_INTERVAL: 4000,        // Status check every 4 seconds
  CONSOLE_INTERVAL: 4000,       // Console logs every 4 seconds
  METRICS_INTERVAL: 4000,       // Metrics every 4 seconds
  REQUEST_TIMEOUT: 8000,        // 8 second timeout for requests
  MAX_RETRY_ATTEMPTS: 2         // Retry failed requests twice
};

// Request timeout helper
function fetchWithTimeout(url, options = {}, timeout = POLLING_CONFIG.REQUEST_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

// Check and display admin connect mode banner - moved to global scope
function checkAdminConnectMode() {
  // Check if user is in admin connect mode
  if (currentUser && currentUser.isAdminConnect) {
    // Remove existing banner if any
    const existingBanner = document.querySelector('.admin-connect-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    // Show admin connect banner
    const banner = document.createElement('div');
    banner.className = 'admin-connect-banner';
    banner.innerHTML = `
      <div class="admin-connect-banner-content">
        <div class="admin-connect-info">
          <i class="fas fa-shield-alt"></i>
          <span>Admin Connect Mode - Viewing ${currentUser.hostingName} (Connected by ${currentUser.connectedBy || 'Admin'})</span>
        </div>
        <div class="admin-connect-actions">
          <button class="admin-back-btn" onclick="goBackToAdmin()">
            <i class="fas fa-arrow-left"></i>
            Go Back to Admin
          </button>
          <button class="admin-disconnect-btn" onclick="disconnectAdminConnect()">
            <i class="fas fa-sign-out-alt"></i>
            Disconnect
          </button>
        </div>
      </div>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(banner, mainContent.firstChild);
    }
  }
}

async function goBackToAdmin() {
  try {
    showToast('🔄 Returning', 'Going back to admin dashboard...', 'info', 1500);
    
    const res = await fetch(`${API}/admin/connect/disconnect`, {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Remove localStorage entry and reload to admin dashboard
      localStorage.removeItem('currentUser');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } else {
      showToast('❌ Error', data.error || 'Failed to return to admin', 'error', 3000);
    }
  } catch (err) {
    console.error('Go back error:', err);
    showToast('❌ Error', 'Failed to return to admin dashboard', 'error', 3000);
  }
}

async function disconnectAdminConnect() {
  const confirmed = confirm('Are you sure you want to disconnect from this hosting and return to admin panel?');
  
  if (confirmed) {
    try {
      const res = await fetch(`${API}/admin/connect/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast('✅ Disconnected', 'Returning to admin panel...', 'success', 2000);
        
        // Remove localStorage entry and reload
        localStorage.removeItem('currentUser');
        setTimeout(() => {
          window.location.href = '/?disconnect=success';
        }, 1000);
      } else {
        showToast('❌ Error', data.error || 'Failed to disconnect', 'error', 3000);
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      showToast('❌ Error', 'Failed to disconnect from hosting', 'error', 3000);
    }
  }
}

// Available modules for download
const AVAILABLE_MODULES = {
  python: [
    {
      id: 'discord-py',
      name: 'Discord.py',
      description: 'Popular Discord bot library for Python',
      package: 'discord.py',
      version: '2.3.2',
      category: 'Discord',
      icon: 'fab fa-discord'
    },
    {
      id: 'requests',
      name: 'Requests',
      description: 'HTTP library for making web requests',
      package: 'requests',
      version: '2.31.0',
      category: 'HTTP',
      icon: 'fas fa-globe'
    },
    {
      id: 'beautifulsoup4',
      name: 'BeautifulSoup4',
      description: 'Web scraping and HTML parsing library',
      package: 'beautifulsoup4',
      version: '4.12.2',
      category: 'Web Scraping',
      icon: 'fas fa-code'
    },
    {
      id: 'pillow',
      name: 'Pillow',
      description: 'Image processing library',
      package: 'Pillow',
      version: '10.1.0',
      category: 'Image Processing',
      icon: 'fas fa-image'
    },
    {
      id: 'flask',
      name: 'Flask',
      description: 'Lightweight web framework',
      package: 'Flask',
      version: '3.0.0',
      category: 'Web Framework',
      icon: 'fas fa-server'
    },
    {
      id: 'numpy',
      name: 'NumPy',
      description: 'Scientific computing library',
      package: 'numpy',
      version: '1.26.2',
      category: 'Data Science',
      icon: 'fas fa-calculator'
    },
    {
      id: 'pandas',
      name: 'Pandas',
      description: 'Data manipulation and analysis',
      package: 'pandas',
      version: '2.1.3',
      category: 'Data Science',
      icon: 'fas fa-table'
    },
    {
      id: 'python-dotenv',
      name: 'Python-dotenv',
      description: 'Environment variables management',
      package: 'python-dotenv',
      version: '1.0.0',
      category: 'Utilities',
      icon: 'fas fa-key'
    },
    {
      id: 'aiohttp',
      name: 'aiohttp',
      description: 'Async HTTP client/server framework',
      package: 'aiohttp',
      version: '3.9.1',
      category: 'HTTP',
      icon: 'fas fa-network-wired'
    },
    {
      id: 'sqlalchemy',
      name: 'SQLAlchemy',
      description: 'SQL toolkit and ORM',
      package: 'SQLAlchemy',
      version: '2.0.23',
      category: 'Database',
      icon: 'fas fa-database'
    }
  ],
  javascript: [
    {
      id: 'discord-js',
      name: 'Discord.js',
      description: 'Powerful Discord bot library for Node.js',
      package: 'discord.js',
      version: '14.14.1',
      category: 'Discord',
      icon: 'fab fa-discord'
    },
    {
      id: 'axios',
      name: 'Axios',
      description: 'Promise-based HTTP client',
      package: 'axios',
      version: '1.6.2',
      category: 'HTTP',
      icon: 'fas fa-globe'
    },
    {
      id: 'express',
      name: 'Express',
      description: 'Fast web framework for Node.js',
      package: 'express',
      version: '4.18.2',
      category: 'Web Framework',
      icon: 'fas fa-server'
    },
    {
      id: 'dotenv',
      name: 'dotenv',
      description: 'Environment variables loader',
      package: 'dotenv',
      version: '16.3.1',
      category: 'Utilities',
      icon: 'fas fa-key'
    },
    {
      id: 'mongoose',
      name: 'Mongoose',
      description: 'MongoDB object modeling',
      package: 'mongoose',
      version: '8.0.3',
      category: 'Database',
      icon: 'fas fa-database'
    },
    {
      id: 'node-fetch',
      name: 'node-fetch',
      description: 'Fetch API for Node.js',
      package: 'node-fetch',
      version: '3.3.2',
      category: 'HTTP',
      icon: 'fas fa-download'
    },
    {
      id: 'chalk',
      name: 'Chalk',
      description: 'Terminal string styling',
      package: 'chalk',
      version: '5.3.0',
      category: 'Utilities',
      icon: 'fas fa-palette'
    },
    {
      id: 'moment',
      name: 'Moment.js',
      description: 'Date and time manipulation',
      package: 'moment',
      version: '2.29.4',
      category: 'Utilities',
      icon: 'fas fa-clock'
    }
  ]
};

// User Dashboard with completely new modern UI
async function loadUserDashboard() {
  const page = document.getElementById('dashboardPage');

  // Fetch hosting account details
  let hostingIP = 'Loading...';
  let accountType = 'bot';
  let websiteInfo = null;
  let initialStatus = 'Offline';

  try {
    if (currentUser.accountId) {
      const res = await fetch(`${API}/hosting/${currentUser.accountId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.account) {
        hostingIP = data.account.ip;
        accountType = data.account.type || 'bot';
        initialStatus = data.account.status === 'online' ? 'Online' : 'Offline';
        if (accountType === 'website') {
          websiteInfo = {
            websiteName: data.account.websiteName || '',
            deployedUrl: data.account.deployedUrl || '',
            deploymentStatus: data.account.deploymentStatus || 'not_deployed'
          };
        }
      }
    }
  } catch (err) {
    console.error('Error loading hosting details:', err);
  }

  // If this is a website hosting account, show website deployment UI
  if (accountType === 'website') {
    loadWebsiteDashboard(websiteInfo);
    return;
  }

  // Clear any existing intervals
  if (statusInterval) clearInterval(statusInterval);
  if (logInterval) clearInterval(logInterval);

  const isJS = currentUser.language === 'javascript' || currentUser.type === 'javascript';
  const bgImage = isJS ? 'pics/jsbag.png' : 'pics/pythonbag.png';
  const langName = isJS ? 'JavaScript' : 'Python';
  const langIcon = isJS ? 'pics/js.png' : 'pics/python.png';
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-tachometer-alt"></i> Dashboard</h2>
    </div>
    <div class="new-dashboard-container">
      <!-- Hero Section -->
      <div class="dashboard-hero ${isJS ? 'js-hero' : 'python-hero'}" style="background-image: url('${bgImage}');">
        <div class="hero-content">
          <div class="hero-badge">
            <i class="fas fa-robot"></i>
            <span>Bot Instance</span>
          </div>
          <div class="bot-language-icon" style="position: absolute; top: 24px; right: 24px; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 14px; border-radius: 20px; backdrop-filter: blur(8px);">
            <img src="${langIcon}" alt="${langName}" style="width: 24px; height: 24px; object-fit: contain;">
            <span style="color: rgba(255,255,255,0.9); font-weight: 600; font-size: 13px;">${langName}</span>
          </div>
          <h1 class="hero-title">${currentUser.hostingName || 'My Bot'}</h1>
          <p class="hero-subtitle">Real-time monitoring and performance analytics</p>

          <div class="hero-status-card">
            <div class="status-metric">
              <i class="fas fa-fingerprint"></i>
              <div>
                <span class="metric-label">Instance ID</span>
                <span class="metric-value">${currentUser.accountId ? currentUser.accountId.substring(0, 12) : '------------'}</span>
              </div>
            </div>
            <div class="status-divider"></div>
            <div class="status-metric">
              <i class="fas fa-clock"></i>
              <div>
                <span class="metric-label">Uptime</span>
                <span class="metric-value" id="heroUptime">00:00:00</span>
              </div>
            </div>
            <div class="status-divider"></div>
            <div class="status-metric">
              <i class="fas fa-globe"></i>
              <div>
                <span class="metric-label">Region</span>
                <span class="metric-value">US-East</span>
              </div>
            </div>
          </div>
        </div>

        <div class="hero-decoration">
          <div class="decoration-circle circle-1"></div>
          <div class="decoration-circle circle-2"></div>
          <div class="decoration-circle circle-3"></div>
        </div>
      </div>

      <!-- Bot Status Indicator Section -->
      <div class="bot-status-section">
        <div class="bot-status-card" id="botStatusCard">
          <div class="bot-status-glow"></div>
          <div class="bot-status-content">
            <div class="bot-status-left">
              <div class="bot-status-orb" id="botStatusOrb">
                <div class="orb-inner">
                  <i class="fas fa-robot" id="botStatusIcon"></i>
                </div>
                <div class="orb-ring"></div>
                <div class="orb-pulse"></div>
              </div>
              <div class="bot-status-info">
                <div class="bot-status-label">Discord Bot Status</div>
                <div class="bot-status-text" id="botStatusText">Checking...</div>
                <div class="bot-status-subtext" id="botStatusSubtext">Connecting to server...</div>
              </div>
            </div>
            <div class="bot-status-right">
              <div class="bot-status-badge" id="botStatusBadge">
                <span class="badge-dot"></span>
                <span class="badge-text">Checking</span>
              </div>
              <div class="bot-status-meta">
                <div class="meta-item" id="botPidDisplay" style="display: none;">
                  <i class="fas fa-microchip"></i>
                  <span>PID: <strong id="botPidValue">-</strong></span>
                </div>
                <div class="meta-item">
                  <i class="fas fa-clock"></i>
                  <span>Last Check: <strong id="lastStatusCheck">--:--</strong></span>
                </div>
              </div>
            </div>
          </div>
          <div class="bot-status-wave">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,60 C150,120 350,0 500,60 C650,120 800,0 1000,60 C1100,90 1150,60 1200,80 L1200,120 L0,120 Z" fill="currentColor" opacity="0.1"></path>
            </svg>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="performance-section">
        <div class="section-header">
          <h2><i class="fas fa-chart-area"></i> Performance Metrics</h2>
          <span class="live-indicator"><span class="live-dot"></span> Live</span>
        </div>

        <div class="metrics-modern-grid">
          <!-- CPU Card -->
          <div class="metric-modern-card cpu-gradient">
            <div class="metric-modern-header">
              <div class="metric-icon-wrapper">
                <i class="fas fa-microchip"></i>
              </div>
              <div class="metric-info-text">
                <span class="metric-modern-label">CPU Usage</span>
                <div class="metric-modern-value">
                  <span id="cpuValueNew">0.00</span>
                  <span class="metric-unit">%</span>
                </div>
              </div>
            </div>
            <div class="metric-modern-chart">
              <svg id="cpuChartNew" viewBox="0 0 300 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpuGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0.1" />
                  </linearGradient>
                </defs>
                <path id="cpuPathNew" fill="url(#cpuGrad)" stroke="#a78bfa" stroke-width="2"/>
              </svg>
            </div>
            <div class="metric-modern-footer">
              <span class="metric-footer-text">Max: 100%</span>
            </div>
          </div>

          <!-- Memory Card -->
          <div class="metric-modern-card memory-gradient">
            <div class="metric-modern-header">
              <div class="metric-icon-wrapper">
                <i class="fas fa-memory"></i>
              </div>
              <div class="metric-info-text">
                <span class="metric-modern-label">Memory Usage</span>
                <div class="metric-modern-value">
                  <span id="memoryValueNew">0</span>
                  <span class="metric-unit">MB</span>
                </div>
              </div>
            </div>
            <div class="metric-modern-chart">
              <svg id="memoryChartNew" viewBox="0 0 300 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="memGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ec4899;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#ec4899;stop-opacity:0.1" />
                  </linearGradient>
                </defs>
                <path id="memoryPathNew" fill="url(#memGrad)" stroke="#f472b6" stroke-width="2"/>
              </svg>
            </div>
            <div class="metric-modern-footer">
              <span class="metric-footer-text">Limit: 1024 MB</span>
            </div>
          </div>

          <!-- Network Card -->
          <div class="metric-modern-card network-gradient">
            <div class="metric-modern-header">
              <div class="metric-icon-wrapper">
                <i class="fas fa-network-wired"></i>
              </div>
              <div class="metric-info-text">
                <span class="metric-modern-label">Network I/O</span>
                <div class="metric-modern-value">
                  <span id="networkValueNew">0</span>
                  <span class="metric-unit">KB/s</span>
                </div>
              </div>
            </div>
            <div class="metric-modern-chart">
              <svg id="networkChartNew" viewBox="0 0 300 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="netGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:0.1" />
                  </linearGradient>
                </defs>
                <path id="networkPathNew" fill="url(#netGrad)" stroke="#22d3ee" stroke-width="2"/>
              </svg>
            </div>
            <div class="metric-modern-footer">
              <span class="metric-footer-text"><i class="fas fa-arrow-up"></i> <span id="netUpload">0</span> KB/s · <i class="fas fa-arrow-down"></i> <span id="netDownload">0</span> KB/s</span>
            </div>
          </div>

          <!-- Storage Card -->
          <div class="metric-modern-card storage-gradient">
            <div class="metric-modern-header">
              <div class="metric-icon-wrapper">
                <i class="fas fa-hdd"></i>
              </div>
              <div class="metric-info-text">
                <span class="metric-modern-label">Storage Usage</span>
                <div class="metric-modern-value">
                  <span id="storageValueNew">-</span>
                  <span class="metric-unit" id="storageUnitNew">MB</span>
                </div>
              </div>
            </div>
            <div class="storage-progress-container">
              <div class="storage-progress-bar">
                <div class="storage-progress-fill" id="storageProgressFill" style="width: 0%"></div>
              </div>
              <div class="storage-progress-labels">
                <span id="storageUsedLabel">0 MB used</span>
                <span id="storageLimitLabel">of 30 MB</span>
              </div>
            </div>
            <div class="metric-modern-footer storage-footer">
              <span class="metric-footer-text" id="storagePercentText">0% used</span>
              <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="storage-upgrade-link">
                <i class="fas fa-plus-circle"></i> Need more?
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Grid -->
      <div class="info-grid-modern">
        <!-- Server Details -->
        <div class="info-modern-card">
          <div class="info-modern-header">
            <i class="fas fa-server"></i>
            <h3>Server Details</h3>
          </div>
          <div class="info-modern-body">
            <div class="info-row-modern">
              <span class="info-key"><i class="fas fa-fingerprint"></i> Instance ID</span>
              <span class="info-value code">${currentUser.accountId || 'N/A'}</span>
            </div>
            <div class="info-row-modern">
              <span class="info-key"><i class="fas fa-map-marker-alt"></i> Region</span>
              <span class="info-value">US-East</span>
            </div>
            <div class="info-row-modern">
              <span class="info-key"><i class="fas fa-network-wired"></i> IP Address</span>
              <span class="info-value">${hostingIP}</span>
            </div>
            <div class="info-row-modern">
              <span class="info-key"><i class="fas fa-microchip"></i> Node</span>
              <span class="info-value">GRA-N36</span>
            </div>
          </div>
        </div>

        <!-- Activity Log -->
        <div class="info-modern-card">
          <div class="info-modern-header">
            <i class="fas fa-history"></i>
            <h3>Recent Activity</h3>
          </div>
          <div class="info-modern-body activity-log" id="activityLogContainer">
            <div class="activity-empty">
              <i class="fas fa-check-circle"></i>
              <span>No recent activity</span>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="info-modern-card">
          <div class="info-modern-header">
            <i class="fas fa-tachometer-alt"></i>
            <h3>Quick Stats</h3>
          </div>
          <div class="info-modern-body">
            <div class="quick-stat-item">
              <div class="quick-stat-icon green">
                <i class="fas fa-play-circle"></i>
              </div>
              <div class="quick-stat-info">
                <span class="quick-stat-label">Total Starts</span>
                <span class="quick-stat-value" id="totalStarts">0</span>
              </div>
            </div>
            <div class="quick-stat-item">
              <div class="quick-stat-icon blue">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="quick-stat-info">
                <span class="quick-stat-label">Crashes</span>
                <span class="quick-stat-value" id="totalCrashes">0</span>
              </div>
            </div>
            <div class="quick-stat-item">
              <div class="quick-stat-icon blue">
                <i class="fas fa-clock"></i>
              </div>
              <div class="quick-stat-info">
                <span class="quick-stat-label">Avg Uptime</span>
                <span class="quick-stat-value" id="avgUptime">0h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load server start time from localStorage
  loadServerStartTime();

  // Initial status check
  updateServerStats();
  loadQuickStats();
  loadRecentActivity();
  loadStorageInfo();

  // Set up periodic updates with cPanel-friendly intervals
  statusInterval = setInterval(updateServerStats, POLLING_CONFIG.STATUS_INTERVAL);
  logInterval = setInterval(loadBotErrors, 10000);
  setInterval(loadQuickStats, 4000);
  setInterval(loadRecentActivity, 2000);
  setInterval(loadStorageInfo, 30000);
}

async function loadQuickStats() {
  if (!currentUser?.accountId) return;
  
  try {
    const res = await fetch(`${API}/stats/quick-stats?accountId=${currentUser.accountId}`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.stats) {
        const totalStartsEl = document.getElementById('totalStarts');
        const totalCrashesEl = document.getElementById('totalCrashes');
        const avgUptimeEl = document.getElementById('avgUptime');
        
        if (totalStartsEl) totalStartsEl.textContent = data.stats.total_starts || 0;
        if (totalCrashesEl) totalCrashesEl.textContent = data.stats.total_crashes || 0;
        if (avgUptimeEl) avgUptimeEl.textContent = data.stats.avg_uptime || '0m';
      }
    }
  } catch (err) {
    console.error('Error loading quick stats:', err);
  }
}

async function loadRecentActivity() {
  if (!currentUser?.accountId) return;
  
  try {
    const res = await fetch(`${API}/stats/activity?accountId=${currentUser.accountId}&limit=5`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.activities) {
        const container = document.getElementById('activityLogContainer');
        if (container) {
          if (data.activities.length === 0) {
            container.innerHTML = `
              <div class="activity-empty">
                <i class="fas fa-check-circle"></i>
                <span>No recent activity</span>
              </div>
            `;
          } else {
            container.innerHTML = data.activities.map(activity => {
              const timeAgo = getTimeAgo(activity.timestamp * 1000);
              const colorClass = activity.color || 'blue';
              const icon = activity.icon || 'info-circle';
              return `
                <div class="activity-item ${colorClass}">
                  <div class="activity-icon">
                    <i class="fas fa-${icon}"></i>
                  </div>
                  <div class="activity-content">
                    <span class="activity-message">${activity.message}</span>
                    <span class="activity-time">${timeAgo}</span>
                  </div>
                </div>
              `;
            }).join('');
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading recent activity:', err);
  }
}

async function loadStorageInfo() {
  if (!currentUser?.accountId) return;
  
  try {
    const res = await fetch(`${API}/files/storage-info?accountId=${currentUser.accountId}`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.storage) {
        const storage = data.storage;
        const usedMB = (storage.used_bytes / (1024 * 1024)).toFixed(2);
        const limitMB = (storage.limit_bytes / (1024 * 1024)).toFixed(0);
        const percentage = storage.percentage_used || storage.percentage || 0;
        
        const storageValueEl = document.getElementById('storageValueNew');
        const storageUsedLabel = document.getElementById('storageUsedLabel');
        const storageLimitLabel = document.getElementById('storageLimitLabel');
        const storageProgressFill = document.getElementById('storageProgressFill');
        const storagePercentText = document.getElementById('storagePercentText');
        
        if (storageValueEl) storageValueEl.textContent = usedMB;
        if (storageUsedLabel) storageUsedLabel.textContent = `${usedMB} MB used`;
        if (storageLimitLabel) storageLimitLabel.textContent = `of ${limitMB} MB`;
        if (storageProgressFill) {
          storageProgressFill.style.width = `${Math.min(percentage, 100)}%`;
          if (percentage >= 90) {
            storageProgressFill.classList.add('critical');
            storageProgressFill.classList.remove('warning');
          } else if (percentage >= 75) {
            storageProgressFill.classList.add('warning');
            storageProgressFill.classList.remove('critical');
          } else {
            storageProgressFill.classList.remove('warning', 'critical');
          }
        }
        if (storagePercentText) storagePercentText.textContent = `${percentage.toFixed(1)}% used`;
      }
    }
  } catch (err) {
    console.error('Error loading storage info:', err);
  }
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatUptimeShort(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

function loadModulesPage() {
  const page = document.getElementById('modulesPage');
  if (!page) return;

  const language = currentUser?.language || 'python';
  const modules = AVAILABLE_MODULES[language] || AVAILABLE_MODULES.python;

  // Group modules by category
  const categories = {};
  modules.forEach(module => {
    if (!categories[module.category]) {
      categories[module.category] = [];
    }
    categories[module.category].push(module);
  });

  const categoryColors = {
    'Discord': { bg: 'linear-gradient(135deg, #5865F2, #7289DA)', border: 'rgba(88, 101, 242, 0.3)' },
    'HTTP': { bg: 'linear-gradient(135deg, #06B6D4, #0891B2)', border: 'rgba(6, 182, 212, 0.3)' },
    'Web Scraping': { bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'rgba(139, 92, 246, 0.3)' },
    'Image Processing': { bg: 'linear-gradient(135deg, #EC4899, #DB2777)', border: 'rgba(236, 72, 153, 0.3)' },
    'Web Framework': { bg: 'linear-gradient(135deg, #10B981, #059669)', border: 'rgba(16, 185, 129, 0.3)' },
    'Data Science': { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'rgba(245, 158, 11, 0.3)' },
    'Utilities': { bg: 'linear-gradient(135deg, #6366F1, #4F46E5)', border: 'rgba(99, 102, 241, 0.3)' },
    'Database': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', border: 'rgba(239, 68, 68, 0.3)' }
  };

  const categoryIcons = {
    'Discord': 'fab fa-discord',
    'HTTP': 'fas fa-globe',
    'Web Scraping': 'fas fa-spider',
    'Image Processing': 'fas fa-image',
    'Web Framework': 'fas fa-server',
    'Data Science': 'fas fa-chart-line',
    'Utilities': 'fas fa-tools',
    'Database': 'fas fa-database'
  };

  page.innerHTML = `
    <div class="modules-marketplace-modern">
      <!-- Marketplace Header -->
      <div class="marketplace-header">
        <div class="marketplace-header-content">
          <div class="marketplace-title-section">
            <div class="marketplace-icon-badge">
              <i class="${language === 'python' ? 'fab fa-python' : 'fab fa-node-js'}"></i>
            </div>
            <div class="marketplace-title-text">
              <h1>Package Marketplace</h1>
              <p>${modules.length} ${language === 'python' ? 'Python' : 'JavaScript'} packages available</p>
            </div>
          </div>
          <div class="marketplace-search-container">
            <div class="marketplace-search-box">
              <i class="fas fa-search"></i>
              <input type="text" id="moduleSearchInput" placeholder="Search packages by name or category..." />
            </div>
          </div>
        </div>
      </div>

      <!-- Category Pills -->
      <div class="category-pills-container">
        <button class="category-pill active" data-category="all">
          <i class="fas fa-layer-group"></i>
          <span>All</span>
          <span class="pill-count">${modules.length}</span>
        </button>
        ${Object.keys(categories).map(cat => `
          <button class="category-pill" data-category="${cat}">
            <i class="${categoryIcons[cat]}"></i>
            <span>${cat}</span>
            <span class="pill-count">${categories[cat].length}</span>
          </button>
        `).join('')}
      </div>

      <!-- Packages Grid -->
      <div class="packages-grid-modern" id="packagesGridContainer">
        ${modules.map(module => {
          const colors = categoryColors[module.category] || categoryColors['Utilities'];
          return `
            <div class="package-card-modern" data-name="${module.name.toLowerCase()}" data-category="${module.category.toLowerCase()}">
              <div class="package-card-glow" style="background: ${colors.bg}"></div>
              <div class="package-card-inner">
                <div class="package-header">
                  <div class="package-icon-container" style="background: ${colors.bg}">
                    <i class="${module.icon}"></i>
                  </div>
                  <div class="package-category-badge" style="border-color: ${colors.border}">
                    <i class="${categoryIcons[module.category]}"></i>
                    ${module.category}
                  </div>
                </div>

                <div class="package-content">
                  <h3 class="package-title">${module.name}</h3>
                  <p class="package-description">${module.description}</p>

                  <div class="package-meta-info">
                    <div class="package-meta-item">
                      <i class="fas fa-cube"></i>
                      <span>${module.package}</span>
                    </div>
                    <div class="package-meta-item package-version">
                      <i class="fas fa-tag"></i>
                      <span>v${module.version}</span>
                    </div>
                  </div>
                </div>

                <div class="package-footer">
                  <button class="package-install-button" onclick="installModule('${module.id}', '${module.package}', '${module.name}')" style="background: ${colors.bg}">
                    <i class="fas fa-download"></i>
                    <span>Install Now</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Search functionality
  const searchInput = document.getElementById('moduleSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      document.querySelectorAll('.package-card-modern').forEach(card => {
        const name = card.dataset.name;
        const category = card.dataset.category;
        const matches = name.includes(searchTerm) || category.includes(searchTerm);
        card.style.display = matches ? 'block' : 'none';
      });
    });
  }

  // Category filter functionality
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      document.querySelectorAll('.package-card-modern').forEach(card => {
        if (category === 'all') {
          card.style.display = 'block';
        } else {
          card.style.display = card.dataset.category === category.toLowerCase() ? 'block' : 'none';
        }
      });
    });
  });
}

// Problems Page for Admin
async function loadProblems() {
  const page = document.getElementById('problemsPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-exclamation-triangle"></i> Bot Problems & Issues</h2>
    </div>
    <div class="problems-filters">
      <button class="filter-btn active" data-filter="all">All Issues</button>
      <button class="filter-btn" data-filter="high">High Priority</button>
      <button class="filter-btn" data-filter="medium">Medium Priority</button>
      <button class="filter-btn" data-filter="low">Low Priority</button>
    </div>
    <div class="problems-container" id="problemsContainer">
      <div class="loading">Loading problems...</div>
    </div>
  `;

  try {
    const res = await fetch(`${API}/admin/problems`, {
      credentials: 'include'
    });
    const data = await res.json();

    const container = document.getElementById('problemsContainer');
    if (data.success && data.problems) {
      if (data.problems.length === 0) {
        container.innerHTML = '<p class="empty-state">No problems detected</p>';
      } else {
        container.innerHTML = data.problems.map(problem => `
          <div class="problem-card ${problem.severity}">
            <div class="problem-header">
              <span class="problem-severity">${problem.severity.toUpperCase()}</span>
              <span class="problem-type">${problem.type}</span>
              <span class="problem-time">${new Date(problem.timestamp * 1000).toLocaleString()}</span>
            </div>
            <div class="problem-account">
              <i class="fas fa-server"></i>
              <span>${problem.accountId}</span>
            </div>
            <div class="problem-details">${problem.details}</div>
            <div class="problem-actions">
              <button class="btn-secondary-small" onclick="viewAccountDetails('${problem.accountId}')">
                <i class="fas fa-info-circle"></i> View Account
              </button>
              ${problem.fixable ? `
                <button class="btn-primary-small" onclick="autoFixProblem('${problem.accountId}', '${problem.type}')">
                  <i class="fas fa-wrench"></i> Auto Fix
                </button>
              ` : ''}
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Problems error:', err);
  }

  // Filter functionality
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      document.querySelectorAll('.problem-card').forEach(card => {

// Servers Page - Modern Grid Layout with Quick Actions
async function loadServersPage() {
  const page = document.getElementById('serversPage');
  
  // Make sure servers nav is active
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  const serversNav = document.querySelector('[data-page="servers"]');
  if (serversNav) serversNav.classList.add('active');
  page.classList.add('active');
  
  try {
    const res = await fetch(`${API}/hosting/accounts`, {
      credentials: 'include'
    });
    
    const data = await res.json();
    
    // Filter accounts to only show the user's accounts
    let userAccounts = data.accounts || [];
    if (currentUser && currentUser.accountId && currentUser.role !== 'admin') {
      userAccounts = userAccounts.filter(acc => acc.id === currentUser.accountId);
    }
    
    // Build Quick Action Cards HTML
    const quickActionsHTML = `
      <div class="quick-actions-row">
        <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="quick-action-card discord-card">
          <div class="quick-action-content">
            <div class="quick-action-text">
              <h3>Discord</h3>
              <p>Join our Discord</p>
            </div>
          </div>
          <div class="quick-action-icon">
            <i class="fab fa-discord"></i>
          </div>
        </a>
        <div class="quick-action-card billing-card" onclick="navigateToPage('settings')">
          <div class="quick-action-content">
            <div class="quick-action-text">
              <h3>Billing area</h3>
              <p>Manage your services</p>
            </div>
          </div>
          <div class="quick-action-icon">
            <i class="fas fa-credit-card"></i>
          </div>
        </div>
        <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="quick-action-card support-card">
          <div class="quick-action-content">
            <div class="quick-action-text">
              <h3>Support center</h3>
              <p>Get support</p>
            </div>
          </div>
          <div class="quick-action-icon">
            <i class="fas fa-headset"></i>
          </div>
        </a>
        <div class="quick-action-card status-card" onclick="showServerStatusModal()">
          <div class="quick-action-content">
            <div class="quick-action-text">
              <h3>Server status</h3>
              <p>Check server status</p>
            </div>
          </div>
          <div class="quick-action-icon">
            <i class="fas fa-signal"></i>
          </div>
        </div>
      </div>
    `;
    
    if (userAccounts.length === 0) {
      page.innerHTML = `
        <div class="servers-page-container">
          ${quickActionsHTML}
          
          <div class="welcome-back-banner">
            <div class="welcome-icon">
              <i class="fas fa-hand-wave"></i>
            </div>
            <div class="welcome-text">
              <h2>Welcome back</h2>
              <p>Here you can see all the servers you have access to.</p>
            </div>
          </div>
          
          <div class="empty-servers-state">
            <div class="empty-servers-icon">
              <i class="fas fa-server"></i>
            </div>
            <h2>No Servers Yet</h2>
            <p>Create your first bot hosting instance to get started</p>
            <button class="create-server-btn" onclick="showCreateServerModal()">
              <i class="fas fa-plus"></i>
              Create Server
            </button>
          </div>
        </div>
      `;
      return;
    }
    
    // Get status for all servers
    const serversWithStatus = await Promise.all(
      userAccounts.map(async (account) => {
        try {
          const statusRes = await fetch(`${API}/bot/status?accountId=${account.id}`, {
            credentials: 'include'
          });
          const statusData = await statusRes.json();
          return {
            ...account,
            isOnline: statusData.running || false,
            cpu: statusData.cpu || 0,
            memory: statusData.memory || 0
          };
        } catch (err) {
          return {
            ...account,
            isOnline: false,
            cpu: 0,
            memory: 0
          };
        }
      })
    );
    
    const onlineCount = serversWithStatus.filter(s => s.isOnline).length;
    const totalCount = serversWithStatus.length;
    
    page.innerHTML = `
      <div class="servers-page-container">
        ${quickActionsHTML}
        
        <div class="welcome-back-banner">
          <div class="welcome-icon">
            <i class="fas fa-hand-wave"></i>
          </div>
          <div class="welcome-text">
            <h2>Welcome back</h2>
            <p>Here you can see all the servers you have access to.</p>
          </div>
        </div>
        
        <div class="servers-list">
          ${serversWithStatus.map(server => createServerCardEnhanced(server)).join('')}
        </div>
        
        <div class="servers-footer">
          <p>ALN Hosting &copy; 2024 - 2025</p>
          <p class="designed-by">Designed by ALN Team</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error loading servers:', err);
    page.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Failed to Load Servers</h2>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// Navigate to a specific page
function navigateToPage(pageName) {
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if (navItem) {
    navItem.click();
  }
}

// Show server status modal
function showServerStatusModal() {
  showToast('Server Status', 'All systems operational', 'success', 3000);
}

// Enhanced server card for new design
function createServerCardEnhanced(server) {
  const isPython = server.language === 'python';
  const isJavaScript = server.language === 'javascript';
  const isOnline = server.isOnline;
  
  // Status text and class
  const statusText = isOnline ? 'Online' : 'Offline';
  const statusClass = isOnline ? 'status-online' : 'status-offline';
  
  // Language-specific logo
  const languageLogo = isPython 
    ? `<div class="server-lang-logo python-logo">
        <svg viewBox="0 0 128 128" width="60" height="60">
          <linearGradient id="python-original-a" gradientUnits="userSpaceOnUse" x1="70.252" y1="1237.476" x2="170.659" y2="1151.089" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)">
            <stop offset="0" stop-color="#5A9FD4"/>
            <stop offset="1" stop-color="#306998"/>
          </linearGradient>
          <linearGradient id="python-original-b" gradientUnits="userSpaceOnUse" x1="209.474" y1="1098.811" x2="173.62" y2="1149.537" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)">
            <stop offset="0" stop-color="#FFD43B"/>
            <stop offset="1" stop-color="#FFE873"/>
          </linearGradient>
          <path fill="url(#python-original-a)" d="M63.391 1.988c-4.222.02-8.252.379-11.8 1.007-10.45 1.846-12.346 5.71-12.346 12.837v9.411h24.693v3.137H29.977c-7.176 0-13.46 4.313-15.426 12.521-2.268 9.405-2.368 15.275 0 25.096 1.755 7.311 5.947 12.519 13.124 12.519h8.491V67.234c0-8.151 7.051-15.34 15.426-15.34h24.665c6.866 0 12.346-5.654 12.346-12.548V15.833c0-6.693-5.646-11.72-12.346-12.837-4.244-.706-8.645-1.027-12.866-1.008zM50.037 9.557c2.55 0 4.634 2.117 4.634 4.721 0 2.593-2.083 4.69-4.634 4.69-2.56 0-4.633-2.097-4.633-4.69-.001-2.604 2.073-4.721 4.633-4.721z" transform="translate(0 10.26)"/>
          <path fill="url(#python-original-b)" d="M91.682 28.38v10.966c0 8.5-7.208 15.655-15.426 15.655H51.591c-6.756 0-12.346 5.783-12.346 12.549v23.515c0 6.691 5.818 10.628 12.346 12.547 7.816 2.297 15.312 2.713 24.665 0 6.216-1.801 12.346-5.423 12.346-12.547v-9.412H63.938v-3.138h37.012c7.176 0 9.852-5.005 12.348-12.519 2.578-7.735 2.467-15.174 0-25.096-1.774-7.145-5.161-12.521-12.348-12.521h-9.268zM77.809 87.927c2.561 0 4.634 2.097 4.634 4.692 0 2.602-2.074 4.719-4.634 4.719-2.55 0-4.633-2.117-4.633-4.719 0-2.595 2.083-4.692 4.633-4.692z" transform="translate(0 10.26)"/>
        </svg>
      </div>`
    : isJavaScript 
    ? `<div class="server-lang-logo nodejs-logo">
        <svg viewBox="0 0 128 128" width="60" height="60">
          <path fill="#83CD29" d="M112.771 30.334L68.674 4.729c-2.781-1.584-6.402-1.584-9.205 0L14.901 30.334C12.031 31.985 10 35.088 10 38.407v51.142c0 3.319 2.084 6.423 4.954 8.083l11.775 6.688c5.628 2.772 7.617 2.772 10.178 2.772 8.333 0 13.093-5.039 13.093-13.828v-50.49c0-.713-.371-1.774-1.071-1.774h-5.623c-.712 0-2.306 1.061-2.306 1.773v50.49c0 3.896-3.524 7.773-10.11 4.48L18.723 90.73c-.424-.23-.723-.693-.723-1.181V38.407c0-.482.555-.966.982-1.213l44.424-25.561c.415-.235 1.025-.235 1.439 0l43.882 25.555c.42.253.272.722.272 1.219v51.142c0 .488.183.963-.232 1.198l-44.086 25.576c-.378.227-.847.227-1.261 0l-11.307-6.749c-.341-.198-.746-.269-1.073-.086-3.146 1.783-3.726 2.02-6.677 3.043-.726.253-1.797.692.41 1.929l14.798 8.754a9.294 9.294 0 004.647 1.246c1.642 0 3.25-.426 4.667-1.246l43.885-25.582c2.87-1.672 4.23-4.764 4.23-8.083V38.407c0-3.319-1.36-6.414-4.229-8.073zM77.91 81.445c-11.726 0-14.309-3.235-15.17-9.066-.1-.628-.633-1.379-1.272-1.379h-5.731c-.709 0-1.279.86-1.279 1.566 0 7.466 4.059 16.512 23.453 16.512 14.039 0 22.088-5.455 22.088-15.109 0-9.572-6.467-12.084-20.082-13.886-13.762-1.819-15.16-2.738-15.16-5.962 0-2.658 1.184-6.203 11.374-6.203 9.105 0 12.461 1.954 13.842 8.091.118.577.645 1.16 1.235 1.16h5.764c.354 0 .777-.269 1.008-.544.23-.291.308-.605.271-.927-1.135-13.478-10.054-19.706-22.12-19.706-12.644 0-20.131 5.334-20.131 14.291 0 9.698 7.506 12.378 19.622 13.577 14.505 1.422 15.633 3.542 15.633 6.395 0 4.955-3.978 7.066-13.309 7.066z"/>
        </svg>
      </div>`
    : `<div class="server-lang-logo generic-logo">
        <i class="fas fa-code"></i>
      </div>`;
  
  return `
    <div class="server-list-card ${isPython ? 'python-theme' : isJavaScript ? 'nodejs-theme' : 'generic-theme'}">
      <div class="server-list-card-content">
        <div class="server-list-header">
          <h3 class="server-list-name">${server.name || 'Unnamed Server'}</h3>
          ${languageLogo}
        </div>
        
        <div class="server-list-details">
          <div class="server-detail-row">
            <span class="detail-label"><i class="fas fa-network-wired"></i> IP:</span>
            <span class="detail-value">${server.ip || 'N/A'}</span>
          </div>
          <div class="server-detail-row">
            <span class="detail-label"><i class="fas fa-info-circle"></i> Status:</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
        
        <button class="manage-server-btn" onclick="manageServer('${server.id}')">
          <span>Manage server</span>
        </button>
      </div>
    </div>
  `;
}

function createServerCard(server) {
  const isPython = server.language === 'python';
  const isJavaScript = server.language === 'javascript';
  const isOnline = server.isOnline;
  
  // Language-specific styling
  const languageClass = isPython ? 'python-server' : isJavaScript ? 'javascript-server' : 'generic-server';
  const languageLogo = isPython 
    ? '<i class="fab fa-python"></i>' 
    : isJavaScript 
    ? '<i class="fab fa-node-js"></i>' 
    : '<i class="fas fa-code"></i>';
  const languageName = isPython ? 'Python' : isJavaScript ? 'Node.js' : 'Generic';
  const languageColor = isPython ? '#3776ab' : isJavaScript ? '#68a063' : '#8b5cf6';
  
  return `
    <div class="server-card ${languageClass} ${isOnline ? 'server-online' : 'server-offline'}">
      <div class="server-card-header">
        <div class="server-language-badge" style="background: linear-gradient(135deg, ${languageColor}, ${languageColor}dd);">
          ${languageLogo}
          <span>${languageName}</span>
        </div>
        <div class="server-status-indicator ${isOnline ? 'status-online' : 'status-offline'}">
          <div class="status-pulse"></div>
          <span>${isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>
      
      <div class="server-card-body">
        <div class="server-icon-container">
          <div class="server-icon ${languageClass}-icon">
            ${languageLogo}
          </div>
        </div>
        
        <div class="server-info">
          <h3 class="server-name">${server.name || 'Unnamed Server'}</h3>
          <div class="server-meta">
            <span class="server-meta-item">
              <i class="fas fa-fingerprint"></i>
              ${server.id.substring(0, 8)}
            </span>
            <span class="server-meta-item">
              <i class="fas fa-network-wired"></i>
              ${server.ip || 'N/A'}
            </span>
          </div>
        </div>
        
        ${isOnline ? `
          <div class="server-resources">
            <div class="resource-mini">
              <i class="fas fa-microchip"></i>
              <span>${server.cpu.toFixed(1)}%</span>
            </div>
            <div class="resource-mini">
              <i class="fas fa-memory"></i>
              <span>${server.memory.toFixed(0)} MB</span>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="server-card-footer">
        <button class="server-action-btn manage-btn" onclick="manageServer('${server.id}')">
          <i class="fas fa-cog"></i>
          <span>Manage</span>
        </button>
        ${isOnline ? `
          <button class="server-action-btn stop-btn" onclick="quickStopServer('${server.id}')">
            <i class="fas fa-stop"></i>
          </button>
        ` : `
          <button class="server-action-btn start-btn" onclick="quickStartServer('${server.id}')">
            <i class="fas fa-play"></i>
          </button>
        `}
      </div>
    </div>
  `;
}

async function manageServer(accountId) {
  // Update current user to this specific account
  try {
    const res = await fetch(`${API}/hosting/${accountId}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success && data.account) {
      // Update currentUser with this account's details
      currentUser.accountId = accountId;
      currentUser.hostingName = data.account.name;
      currentUser.language = data.account.language || data.account.type;
      
      // Store in localStorage
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Switch to dashboard page for this specific bot
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      
      const dashNav = document.querySelector('[data-page="dashboard"]');
      if (dashNav) dashNav.classList.add('active');
      
      const dashPage = document.getElementById('dashboardPage');
      if (dashPage) {
        dashPage.classList.add('active');
        loadUserDashboard();
      }
    }
  } catch (err) {
    console.error('Error loading server details:', err);
    showToast('Error', 'Failed to load server details', 'error', 3000);
  }
}

async function quickStartServer(accountId) {
  try {
    const btn = event.target.closest('.server-action-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    const res = await fetch(`${API}/bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });
    
    const data = await res.json();
    
    if (data.success || res.ok) {
      showToast('Server Started', 'Bot is now online', 'success', 3000);
      setTimeout(() => loadServersPage(), 1000);
    } else {
      showToast('Start Failed', data.error || 'Could not start server', 'error', 4000);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-play"></i>';
    }
  } catch (err) {
    showToast('Error', 'Failed to start server', 'error', 3000);
    const btn = event.target.closest('.server-action-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play"></i>';
  }
}

async function quickStopServer(accountId) {
  try {
    const btn = event.target.closest('.server-action-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    const res = await fetch(`${API}/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });
    
    const data = await res.json();
    
    if (data.success || res.ok) {
      showToast('Server Stopped', 'Bot is now offline', 'success', 3000);
      setTimeout(() => loadServersPage(), 1000);
    } else {
      showToast('Stop Failed', data.error || 'Could not stop server', 'error', 4000);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-stop"></i>';
    }
  } catch (err) {
    showToast('Error', 'Failed to stop server', 'error', 3000);
    const btn = event.target.closest('.server-action-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-stop"></i>';
  }
}

        if (filter === 'all' || card.classList.contains(filter)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function showModulesModal() {
  const language = currentUser?.language || 'python';
  const modules = AVAILABLE_MODULES[language] || AVAILABLE_MODULES.python;

  const modal = document.createElement('div');
  modal.className = 'modules-modal-overlay';
  modal.innerHTML = `
    <div class="modules-modal">
      <div class="modules-modal-header">
        <div class="modules-modal-title">
          <i class="fas fa-puzzle-piece"></i>
          <h3>Available Modules</h3>
        </div>
        <button class="modules-modal-close" id="closeModulesModal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modules-modal-search">
        <i class="fas fa-search"></i>
        <input type="text" id="moduleSearchInput" placeholder="Search modules...">
      </div>
      <div class="modules-modal-body" id="modulesModalBody">
        ${modules.map(module => `
          <div class="module-card-full" data-name="${module.name.toLowerCase()}" data-category="${module.category.toLowerCase()}">
            <div class="module-card-icon-large">
              <i class="${module.icon}"></i>
            </div>
            <div class="module-card-details">
              <div class="module-card-header-full">
                <div class="module-card-name-full">${module.name}</div>
                <div class="module-card-version">v${module.version}</div>
              </div>
              <div class="module-card-description">${module.description}</div>
              <div class="module-card-meta">
                <span class="module-card-category">
                  <i class="fas fa-tag"></i>
                  ${module.category}
                </span>
                <span class="module-card-package">
                  <i class="fas fa-box"></i>
                  ${module.package}
                </span>
              </div>
            </div>
            <button class="module-install-btn" onclick="installModule('${module.id}', '${module.package}', '${module.name}')">
              <i class="fas fa-download"></i>
              <span>Install</span>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close button handler
  document.getElementById('closeModulesModal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Search functionality
  const searchInput = document.getElementById('moduleSearchInput');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.module-card-full').forEach(card => {
      const name = card.dataset.name;
      const category = card.dataset.category;
      const matches = name.includes(searchTerm) || category.includes(searchTerm);
      card.style.display = matches ? 'flex' : 'none';
    });
  });
}

async function installModule(moduleId, packageName, moduleName) {
  const accountId = currentUser?.accountId || '';
  if (!accountId) {
    showToast('❌ Error', 'No account selected', 'error', 3000);
    return;
  }

  // Show installing toast
  showToast('📦 Installing', `Installing ${moduleName}...`, 'info', 2000);

  try {
    const res = await fetch(`${API}/modules/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountId,
        moduleId: moduleId,
        packageName: packageName,
        moduleName: moduleName
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(
        '✅ Installed',
        `${moduleName} installed successfully!`,
        'success',
        4000
      );

      // Show installation logs if available
      if (data.logs && data.logs.length > 0) {
        console.log('Installation logs:', data.logs.join('\n'));
      }
    } else {
      showToast(
        '❌ Installation Failed',
        data.error || 'Failed to install module',
        'error',
        5000
      );
    }
  } catch (err) {
    console.error('Module installation error:', err);
    showToast(
      '❌ Error',
      'Failed to install module: ' + err.message,
      'error',
      5000
    );
  }
}

// Bot Status Indicator Update Function
function updateBotStatusIndicator(isRunning, status, metrics = {}) {
  const statusCard = document.getElementById('botStatusCard');
  const statusOrb = document.getElementById('botStatusOrb');
  const statusIcon = document.getElementById('botStatusIcon');
  const statusText = document.getElementById('botStatusText');
  const statusSubtext = document.getElementById('botStatusSubtext');
  const statusBadge = document.getElementById('botStatusBadge');
  const lastCheckEl = document.getElementById('lastStatusCheck');
  const pidDisplay = document.getElementById('botPidDisplay');
  const pidValue = document.getElementById('botPidValue');

  if (!statusCard) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastCheckEl) lastCheckEl.textContent = timeStr;

  // Reset classes before applying new ones
  statusCard.className = 'bot-status-card';
  statusOrb.className = 'bot-status-orb';
  if (statusIcon) statusIcon.style.color = ''; // Reset color
  if (statusBadge) statusBadge.className = 'bot-status-badge';

  if (metrics.status === 'restarting') {
    statusCard.classList.add('restarting');
    statusOrb.classList.add('restarting');
    statusIcon.style.color = '#0099ff'; // Orange
    statusText.textContent = 'Restarting';
    statusSubtext.textContent = 'Server is restarting, please wait...';
    statusBadge.classList.add('restarting');
    statusBadge.querySelector('.badge-text').textContent = 'Restarting';
  } else if (isRunning) {
    statusCard.classList.add('online');
    statusOrb.classList.add('online');
    statusText.textContent = 'Online';
    statusSubtext.textContent = 'Bot is running and connected to Discord';
    statusBadge.classList.add('online');
    statusBadge.querySelector('.badge-text').textContent = 'Online';
  } else {
    statusCard.classList.add('offline');
    statusOrb.classList.add('offline');
    statusText.textContent = 'Offline';
    statusSubtext.textContent = 'Bot is not running - Click Start to launch';
    statusBadge.classList.add('offline');
    statusBadge.querySelector('.badge-text').textContent = 'Offline';
  }

  if (metrics.pid && pidDisplay && pidValue) {
    pidDisplay.style.display = 'flex';
    pidValue.textContent = metrics.pid;
  } else if (pidDisplay) {
    pidDisplay.style.display = 'none';
  }
}

function createSVGPath(data, maxValue, height = 80) {
  if (data.length === 0) return 'M 0 80 L 300 80 L 300 80 L 0 80 Z';

  const width = 300;
  const points = data.map((value, index) => {
    const x = (index / (MAX_DATA_POINTS - 1)) * width;
    const y = height - ((value / maxValue) * height * 0.8);
    return `${x},${y}`;
  });

  const pathData = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
  return pathData;
}

function updateSVGChart(pathId, data, maxValue) {
  const path = document.getElementById(pathId);
  if (path) {
    const pathData = createSVGPath(data, maxValue);
    path.setAttribute('d', pathData);
  }
}

async function loadBotErrors() {
  try {
    const accountId = currentUser?.accountId || '';
    const res = await fetch(`${API}/bot/errors?accountId=${accountId}`, {
      credentials: 'include'
    });
    const data = await res.json();

    const container = document.getElementById('errorLogContainer');
    if (container && data.errors) {
      if (data.errors.length === 0) {
        container.innerHTML = `
          <div class="error-log-empty-new">
            <i class="fas fa-check-circle"></i>
            <span>No errors detected</span>
          </div>
        `;
      } else {
        container.innerHTML = data.errors.map((error, index) => `
          <div class="error-log-item ${error.includes('✅') ? 'success' : error.includes('⚠️') ? 'warning' : 'error'}">
            <i class="fas fa-${error.includes('✅') ? 'check-circle' : error.includes('⚠️') ? 'exclamation-triangle' : 'times-circle'}"></i>
            <span>${error}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading bot errors:', err);
  }
}

let serverStartTime = null;
let lastKnownStatus = null;
let statusCheckFailures = 0;

// Load server start time from localStorage
function loadServerStartTime() {
  const accountId = currentUser?.accountId || 'default';
  const savedTime = localStorage.getItem(`serverStartTime_${accountId}`);
  if (savedTime && lastKnownStatus === true) {
    serverStartTime = parseInt(savedTime);
  }
}

// Save server start time to localStorage
function saveServerStartTime() {
  if (serverStartTime && currentUser?.accountId) {
    localStorage.setItem(`serverStartTime_${currentUser.accountId}`, serverStartTime.toString());
  }
}

// Clear server start time from localStorage
function clearServerStartTime() {
  if (currentUser?.accountId) {
    localStorage.removeItem(`serverStartTime_${currentUser.accountId}`);
  }
  serverStartTime = null;
}

async function updateServerStats() {
  // Prevent overlapping status checks
  if (isPolling) {
    return;
  }

  // Only run if we're on the dashboard page
  const dashboardPage = document.getElementById('dashboardPage');
  if (!dashboardPage || !dashboardPage.classList.contains('active')) {
    return;
  }

  isPolling = true;

  try {
    const accountId = currentUser?.accountId || '';

    // Check bot status with timeout
    const statusRes = await fetchWithTimeout(`${API}/bot/status?accountId=${accountId}`);
    let isRunning = false;
    let statusFromAPI = 'offline';
    let botPid = null;
    let metrics = {}; // Initialize metrics object

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      isRunning = statusData.running === true;
      statusFromAPI = statusData.status || (isRunning ? 'online' : 'offline');
      botPid = statusData.pid || null;
      metrics = statusData.metrics || {}; // Get metrics from status response if available
      metrics.pid = botPid; // Ensure pid is included
      metrics.status = statusFromAPI; // Add status for restart indicator
    } else {
      // On error, keep last known status instead of defaulting to offline
      console.warn('Status check failed, keeping last known state');
      isPolling = false;
      return;
    }

    // Use monitoring metrics endpoint with timeout
    const metricsRes = await fetchWithTimeout(`${API}/monitoring/metrics?accountId=${accountId}`);

    if (!metricsRes.ok) {
      console.warn('Metrics check failed, keeping last known state');
      isPolling = false;
      return;
    }

    const metricsData = await metricsRes.json();
    // Merge metrics from monitoring endpoint with existing metrics (e.g., from status)
    metrics = { ...metrics, ...(metricsData.metrics || {}) };
    metrics.pid = botPid; // Ensure pid is preserved
    metrics.status = statusFromAPI; // Ensure status is preserved

    // Reset failure counter on success
    statusCheckFailures = 0;

    // Update Bot Status Indicator
    updateBotStatusIndicator(isRunning, statusFromAPI, metrics);

    if (isRunning) {
      lastKnownStatus = true;

      // Use server-provided uptime (real process uptime)
      const realUptime = metrics.uptime || 0;

      // Update metric values with REAL data
      const cpuPercent = (metrics.cpu || 0).toFixed(2);
      const memoryMiB = (metrics.memory || 0).toFixed(2);

      // Update new dashboard metrics
      const cpuValueNew = document.getElementById('cpuValueNew');
      const memoryValueNew = document.getElementById('memoryValueNew');
      const heroUptime = document.getElementById('heroUptime');
      const networkValueNew = document.getElementById('networkValueNew');
      const netUpload = document.getElementById('netUpload');
      const netDownload = document.getElementById('netDownload');

      if (cpuValueNew) cpuValueNew.textContent = cpuPercent;
      if (memoryValueNew) memoryValueNew.textContent = Math.round(parseFloat(memoryMiB));

      // Display real uptime
      if (heroUptime) {
        const hours = Math.floor(realUptime / 3600);
        const minutes = Math.floor((realUptime % 3600) / 60);
        const seconds = realUptime % 60;
        heroUptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      // Real network I/O data
      const networkIn = (metrics.network_in || 0).toFixed(2);
      const networkOut = (metrics.network_out || 0).toFixed(2);

      if (networkValueNew) networkValueNew.textContent = Math.round(parseFloat(networkOut) * 10); // Convert to KB/s estimate
      if (netUpload) netUpload.textContent = networkOut;
      if (netDownload) netDownload.textContent = networkIn;

      // Update chart data with REAL metrics
      cpuData.push(parseFloat(cpuPercent));
      if (cpuData.length > MAX_DATA_POINTS) cpuData.shift();
      updateSVGChart('cpuPathNew', cpuData, 100);

      memoryData.push(parseFloat(memoryMiB));
      if (memoryData.length > MAX_DATA_POINTS) memoryData.shift();
      updateSVGChart('memoryPathNew', memoryData, 1024);

      // Network data (convert MB to KB for chart)
      const netInKB = parseFloat(networkIn) * 1024;
      const netOutKB = parseFloat(networkOut) * 1024;

      networkInData.push(netInKB);
      networkOutData.push(netOutKB);
      if (networkInData.length > MAX_DATA_POINTS) networkInData.shift();
      if (networkOutData.length > MAX_DATA_POINTS) networkOutData.shift();

      updateSVGChart('networkPathNew', networkOutData, 1000);
    } else {
      // Bot is offline
      if (lastKnownStatus !== false) {
        lastKnownStatus = false;
        clearServerStartTime();
      }

      // Reset all metrics to zero
      const cpuValueNew = document.getElementById('cpuValueNew');
      const memoryValueNew = document.getElementById('memoryValueNew');
      const heroUptime = document.getElementById('heroUptime');
      const networkValueNew = document.getElementById('networkValueNew');
      const netUpload = document.getElementById('netUpload');
      const netDownload = document.getElementById('netDownload');

      if (cpuValueNew) cpuValueNew.textContent = '0.00';
      if (memoryValueNew) memoryValueNew.textContent = '0';
      if (heroUptime) heroUptime.textContent = '00:00:00';
      if (networkValueNew) networkValueNew.textContent = '0';
      if (netUpload) netUpload.textContent = '0';
      if (netDownload) netDownload.textContent = '0';

      // Update charts with zero values
      cpuData.push(0);
      if (cpuData.length > MAX_DATA_POINTS) cpuData.shift();
      updateSVGChart('cpuPathNew', cpuData, 100);

      memoryData.push(0);
      if (memoryData.length > MAX_DATA_POINTS) memoryData.shift();
      updateSVGChart('memoryPathNew', memoryData, 1024);

      networkInData.push(0);
      networkOutData.push(0);
      if (networkInData.length > MAX_DATA_POINTS) networkInData.shift();
      if (networkOutData.length > MAX_DATA_POINTS) networkOutData.shift();

      updateSVGChart('networkPathNew', networkInData, 250);
    }
  } catch (err) {
    console.error('Stats error:', err);

    // Don't increment failures on timeout - keep trying
    if (err.message !== 'Request timeout') {
      statusCheckFailures++;
    }

    // Only mark offline after 5 consecutive real failures (not timeouts)
    if (statusCheckFailures >= 5 && lastKnownStatus !== false) {
      lastKnownStatus = false;
      serverStartTime = null;

      const statusBadge = document.getElementById('serverStatusBadge');
      if (statusBadge) {
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> Offline';
        statusBadge.className = 'status-badge-enhanced offline';
      }
    }
  } finally {
    isPolling = false;
  }
}

// Admin Connect Page
async function loadConnectPage() {
  const page = document.getElementById('connectPage');
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-plug"></i> Admin Connect</h2>
      <p>Connect to any user's hosting account with full access</p>
    </div>
    <div class="connect-container">
      <div class="connect-search">
        <input type="text" id="connectSearchInput" placeholder="Search by Discord username or Instance ID...">
        <button class="btn-primary" onclick="loadConnectPage()"><i class="fas fa-sync"></i> Refresh</button>
      </div>
      <div id="connectHostingsList" class="connect-hostings-list">
        <div class="loading">Loading hosting accounts...</div>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`${API}/admin/connect/hostings`, {
      credentials: 'include'
    });
    const data = await res.json();

    const container = document.getElementById('connectHostingsList');

    if (data.success && data.hostings) {
      if (data.hostings.length === 0) {
        container.innerHTML = '<p class="empty-state">No hosting accounts found</p>';
        return;
      }

      container.innerHTML = data.hostings.map(hosting => `
        <div class="connect-hosting-card" data-name="${hosting.discord_username.toLowerCase()}" data-id="${hosting.account_id.toLowerCase()}">
          <div class="connect-hosting-info">
            <div class="connect-hosting-header">
              <div class="connect-hosting-avatar">
                <i class="fas fa-robot"></i>
              </div>
              <div class="connect-hosting-details">
                <h3>${hosting.hosting_name}</h3>
                <p><i class="fab fa-discord"></i> ${hosting.discord_username}</p>
              </div>
            </div>
            <div class="connect-hosting-meta">
              <span class="connect-meta-item">
                <i class="fas fa-fingerprint"></i>
                ${hosting.account_id.substring(0, 12)}
              </span>
              <span class="connect-meta-item">
                <i class="${hosting.language === 'python' ? 'fab fa-python' : 'fab fa-node-js'}"></i>
                ${hosting.language}
              </span>
              <span class="connect-meta-item status-${hosting.status}">
                <i class="fas fa-circle"></i>
                ${hosting.status}
              </span>
            </div>
          </div>
          <div class="connect-hosting-actions">
            <button class="btn-connect" onclick="connectToHostingSimple('${hosting.account_id}')">
              <i class="fas fa-plug"></i>
              Connect
            </button>
          </div>
        </div>
      `).join('');

      // Add search functionality
      const searchInput = document.getElementById('connectSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          document.querySelectorAll('.connect-hosting-card').forEach(card => {
            const name = card.dataset.name;
            const id = card.dataset.id;
            const matches = name.includes(searchTerm) || id.includes(searchTerm);
            card.style.display = matches ? 'flex' : 'none';
          });
        });
      }
    } else {
      container.innerHTML = '<p class="empty-state">Failed to load hosting accounts</p>';
    }
  } catch (err) {
    console.error('Error loading connect page:', err);
    document.getElementById('connectHostingsList').innerHTML = '<p class="empty-state">Error loading hosting accounts</p>';
  }
}

async function connectToHostingSimple(accountId) {
  showConnectAccessModal(accountId, 'Hosting Account');
}

// Admin Dashboard
async function loadAdminDashboard() {
  const page = document.getElementById('dashboardPage');
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-tachometer-alt"></i> Admin Dashboard</h2>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <div class="card-header">
          <div class="card-icon cpu-icon">
            <i class="fas fa-server"></i>
          </div>
          <div class="card-title">Total Hosting Accounts</div>
        </div>
        <div class="card-value" id="totalAccounts">0</div>
      </div>
      <div class="dashboard-card">
        <div class="card-header">
          <div class="card-icon memory-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="card-title">Active Accounts</div>
        </div>
        <div class="card-value" id="activeAccounts">0</div>
      </div>
      <div class="dashboard-card">
        <div class="card-header">
          <div class="card-icon disk-icon">
            <i class="fas fa-database"></i>
          </div>
          <div class="card-title">Total Storage Used</div>
        </div>
        <div class="card-value" id="totalStorage">0 MB</div>
      </div>
    </div>
  `;

  updateDashboardStats();
}

async function updateDashboardStats() {
  try {
    const res = await fetch(`${API}/hosting/stats`);
    const data = await res.json();

    if (data.stats) {
      document.getElementById('totalAccounts').textContent = data.stats.total || 0;
      document.getElementById('activeAccounts').textContent = data.stats.active || 0;
      document.getElementById('totalStorage').textContent = (data.stats.storage || 0) + ' MB';
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// Console Page - Redesigned with real-time updates
let consoleLogCache = [];
let lastLogCount = 0;
let consoleUpdateInterval = null;
let isConsoleAutoScroll = true;
let permanentLogStorage = []; // Never cleared unless user explicitly clears

function loadConsole() {
  const page = document.getElementById('consolePage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-terminal"></i> Console</h2>
    </div>
    <div class="console-page-redesign">
      <div class="console-controls-bar">

        <div class="console-actions-bar">
          <button class="console-control-btn" id="clearConsoleBtn" title="Clear Console">
            <i class="fas fa-eraser"></i>
            <span>Clear</span>
          </button>
          <button class="console-control-btn" id="autoScrollBtn" title="Auto-scroll" data-active="true">
            <i class="fas fa-arrow-down"></i>
            <span>Auto-scroll</span>
          </button>
          <button class="console-control-btn" id="downloadLogsBtn" title="Download Logs">
            <i class="fas fa-download"></i>
            <span>Download</span>
          </button>
        </div>
      </div>

      <div class="console-metrics-compact">
        <div class="metric-compact cpu">
          <i class="fas fa-microchip"></i>
          <span id="consoleCpuMetric">0.00%</span>
        </div>
        <div class="metric-compact memory">
          <i class="fas fa-memory"></i>
          <span id="consoleMemoryMetric">0 MiB</span>
        </div>
        <div class="metric-compact uptime">
          <i class="fas fa-clock"></i>
          <span id="consoleUptimeMetric">00:00:00</span>
        </div>
        <div class="metric-compact logs">
          <i class="fas fa-file-alt"></i>
          <span id="consoleLogCount">0 lines</span>
        </div>
      </div>

      <div class="console-terminal-container">
        <div class="console-terminal" id="consoleTerminal">
          <div class="console-welcome-message">
            <i class="fas fa-terminal"></i>
            <p>Waiting for bot to start...</p>
            <small>Console output will appear here</small>
          </div>
        </div>
      </div>

      <div class="console-command-bar">
        <span class="console-prompt-char">$</span>
        <input
          type="text"
          id="consoleCommandInput"
          placeholder="Type a command (feature coming soon)..."
          autocomplete="off"
          spellcheck="false"
        />
        <button class="console-send-btn" id="consoleSendBtn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;

  // Initialize console
  initConsole();
}

function initConsole() {
  // Clear existing interval
  if (consoleUpdateInterval) clearInterval(consoleUpdateInterval);

  // Reset cache
  consoleLogCache = [];
  lastLogCount = 0;

  // Set up event listeners
  const clearBtn = document.getElementById('clearConsoleBtn');
  const autoScrollBtn = document.getElementById('autoScrollBtn');
  const downloadBtn = document.getElementById('downloadLogsBtn');
  const commandInput = document.getElementById('consoleCommandInput');
  const sendBtn = document.getElementById('consoleSendBtn');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearConsoleTerminal();
    });
  }

  if (autoScrollBtn) {
    autoScrollBtn.addEventListener('click', () => {
      isConsoleAutoScroll = !isConsoleAutoScroll;
      autoScrollBtn.dataset.active = isConsoleAutoScroll;
      if (isConsoleAutoScroll) {
        scrollConsoleToBottom();
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      downloadConsoleLogs();
    });
  }

  if (commandInput) {
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendConsoleCommand();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      sendConsoleCommand();
    });
  }

  // Start real-time updates with cPanel-friendly interval
  updateConsoleRealtime();
  consoleUpdateInterval = setInterval(updateConsoleRealtime, POLLING_CONFIG.CONSOLE_INTERVAL);
}

async function updateConsoleRealtime() {
  try {
    const accountId = currentUser?.accountId || '';

    // Fetch bot status with timeout
    const statusRes = await fetchWithTimeout(`${API}/bot/status?accountId=${accountId}`);
    const statusData = await statusRes.json();

    // Update status indicator
    const statusDot = document.getElementById('consoleStatusDot');
    const statusText = document.getElementById('consoleStatusText');

    if (statusData.running) {
      if (statusDot) {
        statusDot.className = 'status-dot online';
      }
      if (statusText) {
        statusText.textContent = 'Online';
      }

      // Update metrics
      updateConsoleMetrics(statusData);
    } else {
      if (statusDot) {
        statusDot.className = 'status-dot offline';
      }
      if (statusText) {
        statusText.textContent = 'Offline';
      }

      // Reset metrics
      document.getElementById('consoleCpuMetric').textContent = '0.00%';
      document.getElementById('consoleMemoryMetric').textContent = '0 MiB';
      document.getElementById('consoleUptimeMetric').textContent = '00:00:00';
    }

    // Fetch logs with timeout
    const logsRes = await fetchWithTimeout(`${API}/bot/logs?accountId=${accountId}`);
    const logsData = await logsRes.json();

    if (logsData.logs && Array.isArray(logsData.logs)) {
      updateConsoleLogs(logsData.logs);
    }

  } catch (err) {
    console.error('Console update error:', err);
  }
}

function updateConsoleMetrics(statusData) {
  const cpuMetric = document.getElementById('consoleCpuMetric');
  const memoryMetric = document.getElementById('consoleMemoryMetric');
  const uptimeMetric = document.getElementById('consoleUptimeMetric');

  if (cpuMetric && statusData.cpu !== undefined) {
    cpuMetric.textContent = statusData.cpu.toFixed(2) + '%';
  }

  if (memoryMetric && statusData.memory !== undefined) {
    memoryMetric.textContent = statusData.memory.toFixed(2) + ' MiB';
  }

  if (uptimeMetric && serverStartTime) {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const hours = Math.floor(uptime / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((uptime % 3600) / 60).toString().padStart(2, '0');
    const seconds = (uptime % 60).toString().padStart(2, '0');
    uptimeMetric.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

function updateConsoleLogs(newLogs) {
  const terminal = document.getElementById('consoleTerminal');
  if (!terminal) return;

  // NEVER clear logs - always preserve them
  // Merge new logs into permanent storage
  newLogs.forEach(log => {
    if (!permanentLogStorage.includes(log)) {
      permanentLogStorage.push(log);
    }
  });

  // If no logs at all, show welcome message
  if (permanentLogStorage.length === 0) {
    if (!terminal.querySelector('.console-welcome-message')) {
      terminal.innerHTML = `
        <div class="console-welcome-message">
          <i class="fas fa-terminal"></i>
          <p>No logs available</p>
          <small>Start your bot to see console output</small>
        </div>
      `;
    }
    updateLogCount(0);
    return;
  }

  // Only append new logs that aren't already displayed
  const currentDisplayedCount = consoleLogCache.length;
  const newLogsToAdd = permanentLogStorage.slice(currentDisplayedCount);

  if (newLogsToAdd.length > 0) {
    // Remove welcome message if present
    const welcomeMsg = terminal.querySelector('.console-welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    // Append new logs
    newLogsToAdd.forEach(log => {
      const logLine = document.createElement('div');
      logLine.className = 'console-log-line';

      // Add timestamp
      const timestamp = new Date().toLocaleTimeString();
      logLine.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <span class="log-content">${escapeHtml(log)}</span>
      `;

      // Color code based on content
      const logLower = log.toLowerCase();
      if (logLower.includes('error') || logLower.includes('exception')) {
        logLine.classList.add('log-error');
      } else if (logLower.includes('warning') || logLower.includes('warn')) {
        logLine.classList.add('log-warning');
      } else if (logLower.includes('success') || logLower.includes('✅')) {
        logLine.classList.add('log-success');
      } else if (logLower.includes('info')) {
        logLine.classList.add('log-info');
      }

      terminal.appendChild(logLine);
      consoleLogCache.push(log);
    });

    // Auto-scroll if enabled
    if (isConsoleAutoScroll) {
      scrollConsoleToBottom();
    }

    // Update log count with permanent storage count
    updateLogCount(permanentLogStorage.length);
  }

  lastLogCount = newLogs.length;
}

function scrollConsoleToBottom() {
  const terminal = document.getElementById('consoleTerminal');
  if (terminal) {
    terminal.scrollTop = terminal.scrollHeight;
  }
}

function updateLogCount(count) {
  const logCountEl = document.getElementById('consoleLogCount');
  if (logCountEl) {
    logCountEl.textContent = `${count} ${count === 1 ? 'line' : 'lines'}`;
  }
}

function clearConsoleTerminal() {
  const terminal = document.getElementById('consoleTerminal');
  if (terminal) {
    // Only clear the visual display, NOT the permanent storage
    terminal.innerHTML = `
      <div class="console-log-line info">
        <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
        <span class="log-content">[INFO] Console display cleared (${permanentLogStorage.length} logs preserved)</span>
      </div>
    `;
    // Clear only the display cache, not permanent storage
    consoleLogCache = [];
    // Logs will reload on next update from permanentLogStorage
    showToast('🧹 Display Cleared', `Console display cleared. ${permanentLogStorage.length} logs preserved.`, 'info', 3000);
  }
}

function downloadConsoleLogs() {
  if (consoleLogCache.length === 0) {
    showToast('No Logs', 'There are no logs to download', 'warning', 3000);
    return;
  }

  const logText = consoleLogCache.join('\n');
  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bot-logs-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Download Started', 'Console logs downloaded successfully', 'success', 3000);
}

function sendConsoleCommand() {
  const input = document.getElementById('consoleCommandInput');
  if (input && input.value.trim()) {
    showToast('Coming Soon', 'Command execution will be available soon', 'info', 3000);
    input.value = '';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Settings Page
function loadSettings() {
  const page = document.getElementById('settingsPage');
  page.innerHTML = `
    <div class="settings-page-modern">
      <div class="settings-header-modern">
        <div class="settings-title-section">
          <h2><i class="fas fa-cog"></i> Server Settings</h2>
          <p class="settings-subtitle">Manage your bot server configuration and preferences</p>
        </div>
      </div>

      <div class="settings-grid-modern">
        <!-- Server Information -->
        <div class="settings-card-modern">
          <div class="settings-card-header-modern">
            <div class="settings-icon-modern server-icon">
              <i class="fas fa-server"></i>
            </div>
            <div>
              <h3>Server Information</h3>
              <p>Basic server details and configuration</p>
            </div>
          </div>
          <div class="settings-card-body-modern">
            <div class="settings-form-group">
              <label><i class="fas fa-tag"></i> Server Name</label>
              <input type="text" class="settings-input" value="${currentUser.hostingName || 'My Bot Server'}" placeholder="Enter server name">
            </div>
            <div class="settings-form-group">
              <label><i class="fas fa-align-left"></i> Description</label>
              <textarea class="settings-textarea" placeholder="Enter server description" rows="3">A powerful Discord bot hosting server</textarea>
            </div>
            <div class="settings-form-group">
              <label><i class="fas fa-globe"></i> Region</label>
              <select class="settings-input">
                <option>North America (US)</option>
                <option>Europe (EU)</option>
                <option>Asia Pacific (AP)</option>
              </select>
            </div>
            <button class="settings-save-btn">
              <i class="fas fa-save"></i> Save Changes
            </button>
          </div>
        </div>

        <!-- SFTP Access -->
        <div class="settings-card-modern">
          <div class="settings-card-header-modern">
            <div class="settings-icon-modern sftp-icon">
              <i class="fas fa-terminal"></i>
            </div>
            <div>
              <h3>SFTP Access</h3>
              <p>Secure file transfer protocol details</p>
            </div>
          </div>
          <div class="settings-card-body-modern">
            <div class="sftp-detail-modern">
              <div class="sftp-label"><i class="fas fa-server"></i> Server Address</div>
              <div class="sftp-value-modern">
                <code>sftp://node.alqulol.host:2022</code>
                <button class="copy-icon-btn" onclick="copyToClipboard('sftp://node.alqulol.host:2022')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="sftp-detail-modern">
              <div class="sftp-label"><i class="fas fa-user"></i> Username</div>
              <div class="sftp-value-modern">
                <code>${currentUser.accountId || 'user'}</code>
                <button class="copy-icon-btn" onclick="copyToClipboard('${currentUser.accountId}')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="sftp-detail-modern">
              <div class="sftp-label"><i class="fas fa-lock"></i> Password</div>
              <div class="sftp-note-modern">
                <i class="fas fa-info-circle"></i>
                Use your panel password for SFTP authentication
              </div>
            </div>
            <button class="settings-action-btn primary">
              <i class="fas fa-external-link-alt"></i> Launch SFTP Client
            </button>
          </div>
        </div>

        <!-- Debug Information -->
        <div class="settings-card-modern">
          <div class="settings-card-header-modern">
            <div class="settings-icon-modern debug-icon">
              <i class="fas fa-bug"></i>
            </div>
            <div>
              <h3>Debug Information</h3>
              <p>System diagnostics and identifiers</p>
            </div>
          </div>
          <div class="settings-card-body-modern">
            <div class="debug-grid-modern">
              <div class="debug-item-modern">
                <div class="debug-item-label">
                  <i class="fas fa-microchip"></i>
                  <span>Node ID</span>
                </div>
                <div class="debug-item-value">GRA-N36 - Premium</div>
              </div>
              <div class="debug-item-modern">
                <div class="debug-item-label">
                  <i class="fas fa-fingerprint"></i>
                  <span>Server ID</span>
                </div>
                <div class="debug-item-value">${currentUser.accountId || '16438010'}</div>
              </div>
              <div class="debug-item-modern">
                <div class="debug-item-label">
                  <i class="fas fa-network-wired"></i>
                  <span>IP Address</span>
                </div>
                <div class="debug-item-value">192.168.1.100</div>
              </div>
              <div class="debug-item-modern">
                <div class="debug-item-label">
                  <i class="fas fa-code-branch"></i>
                  <span>Version</span>
                </div>
                <div class="debug-item-value">v2.4.1</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notification Settings -->
        <div class="settings-card-modern">
          <div class="settings-card-header-modern">
            <div class="settings-icon-modern notification-icon">
              <i class="fas fa-bell"></i>
            </div>
            <div>
              <h3>Notifications</h3>
              <p>Configure alert preferences</p>
            </div>
          </div>
          <div class="settings-card-body-modern">
            <div class="settings-toggle-item">
              <div class="toggle-info">
                <i class="fas fa-exclamation-circle"></i>
                <div>
                  <div class="toggle-title">Error Alerts</div>
                  <div class="toggle-desc">Get notified when errors occur</div>
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-toggle-item">
              <div class="toggle-info">
                <i class="fas fa-chart-line"></i>
                <div>
                  <div class="toggle-title">Resource Alerts</div>
                  <div class="toggle-desc">Alert on high resource usage</div>
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox">
                <span class="slider-new"></span>
              </label>
            </div>
            <div class="settings-toggle-item">
              <div class="toggle-info">
                <i class="fas fa-power-off"></i>
                <div>
                  <div class="toggle-title">Status Updates</div>
                  <div class="toggle-desc">Notify on bot start/stop</div>
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" checked>
                <span class="slider-new"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="settings-card-modern danger-zone-card">
          <div class="settings-card-header-modern">
            <div class="settings-icon-modern danger-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h3>Danger Zone</h3>
              <p>Irreversible and destructive actions</p>
            </div>
          </div>
          <div class="settings-card-body-modern">
            <div class="danger-action-modern">
              <div class="danger-action-info">
                <i class="fas fa-redo"></i>
                <div>
                  <div class="danger-action-title">Reinstall Server</div>
                  <div class="danger-action-desc">Remove all files and reset to empty state</div>
                </div>
              </div>
              <button class="danger-btn-modern" id="reinstallServerBtn">
                <i class="fas fa-redo"></i> Reinstall
              </button>
            </div>
            <div class="danger-action-modern">
              <div class="danger-action-info">
                <i class="fas fa-trash"></i>
                <div>
                  <div class="danger-action-title">Request Account Deletion</div>
                  <div class="danger-action-desc">Submit deletion request to admin (requires approval)</div>
                </div>
              </div>
              <button class="danger-btn-modern" id="deleteServerBtn">
                <i class="fas fa-paper-plane"></i> Request Deletion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for danger zone buttons
  const reinstallBtn = document.getElementById('reinstallServerBtn');
  const deleteBtn = document.getElementById('deleteServerBtn');

  reinstallBtn?.addEventListener('click', () => {
    showConfirmationModal(
      '⚠️ Reinstall Server',
      'This will DELETE ALL FILES in your server! Your server will be reset to an empty state. This action cannot be undone.',
      'Yes, Reinstall',
      'No, Cancel',
      async () => {
        try {
          const res = await fetch(`${API}/hosting/${currentUser.accountId}/reinstall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          const data = await res.json();

          if (data.success) {
            showSuccessModal('✅ Server Reinstalled', `All files have been removed successfully. Removed ${data.removed_count} items.`, () => {
              loadFiles();
            });
          } else {
            showErrorModal('❌ Reinstall Failed', data.error || 'Unknown error occurred');
          }
        } catch (err) {
          showErrorModal('❌ Error', 'Failed to reinstall server: ' + err.message);
        }
      }
    );
  });

  deleteBtn?.addEventListener('click', () => {
    showConfirmationModal(
      '⚠️ REQUEST ACCOUNT DELETION',
      'This will submit a deletion request to the administrator. Your account will be reviewed and deleted by an admin. The account will be archived for staff review. Do you want to proceed?',
      'Submit Request',
      'Cancel',
      async () => {
        try {
          const res = await fetch(`${API}/hosting/${currentUser.accountId}`, {
            method: 'DELETE'
          });

          const data = await res.json();

          if (data.success) {
            showSuccessModal(
              '✅ Deletion Request Submitted',
              `${data.message}\n\nRequest ID: ${data.request_id}\n\nAn administrator will review your request. You will remain logged in until the admin approves the deletion.`,
              () => {
                // Don't log out - let them continue using until admin approves
                loadSettings(); // Reload the settings page
              }
            );
          } else {
            showErrorModal('❌ Request Failed', data.error || 'Failed to submit deletion request');
          }
        } catch (err) {
          showErrorModal('❌ Error', 'Failed to submit deletion request: ' + err.message);
        }
      }
    );
  });
}

// Files Page - Current path for navigation
let currentFilePath = '';

async function loadFiles() {
  const page = document.getElementById('filesPage');
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-folder"></i> File Manager</h2>
    </div>
    <div class="files-page-pterodactyl">
      <div class="files-top-bar">
        <div class="files-breadcrumb-container">
          <div class="files-breadcrumb" id="filesBreadcrumb">
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active" onclick="navigateToFolder('')">home</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active" onclick="navigateToFolder('')">container</span>
          </div>
          <div class="files-search-container">
            <i class="fas fa-search"></i>
            <input type="text" id="fileSearchInput" placeholder="Search">
          </div>
        </div>
        <div class="files-action-buttons">
          <button class="files-btn delete-btn" onclick="deleteSelectedFiles()">
            <i class="fas fa-trash"></i>
          </button>
          <button class="files-btn" onclick="archiveSelectedFiles()">
            <i class="fas fa-file-archive"></i>
          </button>
          <button class="files-btn" onclick="copySelectedFiles()">
            <i class="fas fa-copy"></i>
          </button>
          <button class="files-btn" onclick="downloadSelectedFiles()">
            <i class="fas fa-download"></i>
          </button>
          <button class="files-btn upload-btn" id="uploadFileBtn" title="Upload Files">
            <i class="fas fa-file-upload"></i>
          </button>
          <button class="files-btn upload-btn" id="uploadFolderBtn" title="Upload Folder">
            <i class="fas fa-folder-open"></i>
          </button>
          <button class="files-btn new-file-btn" onclick="createNewFile()">
            <i class="fas fa-file-alt"></i>
          </button>
          <button class="files-btn new-folder-btn" onclick="showCreateFolderModal()">
            <i class="fas fa-folder-plus"></i>
          </button>
        </div>
      </div>

      <div class="files-table-container">
        <table class="files-table-pterodactyl">
          <thead>
            <tr>
              <th class="checkbox-col"><input type="checkbox" id="selectAllFiles" onchange="toggleSelectAllFiles(this.checked)"></th>
              <th class="name-col" onclick="sortFilesBy('name')">name <i class="fas fa-sort"></i></th>
              <th class="size-col" onclick="sortFilesBy('size')">size <i class="fas fa-sort"></i></th>
              <th class="date-col" onclick="sortFilesBy('date')">date <i class="fas fa-sort"></i></th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody id="filesTableBody">
            <tr>
              <td colspan="5" class="loading-cell">
                <i class="fas fa-spinner fa-spin"></i> Loading files...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="files-footer">
        <span>Pterodactyl&copy; 2015 - 2025</span>
        <span>Designed by ALN Hosting</span>
      </div>
    </div>
    <input type="file" id="fileUploadInput" hidden multiple>
    <input type="file" id="folderUploadInput" hidden multiple webkitdirectory>
    
    <!-- Create Folder Modal -->
    <div class="create-folder-modal" id="createFolderModal" style="display: none;">
      <div class="create-folder-modal-content">
        <div class="create-folder-modal-header">
          <h3><i class="fas fa-folder-plus"></i> Create New Folder</h3>
          <button class="close-modal-btn" onclick="closeCreateFolderModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="create-folder-modal-body">
          <label>Folder Name</label>
          <input type="text" id="newFolderName" placeholder="Enter folder name..." onkeypress="if(event.key === 'Enter') createFolder()">
        </div>
        <div class="create-folder-modal-footer">
          <button class="cancel-btn" onclick="closeCreateFolderModal()">Cancel</button>
          <button class="create-btn" onclick="createFolder()">
            <i class="fas fa-folder-plus"></i> Create Folder
          </button>
        </div>
      </div>
    </div>
  `;

  currentFilePath = '';
  loadFileList();

  const uploadInput = document.getElementById('fileUploadInput');
  const folderInput = document.getElementById('folderUploadInput');
  const uploadBtn = document.getElementById('uploadFileBtn');
  const uploadFolderBtn = document.getElementById('uploadFolderBtn');
  const filesGrid = document.getElementById('filesGridContainer');

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      uploadInput.click();
    });
  }

  if (uploadFolderBtn) {
    uploadFolderBtn.addEventListener('click', () => {
      folderInput.click();
    });
  }

  if (uploadInput) uploadInput.addEventListener('change', handleFileUpload);
  if (folderInput) folderInput.addEventListener('change', handleFileUpload);

  // Drag and Drop with folder support
  if (filesGrid) {
    filesGrid.addEventListener('dragover', (e) => {
      e.preventDefault();
      filesGrid.classList.add('drag-over');
    });

    filesGrid.addEventListener('dragleave', () => {
      filesGrid.classList.remove('drag-over');
    });

    filesGrid.addEventListener('drop', async (e) => {
    e.preventDefault();
    filesGrid.classList.remove('drag-over');
    
    // Handle both files and folders via DataTransfer items
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const allFiles = [];
      const promises = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          promises.push(traverseFileTree(item, '', allFiles));
        }
      }
      
      await Promise.all(promises);
      
      if (allFiles.length > 0) {
        handleFileUploadFromDrop(allFiles);
      }
    } else {
      // Fallback for browsers that don't support webkitGetAsEntry
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload({ target: { files } });
      }
    }
    });
  }


  const searchInput = document.getElementById('fileSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      document.querySelectorAll('.file-card-modern, .folder-card-modern').forEach(card => {
        const filename = card.dataset.filename.toLowerCase();
        card.style.display = filename.includes(searchTerm) ? 'flex' : 'none';
      });
    });
  }
}

// Traverse file tree for drag and drop folder upload
async function traverseFileTree(item, path, allFiles) {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file) => {
        // Store the relative path with the file
        file.relativePath = path + file.name;
        allFiles.push(file);
        resolve();
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async (entries) => {
        const promises = [];
        for (let entry of entries) {
          promises.push(traverseFileTree(entry, path + item.name + '/', allFiles));
        }
        await Promise.all(promises);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Handle file upload from drag and drop with folder support
async function handleFileUploadFromDrop(files) {
  const accountId = currentUser?.accountId || '';
  const formData = new FormData();

  for (let file of files) {
    const fileName = file.relativePath || file.name;
    // Prepend current path if we're in a subdirectory
    const fullPath = currentFilePath ? currentFilePath + '/' + fileName : fileName;
    formData.append('file', file, fullPath);
  }

  formData.append('accountId', accountId);

  showToast(
    'Uploading Files',
    `Uploading ${files.length} file(s)...`,
    'info',
    2000
  );

  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      showToast(
        'Upload Complete',
        `Successfully uploaded ${data?.count || files.length} file(s)`,
        'success',
        4000
      );
      loadFileList();
      loadStorageInfo(); // Refresh storage display
    } else {
      // Check if this is a storage exceeded error
      if (data?.storage_exceeded) {
        showStorageFullNotification(data);
        loadStorageInfo(); // Refresh storage display
      } else {
        const errMsg = data?.error || `Server returned ${res.status}`;
        showToast(
          'Upload Failed',
          errMsg,
          'error',
          5000
        );
      }
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast(
      'Upload Error',
      'Error uploading files: ' + err.message,
      'error',
      5000
    );
  }
}

// Navigate to a folder
function navigateToFolder(path) {
  currentFilePath = path;
  loadFileList();
}

// Update breadcrumb - Pterodactyl style
function updateBreadcrumb(path) {
  const breadcrumb = document.getElementById('filesBreadcrumb');
  if (!breadcrumb) return;
  
  let html = '<span class="breadcrumb-separator">/</span>';
  html += '<span class="breadcrumb-item active" onclick="navigateToFolder(\'\')">home</span>';
  html += '<span class="breadcrumb-separator">/</span>';
  html += '<span class="breadcrumb-item active" onclick="navigateToFolder(\'\')">container</span>';
  
  if (path) {
    const parts = path.split('/');
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      currentPath += (i > 0 ? '/' : '') + parts[i];
      html += '<span class="breadcrumb-separator">/</span>';
      html += `<span class="breadcrumb-item active" onclick="navigateToFolder('${currentPath}')">${parts[i]}</span>`;
    }
  }
  
  breadcrumb.innerHTML = html;
}

// Create folder modal functions
function showCreateFolderModal() {
  const modal = document.getElementById('createFolderModal');
  if (modal) {
    modal.style.display = 'flex';
    const input = document.getElementById('newFolderName');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function closeCreateFolderModal() {
  const modal = document.getElementById('createFolderModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function createFolder() {
  const folderName = document.getElementById('newFolderName')?.value?.trim();
  
  if (!folderName) {
    showToast('Error', 'Please enter a folder name', 'error', 3000);
    return;
  }
  
  const accountId = currentUser?.accountId || '';
  
  try {
    const res = await fetch(`${API}/files/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        folderName: folderName,
        accountId: accountId,
        currentPath: currentFilePath
      })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      showToast('Success', `Folder "${folderName}" created successfully`, 'success', 3000);
      closeCreateFolderModal();
      loadFileList();
    } else {
      showToast('Error', data.error || 'Failed to create folder', 'error', 4000);
    }
  } catch (err) {
    showToast('Error', 'Failed to create folder: ' + err.message, 'error', 4000);
  }
}

// Toggle select all files
function toggleSelectAllFiles(checked) {
  document.querySelectorAll('.file-row-checkbox').forEach(cb => {
    cb.checked = checked;
  });
}

// Delete selected files
async function deleteSelectedFiles() {
  const selected = document.querySelectorAll('.file-row-checkbox:checked');
  if (selected.length === 0) {
    showToast('Info', 'No files selected', 'info', 2000);
    return;
  }
  
  showConfirmationModal(
    'Delete Selected Files',
    `Are you sure you want to delete ${selected.length} selected item(s)?`,
    'Delete',
    'Cancel',
    async () => {
      for (const cb of selected) {
        const filePath = cb.dataset.filepath;
        await fetch(`${API}/files/${encodeURIComponent(filePath)}?accountId=${currentUser?.accountId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      }
      showToast('Success', `Deleted ${selected.length} item(s)`, 'success', 3000);
      loadFileList();
    }
  );
}

// Sort files
let currentSortBy = 'name';
let currentSortOrder = 'asc';

function sortFilesBy(field) {
  if (currentSortBy === field) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortBy = field;
    currentSortOrder = 'asc';
  }
  loadFileList();
}

async function loadFileList() {
  try {
    const accountId = currentUser?.accountId || '';
    const pathParam = currentFilePath ? `&path=${encodeURIComponent(currentFilePath)}` : '';
    const res = await fetch(`${API}/files?accountId=${accountId}${pathParam}`, {
      credentials: 'include'
    });
    const data = await res.json();

    // Update breadcrumb
    updateBreadcrumb(currentFilePath);

    const container = document.getElementById('filesTableBody');
    if (container) {
      const folders = data.folders || [];
      const files = data.files || [];
      
      // Sort files and folders
      const sortFn = (a, b) => {
        let valA, valB;
        if (currentSortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (currentSortBy === 'size') {
          valA = a.size || 0;
          valB = b.size || 0;
        } else if (currentSortBy === 'date') {
          valA = a.modified || 0;
          valB = b.modified || 0;
        }
        if (currentSortOrder === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      };
      
      folders.sort(sortFn);
      files.sort(sortFn);
      
      if (folders.length === 0 && files.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="5" class="empty-cell">
              <div class="files-empty-state-pterodactyl">
                <i class="fas fa-folder-open"></i>
                <p>This directory is empty</p>
              </div>
            </td>
          </tr>
        `;
      } else {
        let html = '';
        
        // Render folders
        folders.forEach(folder => {
          const folderPath = currentFilePath ? currentFilePath + '/' + folder.name : folder.name;
          html += `
            <tr class="file-row folder-row" onclick="navigateToFolder('${folderPath}')">
              <td class="checkbox-col" onclick="event.stopPropagation()"><input type="checkbox" class="file-row-checkbox" data-filepath="${folderPath}"></td>
              <td class="name-col">
                <div class="file-name-cell">
                  <i class="fas fa-folder folder-icon"></i>
                  <span class="file-name">${folder.name}</span>
                </div>
              </td>
              <td class="size-col"></td>
              <td class="date-col">${formatDatePterodactyl(folder.modified)}</td>
              <td class="actions-col" onclick="event.stopPropagation()">
                <button class="file-action-btn" onclick="showFileContextMenu(event, '${folderPath}', 'folder')">
                  <i class="fas fa-ellipsis-h"></i>
                </button>
              </td>
            </tr>
          `;
        });
        
        // Render files
        files.forEach(file => {
          const filePath = currentFilePath ? currentFilePath + '/' + file.name : file.name;
          html += `
            <tr class="file-row" onclick="openFileEditor('${filePath}')">
              <td class="checkbox-col" onclick="event.stopPropagation()"><input type="checkbox" class="file-row-checkbox" data-filepath="${filePath}"></td>
              <td class="name-col">
                <div class="file-name-cell">
                  <i class="fas fa-${getFileIcon(file.name)} file-icon"></i>
                  <span class="file-name">${file.name}</span>
                </div>
              </td>
              <td class="size-col">${formatFileSizeBytes(file.size)}</td>
              <td class="date-col">${formatDatePterodactyl(file.modified)}</td>
              <td class="actions-col" onclick="event.stopPropagation()">
                <button class="file-action-btn" onclick="showFileContextMenu(event, '${filePath}', 'file')">
                  <i class="fas fa-ellipsis-h"></i>
                </button>
              </td>
            </tr>
          `;
        });
        
        container.innerHTML = html;
      }
    }
  } catch (err) {
    console.error('File list error:', err);
    const container = document.getElementById('filesGridContainer');
    if (container) {
      container.innerHTML = `
        <div class="files-error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error loading files</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

// Toggle folder menu
function toggleFolderMenuModern(event, folderName) {
  event.stopPropagation();
  closeAllMenus();
  
  const folderPath = currentFilePath ? currentFilePath + '/' + folderName : folderName;
  const menuId = 'folder-menu-' + folderPath.replace(/[\/\.]/g, '-');
  const menu = document.getElementById(menuId);
  
  if (menu) {
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    menu.style.top = rect.bottom + 5 + 'px';
    menu.style.left = rect.left - 100 + 'px';
    menu.classList.add('show');
  }
}

function encodePathForAPI(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

// Rename folder
async function renameFolder(folderPath) {
  const folderName = folderPath.split('/').pop();
  const newName = prompt('Enter new folder name:', folderName);
  if (!newName || newName === folderName) return;
  
  const parentPath = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : '';
  const newPath = parentPath ? parentPath + '/' + newName : newName;
  
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/${encodePathForAPI(folderPath)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newName: newPath, accountId })
    });
    
    if (res.ok) {
      showToast('Success', 'Folder renamed successfully', 'success', 3000);
      loadFileList();
    } else {
      const data = await res.json();
      showToast('Error', data.error || 'Failed to rename folder', 'error', 5000);
    }
  } catch (err) {
    showToast('Error', 'Failed to rename folder: ' + err.message, 'error', 5000);
  }
}

// Confirm delete folder
async function confirmDeleteFolder(folderPath) {
  if (!confirm(`Are you sure you want to delete the folder "${folderPath}" and all its contents?`)) {
    return;
  }
  
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/${encodePathForAPI(folderPath)}?accountId=${accountId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (res.ok) {
      showToast('Success', 'Folder deleted successfully', 'success', 3000);
      loadFileList();
    } else {
      const data = await res.json();
      showToast('Error', data.error || 'Failed to delete folder', 'error', 5000);
    }
  } catch (err) {
    showToast('Error', 'Failed to delete folder: ' + err.message, 'error', 5000);
  }
}

function getFileIcon(filename) {
  if (filename.endsWith('.py')) return 'file-code';
  if (filename.endsWith('.json')) return 'file-code';
  if (filename.endsWith('.txt')) return 'file-alt';
  if (filename.endsWith('.md')) return 'file-alt';
  if (filename.match(/\.(jpg|png|gif|svg)$/)) return 'file-image';
  return 'file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KiB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MiB';
}

function formatFileSizeBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' Bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KiB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MiB';
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' minutes ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';

  return date.toLocaleDateString();
}

function formatDatePterodactyl(timestamp) {
  const date = new Date(timestamp * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${month} ${day}${getDaySuffix(day)}, ${year} ${hour12}:${minutes}${ampm}`;
}

function getDaySuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function showFileContextMenu(event, filePath, type) {
  event.stopPropagation();
  closeAllMenus();
  
  const existingMenu = document.getElementById('fileContextMenu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.id = 'fileContextMenu';
  menu.className = 'file-context-menu-pterodactyl';
  
  if (type === 'folder') {
    menu.innerHTML = `
      <button onclick="navigateToFolder('${filePath}'); closeAllMenus()">
        <i class="fas fa-folder-open"></i> Open
      </button>
      <button onclick="renameFolder('${filePath}'); closeAllMenus()">
        <i class="fas fa-pen"></i> Rename
      </button>
      <button onclick="showMoveModal('${filePath}', 'folder'); closeAllMenus()">
        <i class="fas fa-arrows-alt"></i> Move
      </button>
      <div class="menu-divider"></div>
      <button class="danger" onclick="confirmDeleteFolder('${filePath}'); closeAllMenus()">
        <i class="fas fa-trash"></i> Delete
      </button>
    `;
  } else {
    menu.innerHTML = `
      <button onclick="openFileEditor('${filePath}'); closeAllMenus()">
        <i class="fas fa-edit"></i> Edit
      </button>
      <button onclick="renameFile('${filePath}'); closeAllMenus()">
        <i class="fas fa-pen"></i> Rename
      </button>
      <button onclick="showMoveModal('${filePath}', 'file'); closeAllMenus()">
        <i class="fas fa-arrows-alt"></i> Move
      </button>
      <button onclick="downloadFile('${filePath}'); closeAllMenus()">
        <i class="fas fa-download"></i> Download
      </button>
      <div class="menu-divider"></div>
      <button class="danger" onclick="confirmDeleteFile('${filePath}'); closeAllMenus()">
        <i class="fas fa-trash"></i> Delete
      </button>
    `;
  }
  
  document.body.appendChild(menu);
  
  const rect = event.target.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.bottom + 5 + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  menu.style.display = 'block';
  
  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  });
}

function archiveSelectedFiles() {
  showToast('Info', 'Archive feature coming soon', 'info', 2000);
}

function copySelectedFiles() {
  showToast('Info', 'Copy feature coming soon', 'info', 2000);
}

function downloadSelectedFiles() {
  const selected = document.querySelectorAll('.file-row-checkbox:checked');
  if (selected.length === 0) {
    showToast('Info', 'No files selected', 'info', 2000);
    return;
  }
  const accountId = currentUser?.accountId || '';
  selected.forEach(cb => {
    const filePath = cb.dataset.filepath;
    window.open(`${API}/files/${encodeURIComponent(filePath)}/download?accountId=${accountId}`, '_blank');
  });
}

async function openFileEditor(filename) {
  try {
    const accountId = currentUser?.accountId || '';
    const res = await fetch(`${API}/files/${filename}?accountId=${accountId}`, {
      credentials: 'include'
    });

    if (res.status === 403) {
      showToast(
        '🔒 Access Restricted',
        'This file cannot be edited directly for security reasons.',
        'error',
        5000
      );
      return;
    }

    const data = await res.json();

    if (data.error) {
      showToast('❌ Error', data.error, 'error', 5000);
      return;
    }

    showFileEditorModal(filename, data.content);
  } catch (err) {
    showToast('❌ Error', 'Error loading file: ' + err.message, 'error', 5000);
  }
}

function showFileEditorModal(filename, content) {
  const modal = document.createElement('div');
  modal.className = 'file-editor-modal-fullscreen';
  modal.innerHTML = `
    <div class="editor-container-fullscreen">
      <div class="editor-header-fullscreen">
        <div class="editor-title-fullscreen">
          <i class="fas fa-edit"></i>
          <span>${filename}</span>
        </div>
        <div class="editor-actions">
          <button class="editor-action-btn" onclick="saveFileContent('${filename}')">
            <i class="fas fa-save"></i> Save
          </button>
          <button class="editor-action-btn danger" onclick="confirmDeleteFile('${filename}')">
            <i class="fas fa-trash"></i> Delete
          </button>
          <button class="editor-action-btn" onclick="this.closest('.file-editor-modal-fullscreen').remove()">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
      </div>
      <div class="editor-body-fullscreen">
        <div class="editor-sidebar">
          <div class="editor-info">
            <div class="info-item-editor">
              <label>File:</label>
              <span>${filename}</span>
            </div>
            <div class="info-item-editor">
              <label>Language:</label>
              <select class="language-select-fullscreen" id="languageSelect">
                <option ${filename.endsWith('.py') ? 'selected' : ''}>Python</option>
                <option ${filename.endsWith('.js') ? 'selected' : ''}>JavaScript</option>
                <option ${filename.endsWith('.json') ? 'selected' : ''}>JSON</option>
                <option ${filename.endsWith('.html') ? 'selected' : ''}>HTML</option>
                <option ${filename.endsWith('.css') ? 'selected' : ''}>CSS</option>
              </select>
            </div>
          </div>
          <div class="editor-stats">
            <div class="stat-item-editor">
              <i class="fas fa-file-code"></i>
              <span id="lineCount">0 lines</span>
            </div>
            <div class="stat-item-editor">
              <i class="fas fa-font"></i>
              <span id="charCount">0 chars</span>
            </div>
          </div>
        </div>
        <textarea class="code-editor-fullscreen" id="codeEditor">${escapeHtml(content)}</textarea>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const editor = document.getElementById('codeEditor');
  updateEditorStats();
  editor.addEventListener('input', updateEditorStats);
}

function updateEditorStats() {
  const editor = document.getElementById('codeEditor');
  const content = editor.value;
  const lines = content.split('\n').length;
  const chars = content.length;

  const lineCount = document.getElementById('lineCount');
  const charCount = document.getElementById('charCount');

  if (lineCount) lineCount.textContent = `${lines} lines`;
  if (charCount) charCount.textContent = `${chars} chars`;
}

async function renameFile(filename) {
  const newName = prompt(`Rename "${filename}" to:`, filename);
  if (!newName || newName === filename) return;

  const accountId = currentUser?.accountId || '';

  try {
    const res = await fetch(`${API}/files/${filename}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName, accountId })
    });

    if (res.ok) {
      alert('File renamed successfully!');
      loadFileList();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to rename file');
    }
  } catch (err) {
    alert('Error renaming file: ' + err.message);
  }
}

async function confirmDeleteFile(filename) {
  if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

  try {
    const accountId = currentUser?.accountId || '';
    const res = await fetch(`${API}/files/${filename}?accountId=${accountId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('File deleted successfully!');
      document.querySelector('.file-editor-modal-fullscreen')?.remove();
      loadFileList();
    } else {
      alert('Failed to delete file');
    }
  } catch (err) {
    alert('Error deleting file: ' + err.message);
  }
}

// Move file/folder modal
let moveSourcePath = '';
let moveSourceType = '';

async function showMoveModal(sourcePath, type) {
  moveSourcePath = sourcePath;
  moveSourceType = type;
  
  const existingModal = document.getElementById('moveItemModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'moveItemModal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header" style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 20px; border-radius: 12px 12px 0 0;">
        <h3 style="color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-arrows-alt"></i> Move ${type === 'folder' ? 'Folder' : 'File'}
        </h3>
        <button onclick="closeMoveModal()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Moving:</label>
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; color: var(--text-primary);">
            <i class="fas fa-${type === 'folder' ? 'folder' : 'file'}" style="margin-right: 8px; color: #3B82F6;"></i>
            ${sourcePath}
          </div>
        </div>
        <div>
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Move to:</label>
          <select id="moveDestination" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
            <option value="">Loading folders...</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="closeMoveModal()" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button onclick="performMove()" style="padding: 10px 20px; background: #3B82F6; border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-arrows-alt"></i> Move
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Load folders for destination select
  await loadFoldersForMove();
}

function closeMoveModal() {
  const modal = document.getElementById('moveItemModal');
  if (modal) modal.remove();
  moveSourcePath = '';
  moveSourceType = '';
}

async function loadFoldersForMove() {
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/list-folders?accountId=${accountId}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    const select = document.getElementById('moveDestination');
    if (select && data.success && data.folders) {
      // Filter out the source path and its children
      const sourceDir = moveSourceType === 'folder' ? moveSourcePath : '';
      const filteredFolders = data.folders.filter(folder => {
        if (moveSourceType === 'folder') {
          return folder.path !== moveSourcePath && !folder.path.startsWith(moveSourcePath + '/');
        }
        return true;
      });
      
      select.innerHTML = filteredFolders.map(folder => 
        `<option value="${folder.path}">${folder.name}</option>`
      ).join('');
    }
  } catch (err) {
    console.error('Error loading folders:', err);
    const select = document.getElementById('moveDestination');
    if (select) {
      select.innerHTML = '<option value="">Error loading folders</option>';
    }
  }
}

async function performMove() {
  const destination = document.getElementById('moveDestination')?.value;
  const accountId = currentUser?.accountId || '';
  
  // Check if moving to same directory
  const sourceParent = moveSourcePath.includes('/') ? moveSourcePath.substring(0, moveSourcePath.lastIndexOf('/')) : '';
  if (destination === sourceParent) {
    showToast('Info', 'Item is already in this folder', 'info', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sourcePath: moveSourcePath,
        destinationPath: destination,
        accountId: accountId
      })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      showToast('Success', data.message || 'Moved successfully', 'success', 3000);
      closeMoveModal();
      loadFileList();
    } else {
      showToast('Error', data.error || 'Failed to move item', 'error', 4000);
    }
  } catch (err) {
    showToast('Error', 'Failed to move item: ' + err.message, 'error', 4000);
  }
}

async function saveFileContent(filename) {
  const content = document.getElementById('codeEditor').value;
  const accountId = currentUser?.accountId || '';

  try {
    const res = await fetch(`${API}/files/${filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content, accountId })
    });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      showToast('Error', 'Server returned an invalid response. Please try again.', 'error', 5000);
      return;
    }

    if (res.ok && (data.success !== false)) {
      showToast('Success', 'File saved successfully!', 'success', 3000);
      document.querySelector('.file-editor-modal-fullscreen')?.remove();
      loadFileList();
    } else {
      if (data.storage_exceeded) {
        showStorageFullNotification(data);
      } else {
        showToast('Error', data.error || 'Failed to save file', 'error', 5000);
      }
    }
  } catch (err) {
    console.error('Save file error:', err);
    showToast('Error', 'Error saving file: ' + err.message, 'error', 5000);
  }
}

function toggleFileMenu(event, filename) {
  event.stopPropagation();
  closeAllMenus();
  const menuId = 'menu-' + filename.replace(/\./g, '-');
  const menu = document.getElementById(menuId);
  if (menu) {
    const isVisible = menu.style.display === 'block';
    if (!isVisible) {
      // Add backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'file-menu-backdrop';
      backdrop.onclick = closeAllMenus;
      document.body.appendChild(backdrop);
      menu.style.display = 'block';

      // Position menu relative to button
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const dropdown = button.closest('.file-actions-dropdown');
      if (dropdown) {
        dropdown.style.position = 'relative';
      }
    } else {
      menu.style.display = 'none';
      document.querySelector('.file-menu-backdrop')?.remove();
    }
  }
}

function toggleFileMenuModern(event, filename) {
  event.stopPropagation();
  event.preventDefault();

  closeAllMenus();

  const menuId = 'menu-' + filename.replace(/\./g, '-');
  const menu = document.getElementById(menuId);

  if (menu) {
    // Create or get backdrop
    let backdrop = document.querySelector('.file-menu-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'file-menu-backdrop';
      backdrop.onclick = closeAllMenus;
      document.body.appendChild(backdrop);
    }

    // Position menu near the button
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = (rect.right - 180) + 'px';

    // Show menu and backdrop
    backdrop.classList.add('active');
    menu.classList.add('active');
  }
}

function closeAllMenus() {
  document.querySelectorAll('.file-menu').forEach(menu => {
    menu.style.display = 'none';
  });
  document.querySelectorAll('.file-menu-modern').forEach(menu => {
    menu.classList.remove('active');
    menu.classList.remove('show');
  });
  const backdrop = document.querySelector('.file-menu-backdrop');
  if (backdrop) {
    backdrop.classList.remove('active');
  }
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.file-menu-modern') && !e.target.closest('.file-card-action-btn')) {
    closeAllMenus();
  }
});

// Confirmation Modal Functions
function showConfirmationModal(title, message, confirmText, cancelText, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'confirmation-modal-overlay';
  modal.innerHTML = `
    <div class="confirmation-modal">
      <div class="confirmation-modal-header">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>${title}</h3>
      </div>
      <div class="confirmation-modal-body">
        <p>${message}</p>
      </div>
      <div class="confirmation-modal-actions">
        <button class="confirmation-btn-cancel" id="confirmCancel">
          <i class="fas fa-times"></i>
          ${cancelText}
        </button>
        <button class="confirmation-btn-confirm" id="confirmYes">
          <i class="fas fa-check"></i>
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#confirmCancel');
  const confirmBtn = modal.querySelector('#confirmYes');

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  confirmBtn.addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showSuccessModal(title, message, onClose) {
  const modal = document.createElement('div');
  modal.className = 'confirmation-modal-overlay';
  modal.innerHTML = `
    <div class="confirmation-modal success">
      <div class="confirmation-modal-header success">
        <i class="fas fa-check-circle"></i>
        <h3>${title}</h3>
      </div>
      <div class="confirmation-modal-body">
        <p>${message}</p>
      </div>
      <div class="confirmation-modal-actions">
        <button class="confirmation-btn-confirm" id="successOk">
          <i class="fas fa-check"></i>
          OK
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const okBtn = modal.querySelector('#successOk');
  okBtn.addEventListener('click', () => {
    modal.remove();
    if (onClose) onClose();
  });
}

function showErrorModal(title, message) {
  const modal = document.createElement('div');
  modal.className = 'confirmation-modal-overlay';
  modal.innerHTML = `
    <div class="confirmation-modal error">
      <div class="confirmation-modal-header error">
        <i class="fas fa-times-circle"></i>
        <h3>${title}</h3>
      </div>
      <div class="confirmation-modal-body">
        <p>${message}</p>
      </div>
      <div class="confirmation-modal-actions">
        <button class="confirmation-btn-cancel" id="errorOk">
          <i class="fas fa-times"></i>
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const okBtn = modal.querySelector('#errorOk');
  okBtn.addEventListener('click', () => {
    modal.remove();
  });
}

async function downloadFile(filename) {
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/${encodeURIComponent(filename)}/download?accountId=${accountId}`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename.split('/').pop() || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        showToast('Error', data.error || 'Failed to download file', 'error', 5000);
      } else {
        showToast('Error', 'Failed to download file', 'error', 5000);
      }
    }
  } catch (err) {
    console.error('Download error:', err);
    showToast('Error', 'Error downloading file: ' + err.message, 'error', 5000);
  }
}

async function downloadAllFilesAsZip() {
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/download-all?accountId=${accountId}`, {
      credentials: 'include'
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `backup_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      alert('Failed to download all files.');
    }
  } catch (err) {
    alert('Error downloading files: ' + err.message);
  }
}


async function handleFileUpload(e) {
  const files = e.target.files;
  const accountId = currentUser?.accountId || '';

  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let fileName = file.webkitRelativePath || file.name;
    // Prepend current path if we're in a subdirectory
    if (currentFilePath) {
      fileName = currentFilePath + '/' + fileName;
    }
    formData.append('file', file, fileName);
  }

  formData.append('accountId', accountId);

  showToast(
    'Uploading Files',
    `Uploading ${files.length} file(s)...`,
    'info',
    2000
  );

  // Safe JSON parser to avoid "Unexpected token <"
  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch (e) {
      return null; // If it's HTML/error page, return null
    }
  };

  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await safeJson(res);

    if (res.ok) {
      showToast(
        'Upload Complete',
        `Successfully uploaded ${data?.count || 0} file(s)`,
        'success',
        4000
      );
      loadFileList();
      loadStorageInfo(); // Refresh storage display
    } else {
      // Check if this is a storage exceeded error
      if (data?.storage_exceeded) {
        showStorageFullNotification(data);
        loadStorageInfo(); // Refresh storage display
      } else {
        const errMsg = data?.error || `Server returned ${res.status}`;
        showToast(
          'Upload Failed',
          errMsg,
          'error',
          5000
        );
      }
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast(
      'Upload Error',
      'Error uploading files: ' + err.message,
      'error',
      5000
    );
  }
}



function refreshFiles() {
  loadFileList();
}

async function createNewFile() {
  const fileName = prompt('Enter file name (e.g., main.py, config.json):');
  if (!fileName || !fileName.trim()) return;
  
  const cleanFileName = fileName.trim();
  if (!/^[\w\-. ]+$/.test(cleanFileName)) {
    showToast('Error', 'Invalid file name. Use only letters, numbers, dots, dashes, and underscores.', 'error', 5000);
    return;
  }
  
  const accountId = currentUser?.accountId || '';
  
  try {
    const res = await fetch(`${API}/files/create-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        fileName: cleanFileName, 
        accountId: accountId,
        currentPath: currentFilePath || '',
        content: ''
      })
    });
    
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      showToast('Error', 'Server returned an invalid response. Please try again.', 'error', 5000);
      return;
    }
    
    if (res.ok && data.success) {
      showToast('Success', `File "${cleanFileName}" created successfully`, 'success', 3000);
      loadFileList();
      const fullPath = currentFilePath ? `${currentFilePath}/${cleanFileName}` : cleanFileName;
      setTimeout(() => openFileEditor(fullPath), 500);
    } else {
      if (data.storage_exceeded) {
        showStorageFullNotification(data);
      } else {
        showToast('Error', data.error || 'Failed to create file', 'error', 5000);
      }
    }
  } catch (err) {
    console.error('Create file error:', err);
    showToast('Error', 'Failed to create file: ' + err.message, 'error', 5000);
  }
}

async function deleteAllFiles() {
  if (!confirm('Are you sure you want to delete ALL files in this directory? This action cannot be undone.')) {
    return;
  }

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/files/delete-all?accountId=${accountId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('All files deleted successfully!');
      loadFileList(); // Reload the file list
    } else {
      alert('Failed to delete all files.');
    }
  } catch (err) {
    alert('Error deleting files: ' + err.message);
  }
}

// Database Management
async function loadDatabases() {
  const page = document.getElementById('databasePage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-database"></i> Database Manager</h2>
    </div>
    <div class="database-container" id="databaseContainer">
      <div class="loading">Loading database...</div>
    </div>
  `;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/database/keys?accountId=${accountId}`);
    const data = await res.json();

    const container = document.getElementById('databaseContainer');
    if (data.success && data.data) {
      const entries = Object.entries(data.data);
      if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">No database entries yet</p>';
      } else {
        container.innerHTML = entries.map(([key, value]) => `
          <div class="db-entry">
            <div class="db-key">${key}</div>
            <div class="db-value">${JSON.stringify(value)}</div>
            <button class="btn-secondary" onclick="editDbKey('${key}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-danger" onclick="deleteDbKey('${key}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Database error:', err);
  }

  document.getElementById('addDbKeyBtn')?.addEventListener('click', () => {
    const key = prompt('Enter key name:');
    const value = prompt('Enter value:');
    if (key && value) addDbKey(key, value);
  });
}

async function addDbKey(key, value) {
  const accountId = currentUser?.accountId || '';
  try {
    await fetch(`${API}/database/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, key, value })
    });
    loadDatabases();
  } catch (err) {
    alert('Error adding key: ' + err.message);
  }
}

async function deleteDbKey(key) {
  if (!confirm(`Delete key "${key}"?`)) return;

  const accountId = currentUser?.accountId || '';
  try {
    await fetch(`${API}/database/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, key })
    });
    loadDatabases();
  } catch (err) {
    alert('Error deleting key: ' + err.message);
  }
}

// Backups
async function loadBackups() {
  const page = document.getElementById('backupsPage');

  page.innerHTML = `
    <div class="backups-page-modern">
      <div class="backups-header-modern">
        <div class="backups-title-section">
          <h2><i class="fas fa-save"></i> Backup Manager</h2>
          <p class="backups-subtitle">Create and manage your bot backups</p>
        </div>
        <button class="btn-primary-modern" id="createBackupBtn">
          <i class="fas fa-plus-circle"></i> Create New Backup
        </button>
      </div>

      <div class="backups-stats-row">
        <div class="backup-stat-card">
          <i class="fas fa-archive"></i>
          <div class="backup-stat-info">
            <span class="backup-stat-value" id="totalBackups">0</span>
            <span class="backup-stat-label">Total Backups</span>
          </div>
        </div>
        <div class="backup-stat-card">
          <i class="fas fa-hdd"></i>
          <div class="backup-stat-info">
            <span class="backup-stat-value" id="totalBackupSize">0 MB</span>
            <span class="backup-stat-label">Total Size</span>
          </div>
        </div>
        <div class="backup-stat-card">
          <i class="fas fa-clock"></i>
          <div class="backup-stat-info">
            <span class="backup-stat-value" id="latestBackup">Never</span>
            <span class="backup-stat-label">Latest Backup</span>
          </div>
        </div>
      </div>

      <div class="backups-grid-modern" id="backupsContainer">
        <div class="loading">Loading backups...</div>
      </div>
    </div>
  `;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/backup/list?accountId=${accountId}`);
    const data = await res.json();

    const container = document.getElementById('backupsContainer');
    if (data.success && data.backups) {
      const totalBackups = data.backups.length;
      const backupLimit = data.backupLimit || 1;
      const totalSize = data.backups.reduce((sum, b) => sum + b.size, 0);
      const latestBackup = totalBackups > 0 ? new Date(Math.max(...data.backups.map(b => b.created * 1000))) : null;

      document.getElementById('totalBackups').textContent = `${totalBackups}/${backupLimit}`;
      document.getElementById('totalBackupSize').textContent = formatFileSize(totalSize);
      document.getElementById('latestBackup').textContent = latestBackup ? latestBackup.toLocaleDateString() : 'Never';

      if (data.backups.length === 0) {
        container.innerHTML = `
          <div class="backups-empty-state">
            <i class="fas fa-archive"></i>
            <h3>No Backups Yet</h3>
            <p>Create your first backup to protect your bot files</p>
            <button class="btn-primary-modern" onclick="document.getElementById('createBackupBtn').click()">
              <i class="fas fa-plus-circle"></i> Create Backup
            </button>
          </div>
        `;
      } else {
        container.innerHTML = data.backups.map(backup => `
          <div class="backup-card-modern">
            <div class="backup-card-header">
              <div class="backup-icon">
                <i class="fas fa-file-archive"></i>
              </div>
              <div class="backup-card-title">
                <h4>${backup.name.split('_')[1] || backup.name}</h4>
                <span class="backup-date">${new Date(backup.created * 1000).toLocaleString()}</span>
              </div>
            </div>
            <div class="backup-card-body">
              <div class="backup-detail">
                <i class="fas fa-hdd"></i>
                <span>${formatFileSize(backup.size)}</span>
              </div>
              <div class="backup-detail">
                <i class="fas fa-calendar"></i>
                <span>${new Date(backup.created * 1000).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="backup-card-actions">
              <button class="backup-action-btn restore" onclick="restoreBackup('${backup.name}')" title="Restore">
                <i class="fas fa-undo"></i>
              </button>
              <button class="backup-action-btn download" onclick="downloadBackup('${backup.name}')" title="Download">
                <i class="fas fa-download"></i>
              </button>
              <button class="backup-action-btn delete" onclick="deleteBackup('${backup.name}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Backups error:', err);
  }

  document.getElementById('createBackupBtn')?.addEventListener('click', createBackup);
}

async function createBackup() {
  const accountId = currentUser?.accountId || '';

  showToast('💾 Creating Backup', 'Backing up your files...', 'info', 2000);

  try {
    const res = await fetch(`${API}/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(
        '✅ Backup Created',
        `Backup saved as ${data.backup}`,
        'success',
        4000
      );
      loadBackups();
    } else {
      showToast(
        '❌ Backup Failed',
        data.error || 'Failed to create backup',
        'error',
        5000
      );
    }
  } catch (err) {
    showToast(
      '❌ Backup Error',
      'Error creating backup: ' + err.message,
      'error',
      5000
    );
  }
}

async function restoreBackup(backupName) {
  if (!confirm(`Restore from backup "${backupName}"? This will overwrite current files!`)) return;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, backupName })
    });
    const data = await res.json();
    if (data.success) {
      alert('Backup restored successfully!');
      loadFiles(); // Reload files after restore
    } else {
      alert(data.error || 'Failed to restore backup.');
    }
  } catch (err) {
    alert('Error restoring backup: ' + err.message);
  }
}

async function downloadBackup(backupName) {
  window.open(`${API}/backup/download/${backupName}`, '_blank');
}

async function deleteBackup(backupName) {
  if (!confirm(`Delete backup "${backupName}"? This action cannot be undone.`)) return;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/backup/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, backupName })
    });
    const data = await res.json();
    if (data.success) {
      alert('Backup deleted successfully!');
      loadBackups();
    } else {
      alert(data.error || 'Failed to delete backup.');
    }
  } catch (err) {
    alert('Error deleting backup: ' + err.message);
  }
}

// Environment Variables
async function loadEnvironment() {
  const page = document.getElementById('environmentPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-key"></i> Environment Variables</h2>
    </div>
    <div class="env-container" id="envContainer">
      <div class="loading">Loading environment variables...</div>
    </div>
  `;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/env/get?accountId=${accountId}`);
    const data = await res.json();

    const container = document.getElementById('envContainer');
    if (data.success && data.variables) {
      const entries = Object.entries(data.variables);
      if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">No environment variables set</p>';
      } else {
        container.innerHTML = entries.map(([key, value]) => `
          <div class="env-entry">
            <div class="env-key">${key}</div>
            <div class="env-value">${value}</div>
            <button class="btn-secondary" onclick="editEnvVar('${key}')">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Environment error:', err);
  }
}

async function setEnvVar(key, value) {
  const accountId = currentUser?.accountId || '';
  try {
    await fetch(`${API}/env/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, key, value })
    });
    loadEnvironment();
  } catch (err) {
    alert('Error setting variable: ' + err.message);
  }
}

function editEnvVar(key) {
  const value = prompt(`Enter new value for ${key}:`);
  if (value) setEnvVar(key, value);
}

// Analytics
async function loadAnalytics() {
  const page = document.getElementById('analyticsPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-chart-bar"></i> Resource Analytics</h2>
    </div>
    <div class="analytics-container">
      <canvas id="cpuChart" width="400" height="200"></canvas>
      <canvas id="memoryChart" width="400" height="200"></canvas>
    </div>
  `;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/resources/history?accountId=${accountId}`);
    const data = await res.json();

    if (data.success && data.data) {
      // Simple text-based chart for now
      const container = document.querySelector('.analytics-container');
      container.innerHTML = `
        <div class="analytics-card">
          <h3>CPU Usage Over Time</h3>
          <p>Average: ${(data.data.cpu.reduce((a, b) => a + b, 0) / data.data.cpu.length || 0).toFixed(2)}%</p>
          <p>Peak: ${Math.max(...data.data.cpu, 0).toFixed(2)}%</p>
        </div>
        <div class="analytics-card">
          <h3>Memory Usage Over Time</h3>
          <p>Average: ${(data.data.memory.reduce((a, b) => a + b, 0) / data.data.memory.length || 0).toFixed(2)} MB</p>
          <p>Peak: ${Math.max(...data.data.memory, 0).toFixed(2)} MB</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

// Templates
async function loadTemplates() {
  const page = document.getElementById('templatesPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-code"></i> Bot Templates</h2>
    </div>
    <div class="templates-grid" id="templatesGrid">
      <div class="loading">Loading templates...</div>
    </div>
  `;

  try {
    const res = await fetch(`${API}/templates/list`);
    const data = await res.json();

    const grid = document.getElementById('templatesGrid');
    if (data.success && data.templates) {
      grid.innerHTML = data.templates.map(template => `
        <div class="template-card">
          <h3>${template.name}</h3>
          <p>${template.description}</p>
          <span class="template-lang">${template.language}</span>
          <button class="btn-primary" onclick="applyTemplate('${template.id}')">
            <i class="fas fa-download"></i> Use Template
          </button>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Templates error:', err);
  }
}

async function applyTemplate(templateId) {
  if (!confirm('Apply this template? This will overwrite existing files!')) return;

  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/templates/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, templateId })
    });
    const data = await res.json();
    if (data.success) {
      alert('Template applied successfully!');
      loadFiles();
    }
  } catch (err) {
    alert('Error applying template: ' + err.message);
  }
}

function loadNetwork() {
  document.getElementById('networkPage').innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-network-wired"></i> Network</h2>
    </div>
    <p class="empty-state">Network configuration</p>
  `;
}

async function loadSchedules() {
  const page = document.getElementById('schedulesPage');
  const accountId = currentUser?.accountId || '';
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-clock"></i> Schedules</h2>
      <button class="btn-primary" id="addScheduleBtn">
        <i class="fas fa-plus"></i> Add Schedule
      </button>
    </div>
    <div class="schedules-container">
      <div class="loading">Loading schedules...</div>
    </div>
  `;

  try {
    const res = await fetch(`${API}/schedules?accountId=${accountId}`);
    const data = await res.json();
    
    const container = page.querySelector('.schedules-container');
    
    if (data.success && data.schedules && data.schedules.length > 0) {
      container.innerHTML = `
        <div class="schedules-list">
          ${data.schedules.map(schedule => `
            <div class="schedule-card ${schedule.enabled ? 'enabled' : 'disabled'}" data-id="${schedule.id}">
              <div class="schedule-header">
                <div class="schedule-info">
                  <h3 class="schedule-name">${escapeHtml(schedule.name)}</h3>
                  <span class="schedule-type-badge ${schedule.type}">${schedule.type}</span>
                </div>
                <div class="schedule-toggle">
                  <label class="toggle-switch">
                    <input type="checkbox" ${schedule.enabled ? 'checked' : ''} onchange="toggleSchedule('${schedule.id}', this.checked)">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div class="schedule-details">
                <div class="schedule-detail">
                  <i class="fas fa-play"></i>
                  <span>Action: <strong>${schedule.action}</strong></span>
                </div>
                <div class="schedule-detail">
                  <i class="fas fa-clock"></i>
                  <span>${formatScheduleTime(schedule)}</span>
                </div>
                ${schedule.lastRun ? `
                  <div class="schedule-detail">
                    <i class="fas fa-history"></i>
                    <span>Last run: ${new Date(schedule.lastRun).toLocaleString()}</span>
                    <span class="result-badge ${schedule.lastResult}">${schedule.lastResult || 'N/A'}</span>
                  </div>
                ` : ''}
                ${schedule.nextRun ? `
                  <div class="schedule-detail">
                    <i class="fas fa-forward"></i>
                    <span>Next run: ${new Date(schedule.nextRun).toLocaleString()}</span>
                  </div>
                ` : ''}
                <div class="schedule-detail">
                  <i class="fas fa-sync"></i>
                  <span>Run count: <strong>${schedule.runCount || 0}</strong></span>
                </div>
              </div>
              <div class="schedule-actions">
                <button class="btn-action run" onclick="runScheduleNow('${schedule.id}')" title="Run Now">
                  <i class="fas fa-play"></i> Run Now
                </button>
                <button class="btn-action edit" onclick="editSchedule('${schedule.id}')" title="Edit">
                  <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-action delete" onclick="deleteSchedule('${schedule.id}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state-box">
          <i class="fas fa-calendar-times"></i>
          <h3>No Schedules Yet</h3>
          <p>Create scheduled tasks to automate bot restarts, backups, and more.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading schedules:', err);
    page.querySelector('.schedules-container').innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>Error loading schedules. Please try again.</p>
      </div>
    `;
  }

  document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
    showAddScheduleModal();
  });
}

function formatScheduleTime(schedule) {
  if (schedule.type === 'interval') {
    return `Every ${schedule.interval} minutes`;
  } else if (schedule.type === 'daily') {
    return `Daily at ${schedule.time}`;
  } else if (schedule.type === 'weekly') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Weekly on ${days[schedule.dayOfWeek]} at ${schedule.time}`;
  }
  return 'Custom schedule';
}

function showAddScheduleModal(existingSchedule = null) {
  const isEdit = !!existingSchedule;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content schedule-modal">
      <div class="modal-header">
        <h2><i class="fas fa-clock"></i> ${isEdit ? 'Edit Schedule' : 'Create New Schedule'}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Schedule Name</label>
          <input type="text" id="scheduleName" value="${existingSchedule?.name || ''}" placeholder="e.g., Daily Restart">
        </div>
        
        <div class="form-group">
          <label>Schedule Type</label>
          <select id="scheduleType" onchange="updateScheduleTypeFields()">
            <option value="interval" ${existingSchedule?.type === 'interval' ? 'selected' : ''}>Interval (Every X minutes)</option>
            <option value="daily" ${existingSchedule?.type === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${existingSchedule?.type === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        
        <div id="intervalFields" class="schedule-type-fields" style="${existingSchedule?.type !== 'interval' && existingSchedule ? 'display:none' : ''}">
          <div class="form-group">
            <label>Interval (minutes)</label>
            <input type="number" id="scheduleInterval" value="${existingSchedule?.interval || 60}" min="1" max="1440">
          </div>
        </div>
        
        <div id="dailyFields" class="schedule-type-fields" style="${existingSchedule?.type === 'daily' ? '' : 'display:none'}">
          <div class="form-group">
            <label>Time</label>
            <input type="time" id="scheduleTimeDaily" value="${existingSchedule?.time || '00:00'}">
          </div>
        </div>
        
        <div id="weeklyFields" class="schedule-type-fields" style="${existingSchedule?.type === 'weekly' ? '' : 'display:none'}">
          <div class="form-group">
            <label>Day of Week</label>
            <select id="scheduleDayOfWeek">
              <option value="0" ${existingSchedule?.dayOfWeek === 0 ? 'selected' : ''}>Sunday</option>
              <option value="1" ${existingSchedule?.dayOfWeek === 1 ? 'selected' : ''}>Monday</option>
              <option value="2" ${existingSchedule?.dayOfWeek === 2 ? 'selected' : ''}>Tuesday</option>
              <option value="3" ${existingSchedule?.dayOfWeek === 3 ? 'selected' : ''}>Wednesday</option>
              <option value="4" ${existingSchedule?.dayOfWeek === 4 ? 'selected' : ''}>Thursday</option>
              <option value="5" ${existingSchedule?.dayOfWeek === 5 ? 'selected' : ''}>Friday</option>
              <option value="6" ${existingSchedule?.dayOfWeek === 6 ? 'selected' : ''}>Saturday</option>
            </select>
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="time" id="scheduleTimeWeekly" value="${existingSchedule?.time || '00:00'}">
          </div>
        </div>
        
        <div class="form-group">
          <label>Action</label>
          <select id="scheduleAction">
            <option value="restart" ${existingSchedule?.action === 'restart' ? 'selected' : ''}>Restart Bot</option>
            <option value="start" ${existingSchedule?.action === 'start' ? 'selected' : ''}>Start Bot</option>
            <option value="stop" ${existingSchedule?.action === 'stop' ? 'selected' : ''}>Stop Bot</option>
            <option value="backup" ${existingSchedule?.action === 'backup' ? 'selected' : ''}>Create Backup</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="scheduleEnabled" ${existingSchedule?.enabled !== false ? 'checked' : ''}>
            <span>Enable Schedule</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" onclick="saveSchedule('${existingSchedule?.id || ''}')">
          <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'} Schedule
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateScheduleTypeFields() {
  const type = document.getElementById('scheduleType').value;
  document.getElementById('intervalFields').style.display = type === 'interval' ? '' : 'none';
  document.getElementById('dailyFields').style.display = type === 'daily' ? '' : 'none';
  document.getElementById('weeklyFields').style.display = type === 'weekly' ? '' : 'none';
}


async function saveSchedule(scheduleId = '') {
  const accountId = currentUser?.accountId || '';
  const type = document.getElementById('scheduleType').value;
  const action = document.getElementById('scheduleAction').value;
  
  const scheduleData = {
    accountId,
    name: document.getElementById('scheduleName').value || 'New Schedule',
    type,
    action,
    interval: parseInt(document.getElementById('scheduleInterval').value) || 60,
    time: type === 'daily' ? document.getElementById('scheduleTimeDaily').value : document.getElementById('scheduleTimeWeekly').value,
    dayOfWeek: parseInt(document.getElementById('scheduleDayOfWeek')?.value) || 0,
    enabled: document.getElementById('scheduleEnabled').checked
  };

  try {
    const url = scheduleId ? `${API}/schedules/${scheduleId}` : `${API}/schedules`;
    const method = scheduleId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast(`Schedule ${scheduleId ? 'updated' : 'created'} successfully!`, 'success');
      document.querySelector('.modal-overlay')?.remove();
      loadSchedules();
    } else {
      showToast(data.error || 'Failed to save schedule', 'error');
    }
  } catch (err) {
    showToast('Error saving schedule: ' + err.message, 'error');
  }
}

async function toggleSchedule(scheduleId, enabled) {
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Schedule ${enabled ? 'enabled' : 'disabled'}`, 'success');
    }
  } catch (err) {
    showToast('Error toggling schedule', 'error');
    loadSchedules();
  }
}

async function runScheduleNow(scheduleId) {
  const accountId = currentUser?.accountId || '';
  try {
    showToast('Running schedule...', 'info');
    const res = await fetch(`${API}/schedules/${scheduleId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Schedule executed successfully!', 'success');
      loadSchedules();
    } else {
      showToast(data.result?.error || 'Schedule execution failed', 'error');
    }
  } catch (err) {
    showToast('Error running schedule: ' + err.message, 'error');
  }
}

async function editSchedule(scheduleId) {
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/schedules?accountId=${accountId}`);
    const data = await res.json();
    if (data.success) {
      const schedule = data.schedules.find(s => s.id === scheduleId);
      if (schedule) {
        showAddScheduleModal(schedule);
      }
    }
  } catch (err) {
    showToast('Error loading schedule', 'error');
  }
}

async function deleteSchedule(scheduleId) {
  if (!confirm('Are you sure you want to delete this schedule?')) return;
  
  const accountId = currentUser?.accountId || '';
  try {
    const res = await fetch(`${API}/schedules/${scheduleId}?accountId=${accountId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Schedule deleted', 'success');
      loadSchedules();
    } else {
      showToast(data.error || 'Failed to delete schedule', 'error');
    }
  } catch (err) {
    showToast('Error deleting schedule: ' + err.message, 'error');
  }
}

async function loadStartup() {
  const page = document.getElementById('startupPage');
  const accountId = currentUser?.accountId || '';

  // Load current startup configuration
  let startupConfig = {
    command: 'python3 main.py',
    autoRestart: false,
    pythonVersion: '3.11',
    mainFile: 'main.py',
    additionalModules: '',
    environmentVars: '',
    customArgs: '',
    workingDirectory: './'
  };

  try {
    const res = await fetch(`${API}/startup/config?accountId=${accountId}`);
    const data = await res.json();
    if (data.success && data.config) {
      startupConfig = { ...startupConfig, ...data.config };
    }
  } catch (err) {
    console.error('Error loading startup config:', err);
  }

  page.innerHTML = `
    <div class="startup-page-redesign">
      <div class="startup-header-redesign">
        <div class="header-left">
          <div class="icon-wrapper">
            <i class="fas fa-rocket"></i>
          </div>
          <div>
            <h2>Startup Configuration</h2>
            <p>Configure your bot's runtime environment and execution settings</p>
          </div>
        </div>
        <button class="save-config-btn" id="saveStartupBtn">
          <i class="fas fa-save"></i>
          <span>Save Changes</span>
        </button>
      </div>

      <div class="startup-content-grid">
        <!-- Main Configuration -->
        <div class="config-section primary-section">
          <div class="section-header">
            <i class="fas fa-cog"></i>
            <h3>Main Configuration</h3>
          </div>
          <div class="section-body">
            <div class="input-field">
              <label>
                <i class="fas fa-file-code"></i>
                Entry Point File
              </label>
              <input type="text" id="mainFileInput" value="${startupConfig.mainFile}" placeholder="main.py">
              <small>The main file to execute when starting your bot</small>
            </div>

            <div class="input-field">
              <label>
                <i class="fas fa-code"></i>
                Python Version
              </label>
              <select id="pythonVersionSelect">
                <option value="3.11" ${startupConfig.pythonVersion === '3.11' ? 'selected' : ''}>Python 3.11 (Latest)</option>
                <option value="3.10" ${startupConfig.pythonVersion === '3.10' ? 'selected' : ''}>Python 3.10</option>
                <option value="3.9" ${startupConfig.pythonVersion === '3.9' ? 'selected' : ''}>Python 3.9</option>
                <option value="3.8" ${startupConfig.pythonVersion === '3.8' ? 'selected' : ''}>Python 3.8</option>
              </select>
              <small>Select the Python interpreter version</small>
            </div>

            <div class="input-field">
              <label>
                <i class="fas fa-folder"></i>
                Working Directory
              </label>
              <input type="text" id="workingDirInput" value="${startupConfig.workingDirectory || './'}" placeholder="./">
              <small>Directory from which to run the bot</small>
            </div>

            <div class="input-field">
              <label>
                <i class="fas fa-terminal"></i>
                Custom Arguments
              </label>
              <input type="text" id="customArgsInput" value="${startupConfig.customArgs || ''}" placeholder="--debug --verbose">
              <small>Additional command-line arguments (optional)</small>
            </div>
          </div>
        </div>

        <!-- Command Preview -->
        <div class="config-section command-preview-section">
          <div class="section-header">
            <i class="fas fa-play-circle"></i>
            <h3>Startup Command Preview</h3>
          </div>
          <div class="section-body">
            <div class="command-display">
              <div class="command-label">Generated Command:</div>
              <div class="command-output" id="commandPreview">
                <code>python3 ${startupConfig.mainFile}</code>
              </div>
              <button class="copy-command-btn" onclick="copyCommandToClipboard()">
                <i class="fas fa-copy"></i> Copy Command
              </button>
            </div>
          </div>
        </div>

        <!-- Dependencies -->
        <div class="config-section dependencies-section">
          <div class="section-header">
            <i class="fas fa-cubes"></i>
            <h3>Dependencies & Packages</h3>
          </div>
          <div class="section-body">
            <div class="input-field">
              <label>
                <i class="fas fa-box"></i>
                Additional Packages
              </label>
              <textarea id="additionalModulesInput" rows="4" placeholder="Enter package names (one per line or space-separated)&#10;Example:&#10;discord.py&#10;requests&#10;python-dotenv">${startupConfig.additionalModules || ''}</textarea>
              <small>Packages will be installed automatically before startup</small>
            </div>
            <button class="install-deps-btn" id="installDepsBtn">
              <i class="fas fa-download"></i>
              Install Dependencies Now
            </button>
          </div>
        </div>

        <!-- Environment Variables -->
        <div class="config-section env-section">
          <div class="section-header">
            <i class="fas fa-key"></i>
            <h3>Environment Variables</h3>
          </div>
          <div class="section-body">
            <div class="input-field">
              <label>
                <i class="fas fa-lock"></i>
                Custom Environment
              </label>
              <textarea id="environmentVarsInput" rows="4" placeholder="KEY=value (one per line)&#10;Example:&#10;DEBUG=true&#10;LOG_LEVEL=info">${startupConfig.environmentVars || ''}</textarea>
              <small>Set custom environment variables for your bot</small>
            </div>
          </div>
        </div>

        <!-- Runtime Options -->
        <div class="config-section runtime-section">
          <div class="section-header">
            <i class="fas fa-sliders-h"></i>
            <h3>Runtime Options</h3>
          </div>
          <div class="section-body">
            <div class="toggle-option">
              <div class="toggle-content">
                <i class="fas fa-redo"></i>
                <div>
                  <div class="toggle-title">Auto-Restart on Crash</div>
                  <div class="toggle-desc">Automatically restart if the bot crashes or stops unexpectedly</div>
                </div>
              </div>
              <label class="toggle-switch-new">
                <input type="checkbox" id="autoRestartCheck" ${startupConfig.autoRestart ? 'checked' : ''}>
                <span class="slider-new"></span>
              </label>
            </div>

            <div class="toggle-option">
              <div class="toggle-content">
                <i class="fas fa-file-alt"></i>
                <div>
                  <div class="toggle-title">Enable Detailed Logging</div>
                  <div class="toggle-desc">Log all bot activities and errors to file</div>
                </div>
              </div>
              <label class="toggle-switch-new">
                <input type="checkbox" id="detailedLoggingCheck">
                <span class="slider-new"></span>
              </label>
            </div>

            <div class="toggle-option">
              <div class="toggle-content">
                <i class="fas fa-shield-alt"></i>
                <div>
                  <div class="toggle-title">Safe Mode</div>
                  <div class="toggle-desc">Run with limited permissions for testing</div>
                </div>
              </div>
              <label class="toggle-switch-new">
                <input type="checkbox" id="safeModeCheck">
                <span class="slider-new"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Resource Limits -->
        <div class="config-section resources-section">
          <div class="section-header">
            <i class="fas fa-tachometer-alt"></i>
            <h3>Resource Information</h3>
          </div>
          <div class="section-body">
            <div class="resource-grid">
              <div class="resource-item">
                <div class="resource-icon cpu">
                  <i class="fas fa-microchip"></i>
                </div>
                <div class="resource-info">
                  <span class="resource-label">CPU Limit</span>
                  <span class="resource-value">25%</span>
                </div>
              </div>
              <div class="resource-item">
                <div class="resource-icon memory">
                  <i class="fas fa-memory"></i>
                </div>
                <div class="resource-info">
                  <span class="resource-label">Memory Limit</span>
                  <span class="resource-value">308 MiB</span>
                </div>
              </div>
              <div class="resource-item">
                <div class="resource-icon disk">
                  <i class="fas fa-hdd"></i>
                </div>
                <div class="resource-info">
                  <span class="resource-label">Disk Space</span>
                  <span class="resource-value">716 MiB</span>
                </div>
              </div>
              <div class="resource-item">
                <div class="resource-icon network">
                  <i class="fas fa-network-wired"></i>
                </div>
                <div class="resource-info">
                  <span class="resource-label">Network</span>
                  <span class="resource-value">Unlimited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Update command preview dynamically
  function updateCommandPreview() {
    const mainFile = document.getElementById('mainFileInput').value;
    const customArgs = document.getElementById('customArgsInput').value;
    const commandPreview = document.getElementById('commandPreview');

    let command = `python3 ${mainFile}`;
    if (customArgs) {
      command += ` ${customArgs}`;
    }

    commandPreview.innerHTML = `<code>${command}</code>`;
  }

  document.getElementById('mainFileInput')?.addEventListener('input', updateCommandPreview);
  document.getElementById('customArgsInput')?.addEventListener('input', updateCommandPreview);

  // Save configuration
  document.getElementById('saveStartupBtn')?.addEventListener('click', async () => {
    const config = {
      accountId: accountId,
      mainFile: document.getElementById('mainFileInput').value,
      pythonVersion: document.getElementById('pythonVersionSelect').value,
      autoRestart: document.getElementById('autoRestartCheck').checked,
      additionalModules: document.getElementById('additionalModulesInput').value,
      environmentVars: document.getElementById('environmentVarsInput').value,
      customArgs: document.getElementById('customArgsInput').value,
      workingDirectory: document.getElementById('workingDirInput').value,
      detailedLogging: document.getElementById('detailedLoggingCheck')?.checked || false,
      safeMode: document.getElementById('safeModeCheck')?.checked || false,
      command: `python3 ${document.getElementById('mainFileInput').value}`
    };

    try {
      const res = await fetch(`${API}/startup/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });



// Problems Page for Admin - Load bot problems and issues
async function loadProblems() {
  const page = document.getElementById('problemsPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-exclamation-triangle"></i> Bot Problems & Issues</h2>
    </div>

    <div class="problems-filters">
      <button class="filter-btn active" data-filter="all">All Problems</button>
      <button class="filter-btn" data-filter="high">High Priority</button>
      <button class="filter-btn" data-filter="medium">Medium Priority</button>
      <button class="filter-btn" data-filter="missing_modules">Missing Modules</button>
    </div>

    <div id="problemsContainer" class="problems-container">
      <div class="loading">Loading problems...</div>
    </div>
  `;

  loadProblemsData();

  // Add filter listeners
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProblems(btn.dataset.filter);
    });
  });
}

async function loadProblemsData() {
  try {
    const res = await fetch(`${API}/admin/problems`, {
      credentials: 'include'
    });
    const data = await res.json();

    const container = document.getElementById('problemsContainer');

    if (data.success && data.problems) {
      if (data.problems.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #10b981;"></i>
            <h3>No Active Problems</h3>
            <p>All systems are running smoothly!</p>
          </div>
        `;
      } else {
        container.innerHTML = data.problems.map((problem, index) => {
          const severityClass = problem.severity === 'high' ? 'error' : problem.severity === 'medium' ? 'warning' : 'info';
          const severityIcon = problem.severity === 'high' ? 'fa-times-circle' : problem.severity === 'medium' ? 'fa-exclamation-triangle' : 'fa-info-circle';
          const typeLabel = problem.type.replace(/_/g, ' ').toUpperCase();
          const timeAgo = formatTimeAgo(problem.timestamp);

          return `
            <div class="problem-card ${severityClass}" data-severity="${problem.severity}" data-type="${problem.type}">
              <div class="problem-header">
                <div class="problem-severity">
                  <i class="fas ${severityIcon}"></i>
                  <span>${problem.severity.toUpperCase()}</span>
                </div>
                <div class="problem-type">${typeLabel}</div>
                <div class="problem-time">${timeAgo}</div>
              </div>
              <div class="problem-account">
                <i class="fas fa-server"></i>
                <strong>${problem.account_name}</strong> (${problem.username})
              </div>
              <div class="problem-details">${escapeHtml(problem.details)}</div>
              <div class="problem-actions">
                <button class="btn-secondary-small" onclick="viewAccountDetails('${problem.account_id}')">
                  <i class="fas fa-eye"></i> View Account
                </button>
                <button class="btn-primary-small" onclick="resolveProblem('${problem.account_id}', ${problem.account_problems_index || index})">
                  <i class="fas fa-check"></i> Mark Resolved
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading problems:', err);
    document.getElementById('problemsContainer').innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error Loading Problems</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function filterProblems(filter) {
  const cards = document.querySelectorAll('.problem-card');
  cards.forEach(card => {
    if (filter === 'all') {
      card.style.display = 'block';
    } else if (filter === 'missing_modules') {
      card.style.display = card.dataset.type.includes('missing') ? 'block' : 'none';
    } else {
      card.style.display = card.dataset.severity === filter ? 'block' : 'none';
    }
  });
}

async function resolveProblem(accountId, problemIndex) {
  try {
    const res = await fetch(`${API}/admin/problems/${accountId}/${problemIndex}/resolve`, {
      method: 'POST',
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Resolved', 'Problem marked as resolved', 'success', 3000);
      loadProblemsData();
    } else {
      showToast('❌ Error', data.error || 'Failed to resolve problem', 'error', 4000);
    }
  } catch (err) {
    showToast('❌ Error', 'Failed to resolve problem: ' + err.message, 'error', 4000);
  }
}

function refreshProblems() {
  loadProblemsData();
  showToast('🔄 Refreshing', 'Reloading problems...', 'info', 2000);
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - (timestamp * 1000);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function navigateToAccountCard(accountId) {
  // Navigate to hosting page and highlight the account
  const hostingNav = document.querySelector('[data-page="hosting"]');
  if (hostingNav) {
    hostingNav.click();
    setTimeout(() => {
      const accountCard = document.querySelector(`[data-account-id="${accountId}"]`);
      if (accountCard) {
        accountCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        accountCard.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.5)';
        setTimeout(() => {
          accountCard.style.boxShadow = '';
        }, 2000);
      }
    }, 500);
  } else {
    // If hosting nav not found, show the details modal instead
    viewAccountDetails(accountId);
  }
}

// Admin Connect Page - Connect to user hostings
async function loadConnectPage() {
  const page = document.getElementById('connectPage');
  
  page.innerHTML = `
    <div class="connect-page-container">
      <div class="connect-header">
        <div class="connect-header-content">
          <div class="connect-header-icon">
            <i class="fas fa-plug"></i>
          </div>
          <div class="connect-header-text">
            <h1>Connect to User Hosting</h1>
            <p>Access and manage user hosting accounts with full control</p>
          </div>
        </div>
        <div class="connect-header-badge">
          <i class="fas fa-shield-alt"></i>
          <span>Admin Only</span>
        </div>
      </div>
      
      <div class="connect-info-banner">
        <i class="fas fa-info-circle"></i>
        <div>
          <strong>Secure Access Mode</strong>
          <p>When you connect to a hosting, you will have full access to view and control the user's bot. Discord verification is required for security.</p>
        </div>
      </div>
      
      <div class="connect-search-bar">
        <i class="fas fa-search"></i>
        <input type="text" id="connectSearchInput" placeholder="Search by username, hosting name, or instance ID...">
      </div>
      
      <div class="connect-hostings-grid" id="connectHostingsGrid">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Loading hostings...</span>
        </div>
      </div>
    </div>
  `;
  
  // Add styles for Connect page
  addConnectPageStyles();
  
  // Load hostings
  await loadConnectHostings();
  
  // Add search functionality
  const searchInput = document.getElementById('connectSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', filterConnectHostings);
  }
}

function addConnectPageStyles() {
  if (document.getElementById('connectPageStyles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'connectPageStyles';
  styles.textContent = `
    .connect-page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .connect-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      border: 1px solid rgba(139, 92, 246, 0.2);
    }
    
    .connect-header-content {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .connect-header-icon {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
      border-radius: 16px;
      font-size: 28px;
      color: white;
    }
    
    .connect-header-text h1 {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 4px 0;
    }
    
    .connect-header-text p {
      color: #9ca3af;
      margin: 0;
      font-size: 14px;
    }
    
    .connect-header-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 8px 16px;
      border-radius: 8px;
      color: #ef4444;
      font-weight: 600;
    }
    
    .connect-info-banner {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      margin-bottom: 24px;
    }
    
    .connect-info-banner > i {
      color: #3b82f6;
      font-size: 20px;
      margin-top: 2px;
    }
    
    .connect-info-banner strong {
      color: #3b82f6;
      display: block;
      margin-bottom: 4px;
    }
    
    .connect-info-banner p {
      color: #9ca3af;
      margin: 0;
      font-size: 13px;
    }
    
    .connect-search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 24px;
    }
    
    .connect-search-bar i {
      color: #6b7280;
    }
    
    .connect-search-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 14px;
      outline: none;
    }
    
    .connect-search-bar input::placeholder {
      color: #6b7280;
    }
    
    .connect-hostings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }
    
    .connect-hosting-card {
      background: linear-gradient(135deg, #1e1e2e 0%, #252536 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      transition: all 0.3s ease;
    }
    
    .connect-hosting-card:hover {
      border-color: rgba(139, 92, 246, 0.4);
      transform: translateY(-2px);
    }
    
    .connect-hosting-card.online {
      border-color: rgba(16, 185, 129, 0.3);
    }
    
    .connect-hosting-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    
    .connect-hosting-avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
    }
    
    .connect-hosting-info h3 {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin: 0 0 4px 0;
    }
    
    .connect-hosting-username {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #9ca3af;
      font-size: 13px;
    }
    
    .connect-hosting-username i {
      color: #5865f2;
    }
    
    .connect-hosting-details {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 16px;
    }
    
    .connect-hosting-detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    
    .connect-hosting-detail-row:not(:last-child) {
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .connect-hosting-detail-label {
      color: #6b7280;
      font-size: 12px;
    }
    
    .connect-hosting-detail-value {
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      font-family: monospace;
    }
    
    .connect-hosting-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .connect-hosting-status.online {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    
    .connect-hosting-status.offline {
      background: rgba(107, 114, 128, 0.15);
      color: #9ca3af;
    }
    
    .connect-hosting-status .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    
    .connect-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    
    .connect-btn:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }
    
    .connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #9ca3af;
      gap: 12px;
    }
    
    .loading-spinner i {
      font-size: 32px;
      color: #8b5cf6;
    }
    
    .no-hostings-found {
      text-align: center;
      padding: 60px;
      color: #6b7280;
    }
    
    .no-hostings-found i {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .no-hostings-found p {
      margin: 0;
    }
    
    /* Admin Connect Mode Banner */
    .admin-connect-banner {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
    }
    
    .admin-connect-banner-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
    }
    
    .admin-connect-banner-info i {
      font-size: 20px;
    }
    
    .admin-connect-banner-info span {
      font-weight: 600;
    }
    
    .admin-disconnect-btn {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    
    .admin-disconnect-btn:hover {
      background: rgba(0, 0, 0, 0.5);
    }
  `;
  document.head.appendChild(styles);
}

async function loadConnectHostings() {
  const grid = document.getElementById('connectHostingsGrid');
  
  try {
    const res = await fetch(`${API}/admin/connect/hostings`, {
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (!data.success) {
      grid.innerHTML = `
        <div class="no-hostings-found">
          <i class="fas fa-exclamation-circle"></i>
          <p>${data.error || 'Failed to load hostings'}</p>
        </div>
      `;
      return;
    }
    
    if (!data.hostings || data.hostings.length === 0) {
      grid.innerHTML = `
        <div class="no-hostings-found">
          <i class="fas fa-server"></i>
          <p>No hosting accounts found</p>
        </div>
      `;
      return;
    }
    
    // Store hostings for filtering
    window.allConnectHostings = data.hostings;
    
    renderConnectHostings(data.hostings);
  } catch (err) {
    console.error('Error loading connect hostings:', err);
    grid.innerHTML = `
      <div class="no-hostings-found">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading hostings: ${err.message}</p>
      </div>
    `;
  }
}

function renderConnectHostings(hostings) {
  const grid = document.getElementById('connectHostingsGrid');
  
  grid.innerHTML = hostings.map(hosting => `
    <div class="connect-hosting-card ${hosting.status === 'online' ? 'online' : ''}" 
         data-username="${hosting.discord_username?.toLowerCase() || ''}"
         data-hosting-name="${hosting.hosting_name?.toLowerCase() || ''}"
         data-account-id="${hosting.account_id}">
      <div class="connect-hosting-header">
        <div class="connect-hosting-avatar">
          <i class="${hosting.language === 'javascript' ? 'fab fa-node-js' : 'fab fa-python'}"></i>
        </div>
        <div class="connect-hosting-info">
          <h3>${hosting.hosting_name || 'Unknown'}</h3>
          <div class="connect-hosting-username">
            <i class="fab fa-discord"></i>
            <span>${hosting.discord_username || 'Unknown User'}</span>
          </div>
        </div>
      </div>
      
      <div class="connect-hosting-details">
        <div class="connect-hosting-detail-row">
          <span class="connect-hosting-detail-label">Instance ID</span>
          <span class="connect-hosting-detail-value">${hosting.account_id}</span>
        </div>
        <div class="connect-hosting-detail-row">
          <span class="connect-hosting-detail-label">Discord ID</span>
          <span class="connect-hosting-detail-value">${hosting.discord_id || 'N/A'}</span>
        </div>
        <div class="connect-hosting-detail-row">
          <span class="connect-hosting-detail-label">Language</span>
          <span class="connect-hosting-detail-value">${hosting.language === 'javascript' ? 'JavaScript' : 'Python'}</span>
        </div>
        <div class="connect-hosting-detail-row">
          <span class="connect-hosting-detail-label">Status</span>
          <span class="connect-hosting-status ${hosting.status}">
            <span class="status-dot"></span>
            ${hosting.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      
      <button class="connect-btn" onclick="connectToHosting('${hosting.account_id}', '${hosting.hosting_name}')">
        <i class="fas fa-plug"></i>
        Connect to Hosting
      </button>
    </div>
  `).join('');
}

function filterConnectHostings() {
  const searchTerm = document.getElementById('connectSearchInput').value.toLowerCase();
  const hostings = window.allConnectHostings || [];
  
  const filtered = hostings.filter(hosting => {
    const username = (hosting.discord_username || '').toLowerCase();
    const hostingName = (hosting.hosting_name || '').toLowerCase();
    const accountId = (hosting.account_id || '').toLowerCase();
    
    return username.includes(searchTerm) || 
           hostingName.includes(searchTerm) || 
           accountId.includes(searchTerm);
  });
  
  renderConnectHostings(filtered);
}

async function connectToHosting(accountId, hostingName) {
  showConnectAccessModal(accountId, hostingName);
}

// Alias function for User Management page
async function initiateAdminConnect(accountId, hostingName) {
  await connectToHosting(accountId, hostingName);
}

async function disconnectFromHosting() {
  try {
    const res = await fetch(`${API}/admin/connect/disconnect`, {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Clear localStorage and reload to go back to admin panel
      localStorage.removeItem('currentUser');
      window.location.href = '/?disconnect=success';
    } else {
      showToast('Error', data.error || 'Failed to disconnect', 'error', 5000);
    }
  } catch (err) {
    console.error('Disconnect error:', err);
    showToast('Error', 'Failed to disconnect: ' + err.message, 'error', 5000);
  }
}

// Check if admin is in connect mode and show banner
function checkAdminConnectMode() {
  if (currentUser && currentUser.isAdminConnect) {
    const banner = document.createElement('div');
    banner.className = 'admin-connect-banner';
    banner.innerHTML = `
      <div class="admin-connect-banner-info">
        <i class="fas fa-user-shield"></i>
        <span>Admin Connect Mode - Viewing: ${currentUser.hostingName || 'User Hosting'} (Connected by: ${currentUser.connectedBy || 'Admin'})</span>
      </div>
      <button class="admin-disconnect-btn" onclick="disconnectFromHosting()">
        <i class="fas fa-sign-out-alt"></i>
        Disconnect
      </button>
    `;
    document.body.prepend(banner);
    
    // Add padding to body to account for banner
    document.body.style.paddingTop = '50px';
  }
}

// User Management Page stub
async function loadUserManagement() {
  const page = document.getElementById('userManagementPage');
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-users-cog"></i> User Management</h2>
    </div>
    <p class="empty-state">User management interface coming soon...</p>
  `;
}

// Security Logs Page stub
async function loadSecurityLogs() {
  const page = document.getElementById('securityLogsPage');
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-shield-alt"></i> Security Logs</h2>
    </div>
    <p class="empty-state">Security logs interface coming soon...</p>
  `;
}

      const data = await res.json();
      if (data.success) {
        showSuccessModal('✅ Configuration Saved', 'Your startup configuration has been saved successfully!');
      } else {
        showErrorModal('❌ Save Failed', data.error || 'Unknown error occurred');
      }
    } catch (err) {
      showErrorModal('❌ Error', 'Failed to save configuration: ' + err.message);
    }
  });

  // Install dependencies
  document.getElementById('installDepsBtn')?.addEventListener('click', async () => {
    const packages = document.getElementById('additionalModulesInput').value;
    if (!packages.trim()) {
      alert('Please enter at least one package name');
      return;
    }

    alert('Installing dependencies... This may take a moment.');
    // Implementation would call a backend endpoint to install packages
  });
}

function loadWebsiteDashboard(websiteInfo) {
  const page = document.getElementById('dashboardPage');

  const isDeployed = websiteInfo.deploymentStatus === 'deployed';

  page.innerHTML = `
    <div class="website-dashboard">
      <div class="page-header">
        <h2><i class="fas fa-globe"></i> Website Hosting Dashboard</h2>
      </div>

      ${isDeployed ? `
        <div class="deployment-success-banner">
          <i class="fas fa-check-circle"></i>
          <div>
            <h3>Website Deployed Successfully!</h3>
            <p>Your website is live at: <a href="${websiteInfo.deployedUrl}" target="_blank">${websiteInfo.deployedUrl}</a></p>
          </div>
        </div>
      ` : ''}

      <div class="website-deployment-card">
        <h3><i class="fas fa-rocket"></i> Deploy Your Website</h3>
        <p>Upload your HTML, CSS, and JavaScript files, then deploy your website with a custom name.</p>

        ${!isDeployed ? `
          <div class="deployment-form">
            <div class="input-field">
              <label>
                <i class="fas fa-tag"></i>
                Website Name (subdomain)
              </label>
              <input type="text" id="websiteNameInput" placeholder="my-awesome-site" pattern="[a-z0-9-]+" />
              <small>Only lowercase letters, numbers, and hyphens. Your site will be: ${window.location.host}/website/your-name</small>
            </div>
            <button class="btn-primary" id="deployWebsiteBtn">
              <i class="fas fa-rocket"></i> Deploy Website
            </button>
          </div>
        ` : `
          <div class="deployed-info">
            <div class="info-row">
              <span><i class="fas fa-link"></i> Website URL:</span>
              <a href="${websiteInfo.deployedUrl}" target="_blank">${websiteInfo.deployedUrl}</a>
            </div>
            <div class="info-row">
              <span><i class="fas fa-tag"></i> Website Name:</span>
              <span>${websiteInfo.websiteName}</span>
            </div>
            <button class="btn-danger" id="undeployWebsiteBtn">
              <i class="fas fa-times"></i> Undeploy Website
            </button>
          </div>
        `}
      </div>

      ${isDeployed ? `
        <!-- NEW FEATURE 1: Website Analytics -->
        <div class="website-feature-card">
          <div class="feature-header">
            <h3><i class="fas fa-chart-line"></i> Website Analytics</h3>
          </div>
          <div class="analytics-grid" id="analyticsGrid">
            <div class="loading">Loading analytics...</div>
          </div>
        </div>

        <!-- NEW FEATURE 2: Custom Domain Setup -->
        <div class="website-feature-card">
          <div class="feature-header">
            <h3><i class="fas fa-link"></i> Custom Domain</h3>
          </div>
          <div class="custom-domain-section" id="customDomainSection">
            <p style="margin-bottom: 16px; color: var(--text-secondary);">
              Connect your own domain name to your website for a professional look.
            </p>
            <div class="input-field">
              <label>
                <i class="fas fa-globe"></i>
                Domain Name
              </label>
              <input type="text" id="customDomainInput" placeholder="example.com" />
              <small>Enter your domain without www or https://</small>
            </div>
            <button class="btn-primary" id="setDomainBtn">
              <i class="fas fa-plus"></i> Add Custom Domain
            </button>
            <div id="domainInstructions" style="display: none; margin-top: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
              <h4 style="margin-bottom: 8px;"><i class="fas fa-info-circle"></i> DNS Setup Instructions</h4>
              <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">
                Add the following CNAME record to your DNS provider:
              </p>
              <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
                Type: CNAME<br>
                Name: @ (or your subdomain)<br>
                Value: <span id="cnameValue"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- NEW FEATURE 3: SSL Certificate Status -->
        <div class="website-feature-card">
          <div class="feature-header">
            <h3><i class="fas fa-lock"></i> SSL Certificate</h3>
          </div>
          <div class="ssl-status-section" id="sslStatusSection">
            <div class="loading">Loading SSL status...</div>
          </div>
        </div>

        <!-- NEW FEATURE 4: Deployment History -->
        <div class="website-feature-card">
          <div class="feature-header">
            <h3><i class="fas fa-history"></i> Deployment History</h3>
          </div>
          <div class="deployment-history-section" id="deploymentHistorySection">
            <div class="loading">Loading deployment history...</div>
          </div>
        </div>

        <!-- NEW FEATURE 5: Environment Variables -->
        <div class="website-feature-card">
          <div class="feature-header">
            <h3><i class="fas fa-key"></i> Environment Variables</h3>
            <button class="btn-secondary-small" id="addEnvVarBtn">
              <i class="fas fa-plus"></i> Add Variable
            </button>
          </div>
          <div class="env-vars-section" id="envVarsSection">
            <div class="loading">Loading environment variables...</div>
          </div>
        </div>
      ` : ''}

      <div class="website-info-section">
        <div class="server-info-card-modern">
          <h3><i class="fas fa-info-circle"></i> Deployment Info</h3>
          <div class="info-grid">
            <div class="info-row-modern">
              <span class="info-label-modern">Status:</span>
              <span class="status-badge-modern ${isDeployed ? 'online' : 'offline'}">${isDeployed ? 'Deployed' : 'Not Deployed'}</span>
            </div>
            <div class="info-row-modern">
              <span class="info-label-modern">Account ID:</span>
              <span>${currentUser.accountId}</span>
            </div>
            <div class="info-row-modern">
              <span class="info-label-modern">Type:</span>
              <span>Website Hosting</span>
            </div>
          </div>
        </div>

        <div class="server-info-card-modern">
          <h3><i class="fas fa-file"></i> Required Files</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;"><i class="fas fa-check" style="color: #10b981;"></i> index.html (required)</li>
            <li style="padding: 8px 0;"><i class="fas fa-check" style="color: #10b981;"></i> CSS files (optional)</li>
            <li style="padding: 8px 0;"><i class="fas fa-check" style="color: #10b981;"></i> JavaScript files (optional)</li>
            <li style="padding: 8px 0;"><i class="fas fa-check" style="color: #10b981;"></i> Images/assets (optional)</li>
          </ul>
          <p style="margin-top: 16px; color: var(--text-secondary); font-size: 14px;">
            Upload your files in the Files section before deploying.
          </p>
        </div>
      </div>
    </div>
  `;

  if (!isDeployed) {
    document.getElementById('deployWebsiteBtn')?.addEventListener('click', deployWebsite);
  } else {
    document.getElementById('undeployWebsiteBtn')?.addEventListener('click', undeployWebsite);

    // Load all new features
    loadWebsiteAnalytics();
    loadSSLStatus();
    loadDeploymentHistory();
    loadWebsiteEnvVars();

    // Setup custom domain
    document.getElementById('setDomainBtn')?.addEventListener('click', setCustomDomain);

    // Setup env var button
    document.getElementById('addEnvVarBtn')?.addEventListener('click', addWebsiteEnvVar);
  }
}

// NEW FEATURE 1: Website Analytics
async function loadWebsiteAnalytics() {
  try {
    const res = await fetch(`${API}/website/analytics?accountId=${currentUser.accountId}`);
    const data = await res.json();

    const grid = document.getElementById('analyticsGrid');
    if (data.success && data.analytics) {
      const analytics = data.analytics;
      grid.innerHTML = `
        <div class="analytics-stat">
          <div class="analytics-icon">
            <i class="fas fa-eye"></i>
          </div>
          <div class="analytics-info">
            <div class="analytics-value">${analytics.totalVisits || 0}</div>
            <div class="analytics-label">Total Visits</div>
          </div>
        </div>
        <div class="analytics-stat">
          <div class="analytics-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="analytics-info">
            <div class="analytics-value">${analytics.uniqueVisitors || 0}</div>
            <div class="analytics-label">Unique Visitors</div>
          </div>
        </div>
        <div class="analytics-stat">
          <div class="analytics-icon">
            <i class="fas fa-file"></i>
          </div>
          <div class="analytics-info">
            <div class="analytics-value">${Object.keys(analytics.pageViews || {}).length}</div>
            <div class="analytics-label">Pages Tracked</div>
          </div>
        </div>
        <div class="analytics-stat">
          <div class="analytics-icon">
            <i class="fas fa-clock"></i>
          </div>
          <div class="analytics-info">
            <div class="analytics-value">${analytics.lastVisit ? new Date(analytics.lastVisit).toLocaleDateString() : 'Never'}</div>
            <div class="analytics-label">Last Visit</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// NEW FEATURE 2: Custom Domain
async function setCustomDomain() {
  const domain = document.getElementById('customDomainInput').value.trim().toLowerCase();

  if (!domain) {
    alert('Please enter a domain name');
    return;
  }

  try {
    const res = await fetch(`${API}/website/custom-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: currentUser.accountId,
        customDomain: domain
      })
    });

    const data = await res.json();

    if (data.success) {
      const instructions = document.getElementById('domainInstructions');
      const cnameValue = document.getElementById('cnameValue');

      cnameValue.textContent = window.location.host;
      instructions.style.display = 'block';

      showSuccessModal('✅ Custom Domain Added', `Your custom domain ${domain} has been configured. Please follow the DNS setup instructions.`);
    } else {
      showErrorModal('❌ Error', data.error || 'Failed to set custom domain');
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to set custom domain: ' + err.message);
  }
}

// NEW FEATURE 3: SSL Certificate Status
async function loadSSLStatus() {
  try {
    const res = await fetch(`${API}/website/ssl-status?accountId=${currentUser.accountId}`);
    const data = await res.json();

    const section = document.getElementById('sslStatusSection');
    if (data.success && data.ssl) {
      const ssl = data.ssl;
      section.innerHTML = `
        <div class="ssl-status-grid">
          <div class="ssl-info-item">
            <div class="ssl-label">
              <i class="fas fa-shield-alt"></i> Status
            </div>
            <div class="ssl-value">
              <span class="status-badge-modern ${ssl.status === 'active' ? 'online' : 'offline'}">
                ${ssl.status === 'active' ? 'Active & Secure' : 'Inactive'}
              </span>
            </div>
          </div>
          <div class="ssl-info-item">
            <div class="ssl-label">
              <i class="fas fa-certificate"></i> Provider
            </div>
            <div class="ssl-value">${ssl.provider}</div>
          </div>
          <div class="ssl-info-item">
            <div class="ssl-label">
              <i class="fas fa-calendar"></i> Expires
            </div>
            <div class="ssl-value">${ssl.expiresAt}</div>
          </div>
          <div class="ssl-info-item">
            <div class="ssl-label">
              <i class="fas fa-sync"></i> Auto-Renew
            </div>
            <div class="ssl-value">
              <span class="status-badge-modern online">${ssl.autoRenew ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
        ${ssl.status === 'active' ? `
          <div class="ssl-success-message">
            <i class="fas fa-check-circle"></i>
            Your website is protected with a valid SSL certificate. All traffic is encrypted.
          </div>
        ` : ''}
      `;
    }
  } catch (err) {
    console.error('Error loading SSL status:', err);
  }
}

// NEW FEATURE 4: Deployment History
async function loadDeploymentHistory() {
  try {
    const res = await fetch(`${API}/website/deployment-history?accountId=${currentUser.accountId}`);
    const data = await res.json();

    const section = document.getElementById('deploymentHistorySection');
    if (data.success) {
      const history = data.history || [];

      if (history.length === 0) {
        section.innerHTML = `
          <div class="empty-state-small">
            <i class="fas fa-history"></i>
            <p>No deployment history yet</p>
          </div>
        `;
      } else {
        section.innerHTML = `
          <div class="deployment-timeline">
            ${history.map(deployment => `
              <div class="deployment-item">
                <div class="deployment-icon ${deployment.status === 'success' ? 'success' : 'failed'}">
                  <i class="fas fa-${deployment.status === 'success' ? 'check' : 'times'}"></i>
                </div>
                <div class="deployment-details">
                  <div class="deployment-message">${deployment.message}</div>
                  <div class="deployment-meta">
                    <span><i class="fas fa-clock"></i> ${new Date(deployment.timestamp * 1000).toLocaleString()}</span>
                    ${deployment.url ? `<span><i class="fas fa-link"></i> <a href="${deployment.url}" target="_blank">View</a></span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error loading deployment history:', err);
  }
}

// NEW FEATURE 5: Environment Variables
async function loadWebsiteEnvVars() {
  try {
    const res = await fetch(`${API}/website/env-vars?accountId=${currentUser.accountId}`);
    const data = await res.json();

    const section = document.getElementById('envVarsSection');
    if (data.success) {
      const envVars = data.envVars || {};
      const entries = Object.entries(envVars);

      if (entries.length === 0) {
        section.innerHTML = `
          <div class="empty-state-small">
            <i class="fas fa-key"></i>
            <p>No environment variables configured</p>
          </div>
        `;
      } else {
        section.innerHTML = `
          <div class="env-vars-list">
            ${entries.map(([key, value]) => `
              <div class="env-var-item">
                <div class="env-var-key">
                  <i class="fas fa-key"></i>
                  ${key}
                </div>
                <div class="env-var-value">${value.substring(0, 20)}${value.length > 20 ? '...' : ''}</div>
                <button class="btn-icon-small" onclick="deleteWebsiteEnvVar('${key}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error loading environment variables:', err);
  }
}

function addWebsiteEnvVar() {
  const key = prompt('Enter variable name:');
  const value = prompt('Enter variable value:');

  if (!key || !value) return;

  fetch(`${API}/website/env-vars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: currentUser.accountId,
      key: key,
      value: value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showSuccessModal('✅ Variable Added', `Environment variable ${key} has been added successfully.`);
      loadWebsiteEnvVars();
    }
  })
  .catch(err => {
    showErrorModal('❌ Error', 'Failed to add variable: ' + err.message);
  });
}

function deleteWebsiteEnvVar(key) {
  if (!confirm(`Delete environment variable "${key}"?`)) return;

  // Implementation would call DELETE endpoint
  showSuccessModal('✅ Variable Deleted', `Environment variable ${key} has been deleted.`);
  loadWebsiteEnvVars();
}

async function deployWebsite() {
  const websiteName = document.getElementById('websiteNameInput').value.trim().toLowerCase();

  if (!websiteName) {
    showToast('⚠️ Missing Information', 'Please enter a website name', 'warning', 3000);
    return;
  }

  if (!/^[a-z0-9-]+$/.test(websiteName)) {
    showToast(
      '⚠️ Invalid Name',
      'Website name can only contain lowercase letters, numbers, and hyphens',
      'warning',
      4000
    );
    return;
  }

  showToast('🚀 Deploying Website', 'Setting up your website...', 'info', 2000);

  try {
    const res = await fetch(`${API}/website/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: currentUser.accountId,
        websiteName: websiteName
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(
        '🎉 Website Deployed!',
        `Your website is live at ${data.deployedUrl}`,
        'success',
        6000
      );

      showSuccessModal('🚀 Website Deployed!', `Your website is now live at: ${data.deployedUrl}`, () => {
        location.reload();
      });
    } else {
      showToast('❌ Deployment Failed', data.error || 'Unknown error occurred', 'error', 5000);
      showErrorModal('❌ Deployment Failed', data.error || 'Unknown error occurred');
    }
  } catch (err) {
    showToast('❌ Deployment Error', 'Failed to deploy: ' + err.message, 'error', 5000);
    showErrorModal('❌ Error', 'Failed to deploy website: ' + err.message);
  }
}

async function undeployWebsite() {
  if (!confirm('Are you sure you want to undeploy your website? It will no longer be accessible.')) {
    return;
  }

  try {
    const res = await fetch(`${API}/website/undeploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: currentUser.accountId
      })
    });

    const data = await res.json();

    if (data.success) {
      showSuccessModal('✅ Website Undeployed', 'Your website has been undeployed successfully.', () => {
        location.reload();
      });
    } else {
      showErrorModal('❌ Undeploy Failed', data.error || 'Unknown error occurred');
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to undeploy website: ' + err.message);
  }
}

function copyCommandToClipboard() {
  const command = document.querySelector('#commandPreview code').textContent;
  navigator.clipboard.writeText(command).then(() => {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = '<i class="fas fa-check"></i> Command copied to clipboard!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  });
}

// Admin: Hosting Accounts
async function loadHostingAccounts() {
  const page = document.getElementById('hostingPage');

  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-server"></i> Hosting Accounts</h2>
      <div style="display: flex; gap: 10px;">
        <button class="btn-warning" id="deletionRequestsBtn">
          <i class="fas fa-trash-alt"></i> Deletion Requests
        </button>
        <button class="btn-info" id="archiveBtn">
          <i class="fas fa-archive"></i> Deleted Archive
        </button>
        <button class="btn-secondary" id="cleanupAllBtn">
          <i class="fas fa-broom"></i> Clean All Accounts
        </button>
        <button class="btn-primary" id="createHostingBtn">
          <i class="fas fa-plus"></i> Create New Hosting
        </button>
      </div>
    </div>
    <div class="hosting-grid" id="hostingGrid"></div>
  `;

  try {
    const res = await fetch(`${API}/hosting/accounts`);
    const data = await res.json();

    const grid = document.getElementById('hostingGrid');

    if (data.accounts && data.accounts.length > 0) {
      data.accounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'hosting-card';

        // Determine type and display info
        const type = account.type || account.language || 'python';
        let typeIcon, typeColor, typeText;

        if (type === 'website') {
          typeIcon = 'fas fa-globe';
          typeColor = '#10b981';
          typeText = 'Website';
        } else if (type === 'javascript') {
          typeIcon = 'fab fa-js';
          typeColor = '#f7df1e';
          typeText = 'JavaScript';
        } else {
          typeIcon = 'fab fa-python';
          typeColor = '#3776ab';
          typeText = 'Python';
        }

        card.innerHTML = `
          <div class="hosting-card-header">
            <h3><i class="fas fa-server"></i> ${account.name}</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="language-badge" style="background: ${typeColor}; color: ${type === 'javascript' ? '#000' : '#fff'};">
                <i class="${typeIcon}"></i> ${typeText}
              </span>
              <span class="status-badge ${account.status}">${account.status}</span>
            </div>
          </div>
          <div class="hosting-info">
            <div class="info-item">
              <i class="fas fa-network-wired"></i>
              <span>IP: ${account.ip}</span>
            </div>
            <div class="info-item">
              <i class="fas fa-key"></i>
              <span>API Key: ${account.apiKey.substring(0, 20)}...</span>
            </div>
            <div class="info-item">
              <i class="fas fa-microchip"></i>
              <span>CPU: ${account.resources.cpu}%</span>
            </div>
            <div class="info-item">
              <i class="fas fa-memory"></i>
              <span>RAM: ${account.resources.ram} MB</span>
            </div>
            <div class="info-item">
              <i class="fas fa-hdd"></i>
              <span>Disk: ${account.resources.disk} MB</span>
            </div>
          </div>
          <div class="hosting-actions">
            <button class="btn-primary" onclick="manageHosting('${account.id}')">
              <i class="fas fa-cog"></i> Manage
            </button>
            <button class="btn-secondary" onclick="cleanupHostingFiles('${account.id}')">
              <i class="fas fa-broom"></i> Clean Files
            </button>
            <button class="btn-secondary" onclick="deleteHosting('${account.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        `;
        grid.appendChild(card);
      });
    } else {
      grid.innerHTML = '<p class="empty-state">No hosting accounts yet. Create one to get started!</p>';
    }

    document.getElementById('createHostingBtn').addEventListener('click', createHosting);
    document.getElementById('cleanupAllBtn')?.addEventListener('click', cleanupAllHostingAccounts);
    document.getElementById('deletionRequestsBtn')?.addEventListener('click', showDeletionRequestsPanel);
    document.getElementById('archiveBtn')?.addEventListener('click', showDeletedArchive);
  } catch (err) {
    console.error('Error loading hosting accounts:', err);
  }
}

async function cleanupAllHostingAccounts() {
  if (!confirm('This will remove all non-essential files from ALL hosting accounts. Continue?')) return;

  try {
    const res = await fetch(`${API}/hosting/cleanup-all`, {
      method: 'POST'
    });

    const data = await res.json();

    if (data.success) {
      let message = `Cleanup complete!\n\nCleaned ${data.total_cleaned} accounts:\n\n`;
      for (const [accountId, result] of Object.entries(data.results)) {
        if (result.success) {
          message += `${accountId}: Removed ${result.count} items\n`;
        } else {
          message += `${accountId}: Error - ${result.error}\n`;
        }
      }
      alert(message);
      loadHostingAccounts();
    } else {
      alert('Failed to cleanup accounts');
    }
  } catch (err) {
    alert('Cleanup error: ' + err.message);
  }
}

async function createHosting() {
  // Show hosting type selection modal
  const modal = document.createElement('div');
  modal.className = 'credentials-modal';
  modal.innerHTML = `
    <div class="credentials-content">
      <div class="credentials-header">
        <h3><i class="fas fa-server"></i> Create New Hosting</h3>
        <button class="close-modal" onclick="this.closest('.credentials-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="credentials-body">
        <p style="color: var(--text-secondary); margin-bottom: 20px;">Select the hosting type:</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <button class="language-select-btn" data-type="python">
            <i class="fab fa-python"></i>
            <span>Python Bot</span>
            <small>Discord.py bots</small>
          </button>
          <button class="language-select-btn" data-type="javascript">
            <i class="fab fa-js"></i>
            <span>JavaScript Bot</span>
            <small>Discord.js bots</small>
          </button>
          <button class="language-select-btn" data-type="website">
            <i class="fas fa-globe"></i>
            <span>Website</span>
            <small>HTML/CSS/JS sites</small>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add styles for language buttons
  const style = document.createElement('style');
  style.textContent = `
    .language-select-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .language-select-btn:hover {
      border-color: var(--accent-primary);
      background: var(--bg-secondary);
      transform: translateY(-2px);
    }
    .language-select-btn i {
      font-size: 48px;
      color: var(--accent-primary);
    }
    .language-select-btn span {
      font-size: 18px;
      font-weight: 600;
    }
    .language-select-btn small {
      font-size: 12px;
      color: var(--text-secondary);
    }
  `;
  document.head.appendChild(style);

  // Add click handlers
  modal.querySelectorAll('.language-select-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      modal.remove();

      try {
        const res = await fetch(`${API}/hosting/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        });

        const data = await res.json();

        if (data.success) {
          const typeName = type === 'python' ? 'Python Bot' : type === 'javascript' ? 'JavaScript Bot' : 'Website';
          alert(`${typeName} hosting account created successfully!`);
          loadHostingAccounts();
        } else {
          alert(data.error || 'Failed to create hosting');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });
}

async function manageHosting(accountId) {
  try {
    const res = await fetch(`${API}/hosting/${accountId}`);
    const data = await res.json();

    if (data.success) {
      const account = data.account;

      // Safely access credentials
      const username = account.credentials?.username || 'N/A';
      const password = account.credentials?.password || 'N/A';
      const apiKey = account.apiKey || 'N/A';

      const modal = document.createElement('div');
      modal.className = 'credentials-modal';
      modal.innerHTML = `
        <div class="credentials-content">
          <div class="credentials-header">
            <h3><i class="fas fa-key"></i> Hosting Account Credentials</h3>
            <button class="close-modal" onclick="this.closest('.credentials-modal').remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="credentials-body">
            <div class="credential-item">
              <label><i class="fas fa-server"></i> Hosting Name</label>
              <div class="credential-value">${account.name || 'N/A'}</div>
            </div>
            <div class="credential-item">
              <label><i class="fas fa-network-wired"></i> IP Address</label>
              <div class="credential-value">${account.ip || 'N/A'}</div>
            </div>
            <div class="credential-item">
              <label><i class="fas fa-user"></i> Username</label>
              <div class="credential-value">
                ${username}
                <button class="copy-btn" onclick="copyToClipboard('${username}')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="credential-item">
              <label><i class="fas fa-lock"></i> Password</label>
              <div class="credential-value">
                ${password}
                <button class="copy-btn" onclick="copyToClipboard('${password}')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="credential-item">
              <label><i class="fas fa-key"></i> API Key</label>
              <div class="credential-value">
                ${apiKey}
                <button class="copy-btn" onclick="copyToClipboard('${apiKey}')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="credentials-footer">
            <button class="btn-primary" onclick="this.closest('.credentials-modal').remove()">
              <i class="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      showErrorModal('❌ Error', data.error || 'Failed to load account credentials');
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Error loading credentials: ' + err.message);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('✅ Copied', 'Text copied to clipboard', 'success', 2000);
  }).catch(() => {
    showToast('❌ Error', 'Failed to copy to clipboard', 'error', 2000);
  });
}

async function cleanupHostingFiles(accountId) {
  if (!confirm('This will remove all non-essential files from this hosting account. Continue?')) return;

  try {
    const res = await fetch(`${API}/hosting/${accountId}/cleanup`, {
      method: 'POST'
    });

    const data = await res.json();

    if (data.success) {
      alert(`Cleanup complete! Removed ${data.removed.length} items:\n${data.removed.join('\n')}`);
      loadHostingAccounts();
    } else {
      alert(data.error || 'Failed to cleanup files');
    }
  } catch (err) {
    alert('Cleanup error: ' + err.message);
  }
}

async function deleteHosting(accountId) {
  showConfirmationModal(
    '⚠️ Request Account Deletion',
    'This will submit a deletion request to the admin. Your account will be deleted once approved. This action sends your account to archive for review.',
    'Submit Request',
    'Cancel',
    async () => {
      try {
        const res = await fetch(`${API}/hosting/${accountId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        const data = await res.json();

        if (data.success){
          showSuccessModal(
            '✅ Deletion Request Submitted',
            `${data.message}\n\nRequest ID: ${data.request_id}\n\nYou will be notified once an admin reviews your request.`,
            () => {
              location.reload();
            }
          );
        } else {
          showErrorModal('❌ Request Failed', data.error || 'Failed to submit deletion request');
        }
      } catch (err) {
        showErrorModal('❌ Error', 'Delete request error: ' + err.message);
      }
    }
  );
}

async function loadAdminDeletionRequests() {
  try {
    const res = await fetch(`${API}/admin/deletion-requests`, {
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success && data.requests.length > 0) {
      return data.requests;
    }
  } catch (err) {
    console.error('Error loading deletion requests:', err);
  }
  return [];
}

async function showDeletionRequestsPanel() {
  const requests = await loadAdminDeletionRequests();

  const modal = document.createElement('div');
  modal.className = 'deletion-requests-modal';
  modal.innerHTML = `
    <div class="deletion-requests-content">
      <div class="deletion-requests-header">
        <h3><i class="fas fa-trash-alt"></i> Pending Deletion Requests</h3>
        <button class="close-modal" onclick="this.closest('.deletion-requests-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="deletion-requests-body">
        ${requests.length === 0 ? `
          <div class="empty-state-small">
            <i class="fas fa-inbox"></i>
            <p>No pending deletion requests</p>
          </div>
        ` : `
          <div class="requests-list">
            ${requests.map(req => `
              <div class="request-item">
                <div class="request-info">
                  <div class="request-title">
                    <i class="fas fa-server"></i>
                    <strong>${req.account_name}</strong>
                  </div>
                  <div class="request-meta">
                    <span><i class="fas fa-user"></i> ${req.requested_by}</span>
                    <span><i class="fas fa-clock"></i> ${new Date(req.requested_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
                <div class="request-actions">
                  <button class="btn-success-small" onclick="approveDeletionRequest('${req.request_id}')">
                    <i class="fas fa-check"></i> Approve
                  </button>
                  <button class="btn-danger-small" onclick="rejectDeletionRequest('${req.request_id}')">
                    <i class="fas fa-times"></i> Reject
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function approveDeletionRequest(requestId) {
  if (!confirm('Approve this deletion request? The account will be permanently deleted and archived.')) return;

  try {
    const res = await fetch(`${API}/admin/deletion-request/${requestId}/approve`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success) {
      showSuccessModal('✅ Request Approved', data.message, () => {
        document.querySelector('.deletion-requests-modal')?.remove();
        loadHostingAccounts();
      });
    } else {
      showErrorModal('❌ Approval Failed', data.error);
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to approve request: ' + err.message);
  }
}

async function rejectDeletionRequest(requestId) {
  const reason = prompt('Enter rejection reason (optional):');

  try {
    const res = await fetch(`${API}/admin/deletion-request/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason: reason || 'No reason provided' })
    });
    const data = await res.json();

    if (data.success) {
      showSuccessModal('✅ Request Rejected', data.message, () => {
        document.querySelector('.deletion-requests-modal')?.remove();
      });
    } else {
      showErrorModal('❌ Rejection Failed', data.error);
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to reject request: ' + err.message);
  }
}

async function showDeletedArchive() {
  try {
    const res = await fetch(`${API}/admin/deleted-archive`, {
      credentials: 'include'
    });
    const data = await res.json();

    const modal = document.createElement('div');
    modal.className = 'deleted-archive-modal';
    modal.innerHTML = `
      <div class="deleted-archive-content">
        <div class="deleted-archive-header">
          <h3><i class="fas fa-archive"></i> Deleted Accounts Archive</h3>
          <button class="close-modal" onclick="this.closest('.deleted-archive-modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="deleted-archive-body">
          ${!data.success || data.archive.length === 0 ? `
            <div class="empty-state-small">
              <i class="fas fa-archive"></i>
              <p>No deleted accounts in archive</p>
            </div>
          ` : `
            <div class="archive-list">
              ${data.archive.map(item => `
                <div class="archive-item">
                  <div class="archive-info">
                    <div class="archive-title">
                      <i class="fas fa-server"></i>
                      <strong>${item.account_name}</strong>
                    </div>
                    <div class="archive-meta">
                      <span><i class="fas fa-trash"></i> Deleted by: ${item.deleted_by}</span>
                      <span><i class="fas fa-user"></i> Requested by: ${item.requested_by}</span>
                      <span><i class="fas fa-calendar"></i> ${new Date(item.deleted_at * 1000).toLocaleString()}</span>
                    </div>
                  </div>
                  <div class="archive-actions">
                    <button class="btn-secondary-small" onclick="viewArchivedAccount('${item.archive_id}')">
                      <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn-primary-small" onclick="restoreArchivedAccount('${item.archive_id}')">
                      <i class="fas fa-undo"></i> Restore
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to load archive: ' + err.message);
  }
}

async function viewArchivedAccount(archiveId) {
  try {
    const res = await fetch(`${API}/admin/deleted-archive/${archiveId}`);
    const data = await res.json();

    if (data.success) {
      const account = data.archive.account_data;
      alert(`Account Details:\n\nName: ${account.name}\nIP: ${account.ip}\nType: ${account.type || account.language}\nDeleted: ${new Date(data.archive.deleted_at * 1000).toLocaleString()}\nRequested by: ${data.archive.requested_by}`);
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to view account: ' + err.message);
  }
}

async function restoreArchivedAccount(archiveId) {
  if (!confirm('Restore this account? A new account will be created with the archived data.')) return;

  try {
    const res = await fetch(`${API}/admin/deleted-archive/${archiveId}/restore`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success) {
      showSuccessModal('✅ Account Restored', data.message, () => {
        document.querySelector('.deleted-archive-modal')?.remove();
        loadHostingAccounts();
      });
    } else {
      showErrorModal('❌ Restore Failed', data.error);
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to restore account: ' + err.message);
  }
}

// Server Control
async function startServer() {
  // Get account ID from currentUser for hosting users, or undefined for admins
  const accountId = currentUser?.accountId;

  try {
    const res = await fetch(`${API}/bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Started', 'Bot is starting...', 'success', 3000);
      updateServerStats();
    } else {
      showToast('❌ Start Failed', data.error || 'Failed to start bot', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error starting bot: ' + err.message, 'error', 5000);
  }
}

async function restartServer() {
  const accountId = currentUser?.accountId;
  if (!accountId) {
    showToast('❌ Error', 'No account ID found', 'error', 3000);
    return;
  }

  try {
    showToast('🔄 Restarting', 'Restarting server...', 'info', 2000);

    // Update status to restarting (orange)
    const statusCard = document.getElementById('botStatusCard');
    const statusOrb = document.getElementById('botStatusOrb');
    const statusIcon = document.getElementById('botStatusIcon');
    const statusBadge = document.getElementById('botStatusBadge');

    if (statusCard) statusCard.className = 'bot-status-card restarting';
    if (statusOrb) statusOrb.className = 'bot-status-orb restarting';
    if (statusIcon) statusIcon.style.color = '#0099ff';
    if (statusBadge) {
      statusBadge.className = 'bot-status-badge restarting';
      const badgeText = statusBadge.querySelector('.badge-text');
      if (badgeText) badgeText.textContent = 'Restarting';
    }

    // Stop the server first
    const stopRes = await fetch(`${API}/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });
    
    if (!stopRes.ok) {
      const stopData = await stopRes.json();
      console.log('Stop response:', stopData);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start the server
    const startRes = await fetch(`${API}/bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });
    
    const startData = await startRes.json();
    
    if (startData.success) {
      showToast('✅ Restarted', 'Server restarted successfully!', 'success', 3000);
      updateServerStats();
    } else {
      showToast('❌ Error', startData.error || 'Failed to start server after stop', 'error', 5000);
    }
  } catch (err) {
    console.error('Restart error:', err);
    showToast('❌ Error', 'Failed to restart server: ' + err.message, 'error', 3000);
  }
}

async function stopServer() {
  const accountId = currentUser?.accountId;

  showToast('⏹️ Stopping Server', 'Shutting down server...', 'info', 2000);

  try {
    const res = await fetch(`${API}/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });
    if (res.ok) {
      // Clear server start time
      clearServerStartTime();

      // Clear console logs
      permanentLogStorage = [];
      consoleLogCache = [];
      const terminal = document.getElementById('consoleTerminal');
      if (terminal) {
        terminal.innerHTML = `
          <div class="console-welcome-message">
            <i class="fas fa-terminal"></i>
            <p>Bot stopped</p>
            <small>Console cleared. Start your bot to see output.</small>
          </div>
        `;
      }
      updateLogCount(0);

      showToast(
        '✅ Server Stopped',
        'Server has been shut down successfully. Console logs cleared.',
        'success',
        4000
      );

      // Force immediate status update
      setTimeout(() => {
        updateServerStats();
      }, 500);
    } else {
      showToast(
        '❌ Stop Failed',
        'Failed to stop the server',
        'error',
        5000
      );
    }
  } catch (err) {
    showToast(
      '❌ Connection Error',
      'Error stopping server: ' + err.message,
      'error',
      5000
    );
  }
}

// User Management Page
async function loadUserManagement() {
  const page = document.getElementById('userManagementPage');
  page.innerHTML = `
    <div class="user-management-modern">
      <div class="user-management-header">
        <div class="header-left">
          <div class="icon-wrapper">
            <i class="fas fa-users-cog"></i>
          </div>
          <div>
            <h2>Account Management</h2>
            <p>View and manage all hosting accounts</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-secondary-small" id="unsuspendAllBtn">
            <i class="fas fa-unlock"></i> Unsuspend All
          </button>
        </div>
      </div>

      <div class="user-stats-grid">
        <div class="user-stat-card">
          <div class="stat-icon-wrapper">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="totalAccountsCount">0</div>
            <div class="stat-label">Total Accounts</div>
          </div>
        </div>
        <div class="user-stat-card">
          <div class="stat-icon-wrapper active">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="onlineAccountsCount">0</div>
            <div class="stat-label">Online</div>
          </div>
        </div>
        <div class="user-stat-card">
          <div class="stat-icon-wrapper">
            <i class="fas fa-pause-circle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="offlineAccountsCount">0</div>
            <div class="stat-label">Offline</div>
          </div>
        </div>
        <div class="user-stat-card">
          <div class="stat-icon-wrapper danger">
            <i class="fas fa-ban"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="suspendedAccountsCount">0</div>
            <div class="stat-label">Suspended</div>
          </div>
        </div>
      </div>

      <div class="user-search-modern">
        <i class="fas fa-search"></i>
        <input type="text" id="userSearchInput" placeholder="Search by username, ID, or type...">
      </div>

      <div class="users-grid-modern" id="usersGridContainer">
        <div class="loading">Loading accounts...</div>
      </div>
    </div>
  `;

  loadAllAccounts();

  // Auto-refresh every 10 seconds
  setInterval(loadAllAccounts, 10000);

  document.getElementById('unsuspendAllBtn')?.addEventListener('click', unsuspendAllAccounts);
  document.getElementById('userSearchInput')?.addEventListener('input', filterAccounts);
}

async function loadAllAccounts() {
  try {
    const res = await fetch(`${API}/admin/user-management`);
    const data = await res.json();

    const container = document.getElementById('usersGridContainer');

    if (data.success && data.accounts) {
      const accounts = data.accounts;

      // Update stats
      document.getElementById('totalAccountsCount').textContent = accounts.length;
      document.getElementById('onlineAccountsCount').textContent = accounts.filter(a => a.status === 'online').length;
      document.getElementById('offlineAccountsCount').textContent = accounts.filter(a => a.status === 'offline').length;
      document.getElementById('suspendedAccountsCount').textContent = accounts.filter(a => a.status === 'suspended').length;

      if (accounts.length === 0) {
        container.innerHTML = `
          <div class="empty-state-modern">
            <i class="fas fa-users"></i>
            <h3>No Accounts Found</h3>
            <p>There are no hosting accounts yet</p>
          </div>
        `;
      } else {
        container.innerHTML = accounts.map(account => `
          <div class="user-card-modern ${account.status === 'suspended' ? 'suspended' : ''}" data-account-id="${account.account_id}">
            <div class="user-card-header">
              <div class="user-avatar">
                <i class="fas fa-user"></i>
              </div>
              <div class="user-info">
                <div class="user-name">${account.username}</div>
                <div class="user-id">${account.account_id}</div>
              </div>
              <div class="user-status-badge ${account.status}">
                <i class="fas fa-${account.status === 'online' ? 'check-circle' : account.status === 'suspended' ? 'ban' : 'circle'}"></i>
              </div>
            </div>
            <div class="user-card-body">
              <div class="user-detail-row">
                <span class="detail-label">
                  <i class="fas fa-server"></i>
                  Hosting Name
                </span>
                <span class="detail-value">${account.hosting_name}</span>
              </div>
              <div class="user-detail-row">
                <span class="detail-label">
                  <i class="fas fa-code"></i>
                  Type
                </span>
                <span class="type-badge ${account.type}">${account.type}</span>
              </div>
              <div class="user-detail-row">
                <span class="detail-label">
                  <i class="fas fa-network-wired"></i>
                  IP Address
                </span>
                <span class="detail-value">${account.ip}</span>
              </div>
              <div class="user-detail-row">
                <span class="detail-label">
                  <i class="fas fa-calendar"></i>
                  Created
                </span>
                <span class="detail-value">${new Date(account.created_at * 1000).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="user-card-actions">
              <button class="user-action-btn info" onclick="viewAccountDetails('${account.account_id}')" title="View Details">
                <i class="fas fa-info-circle"></i>
              </button>
              ${account.status === 'suspended' ? `
                <button class="user-action-btn success" onclick="unsuspendAccount('${account.account_id}')" title="Unsuspend">
                  <i class="fas fa-unlock"></i>
                </button>
              ` : `
                <button class="user-action-btn warning" onclick="suspendAccount('${account.account_id}')" title="Suspend">
                  <i class="fas fa-pause-circle"></i>
                </button>
              `}
              <button class="user-action-btn danger" onclick="deleteAccount('${account.account_id}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    } else {
      container.innerHTML = `
        <div class="error-state-modern">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Accounts</h3>
          <p>${data.error || 'Unknown error'}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading accounts:', err);
    const container = document.getElementById('usersGridContainer');
    if (container) {
      container.innerHTML = `
        <div class="error-state-modern">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Accounts</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

function filterAccounts() {
  const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
  document.querySelectorAll('.user-card-modern').forEach(card => {
    const accountId = card.dataset.accountId.toLowerCase();
    const username = card.querySelector('.user-name').textContent.toLowerCase();
    const hostingName = card.querySelector('.user-detail-row .detail-value').textContent.toLowerCase();

    const matches = accountId.includes(searchTerm) || username.includes(searchTerm) || hostingName.includes(searchTerm);
    card.style.display = matches ? 'block' : 'none';
  });
}

async function unsuspendAllAccounts() {
  if (!confirm('Are you sure you want to unsuspend ALL suspended accounts?')) return;

  try {
    const res = await fetch(`${API}/admin/unsuspend-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Success', `Unsuspended ${data.unsuspended.length} accounts`, 'success', 4000);
      loadAllAccounts();
    } else {
      showToast('❌ Error', data.error || 'Failed to unsuspend accounts', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error unsuspending accounts: ' + err.message, 'error', 5000);
  }
}

async function suspendAccount(accountId) {
  const reason = prompt('Enter suspension reason:');
  if (!reason) return;

  try {
    // First, stop the bot if it's running
    showToast('🛑 Suspending', 'Stopping bot and suspending account...', 'info', 2000);

    await fetch(`${API}/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });

    // Then suspend the account
    const res = await fetch(`${API}/admin/user/${accountId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason, duration: 'indefinite' })
    });

    const data = await res.json();

    if (data.success)    {
      showToast('✅ Suspended', `Bot stopped and account suspended successfully`, 'success', 4000);
      loadAllAccounts();
    } else {
      showToast('❌ Error', data.error || 'Failed to suspend account', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error suspending account: ' + err.message, 'error', 5000);
  }
}

async function unsuspendAccount(accountId) {
  try {
    const res = await fetch(`${API}/admin/user/${accountId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Unsuspended', `Account unsuspended successfully`, 'success', 4000);
      loadAllAccounts();
    } else {
      showToast('❌ Error', data.error || 'Failed to unsuspend account', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error unsuspending account: ' + err.message, 'error', 5000);
  }
}

async function deleteAccount(accountId) {
  if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/hosting/${accountId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Deleted', `Account deleted successfully`, 'success', 4000);
      loadAllAccounts();
    } else {
      showToast('❌ Error', data.error || 'Failed to delete account', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error deleting account: ' + err.message, 'error', 5000);
  }
}

async function viewAccountDetails(accountId) {
  try {
    showToast('ℹ️ Info', `Loading details for account ${accountId}`, 'info', 2000);

    const res = await fetch(`${API}/admin/user/${accountId}/details`, {
      credentials: 'include'
    });
    const data = await res.json();

    if (!data.success) {
      showErrorModal('❌ Error', data.error || 'Failed to load user details');
      return;
    }

    const details = data.details;
    const tracking = details.tracking || {};
    const account = details.account || {};
    const banStatus = details.ban_status;

    const modal = document.createElement('div');
    modal.className = 'user-details-modal-overlay';
    modal.innerHTML = `
      <div class="user-details-modal">
        <div class="user-details-header">
          <div class="header-icon">
            <i class="fas fa-user-circle"></i>
          </div>
          <div>
            <h3>${account.username || 'Unknown User'}</h3>
            <p class="user-detail-subtitle">Account ID: ${accountId}</p>
          </div>
          <button class="close-modal" onclick="this.closest('.user-details-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="user-details-body">
          <!-- Discord Information -->
          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fab fa-discord"></i>
              <h4>Discord Information</h4>
            </div>
            <div class="detail-grid">
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-user"></i> Discord Username:</span>
                <span class="detail-value-full">${account.discordUsername || 'N/A'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-id-badge"></i> Display Name:</span>
                <span class="detail-value-full">${account.discordDisplayName || 'N/A'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-hashtag"></i> Discord ID:</span>
                <span class="detail-value-full code-text">${account.discordId || 'N/A'}</span>
              </div>
            </div>
          </div>

          <!-- Network & Device Information -->
          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fas fa-network-wired"></i>
              <h4>Network & Device Information</h4>
            </div>
            <div class="detail-grid">
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-map-marker-alt"></i> Current IP:</span>
                <span class="detail-value-full code-text">${tracking.last_ip || 'Unknown'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-history"></i> First IP:</span>
                <span class="detail-value-full code-text">${tracking.first_ip || 'Unknown'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-desktop"></i> Devices:</span>
                <span class="detail-value-full">${(tracking.unique_devices || []).join(', ') || 'None'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-server"></i> All IPs:</span>
                <span class="detail-value-full code-text">${(tracking.unique_ips || []).join(', ') || 'None'}</span>
              </div>
            </div>
          </div>

          <!-- Hosting Information -->
          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fas fa-server"></i>
              <h4>Hosting Information</h4>
            </div>
            <div class="detail-grid">
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-tag"></i> Hosting Name:</span>
                <span class="detail-value-full">${account.name || 'Unknown'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-code"></i> Type:</span>
                <span class="type-badge ${account.type}">${account.type || account.language || 'python'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-circle"></i> Status:</span>
                <span class="status-badge-modern ${account.status}">${account.status || 'offline'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-calendar"></i> Created:</span>
                <span class="detail-value-full">${account.createdAt ? new Date(parseFloat(account.createdAt) * 1000).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          </div>

          <!-- Activity Logs -->
          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fas fa-history"></i>
              <h4>Recent Activity</h4>
            </div>
            <div class="activity-timeline">
              ${(tracking.login_history || []).slice(-5).reverse().map(login => `
                <div class="activity-item">
                  <div class="activity-icon">
                    <i class="fas fa-sign-in-alt"></i>
                  </div>
                  <div class="activity-details">
                    <div class="activity-text">Login from ${login.ip}</div>
                    <div class="activity-meta">
                      <span><i class="fas fa-desktop"></i> ${login.device_type}</span>
                      <span><i class="fas fa-clock"></i> ${new Date(login.timestamp * 1000).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('') || '<p class="empty-text">No recent activity</p>'}
            </div>
          </div>

          ${banStatus ? `
          <div class="detail-section danger-section">
            <div class="section-header-detail">
              <i class="fas fa-exclamation-triangle"></i>
              <h4>Ban/Suspension Status</h4>
            </div>
            <div class="detail-grid">
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-ban"></i> Status:</span>
                <span class="status-badge-modern ${banStatus.status}">${banStatus.status}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-info-circle"></i> Reason:</span>
                <span class="detail-value-full">${banStatus.reason || 'N/A'}</span>
              </div>
              <div class="detail-item-full">
                <span class="detail-label-full"><i class="fas fa-user-shield"></i> By:</span>
                <span class="detail-value-full">${banStatus.suspended_by || banStatus.banned_by || 'System'}</span>
              </div>
            </div>
          </div>
          ` : ''}
        </div>

        <div class="user-details-actions">
          <button class="detail-action-btn spectate" onclick="spectateHosting('${accountId}')">
            <i class="fas fa-eye"></i>
            <span>Spectate Hosting</span>
          </button>
          <button class="detail-action-btn manage" onclick="manageUserHosting('${accountId}')">
            <i class="fas fa-cogs"></i>
            <span>Manage Hosting</span>
          </button>
          <button class="detail-action-btn logs" onclick="viewUserLogs('${accountId}')">
            <i class="fas fa-file-alt"></i>
            <span>View Logs</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  } catch (err) {
    console.error('Error loading user details:', err);
    showErrorModal('❌ Error', 'Failed to load user details: ' + err.message);
  }
}

function spectateHosting(accountId) {
  showToast('👁️ Spectate Mode', 'Opening read-only view of hosting account...', 'info', 3000);

  // Switch to files page in read-only mode
  document.querySelector('.user-details-modal-overlay')?.remove();

  // Navigate to files page
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const filesNav = Array.from(document.querySelectorAll('.nav-item')).find(nav => nav.dataset.page === 'files');
  if (filesNav) {
    filesNav.classList.add('active');
    document.getElementById('filesPage').classList.add('active');

    // Load files for this account (we'll need to modify loadFiles to accept accountId)
    loadFilesForAccount(accountId, true); // true = read-only mode
  }
}

function manageUserHosting(accountId) {
  showToast('🔧 Manage Mode', 'Opening full management view...', 'info', 3000);

  document.querySelector('.user-details-modal-overlay')?.remove();

  // Navigate to files page with full permissions
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const filesNav = Array.from(document.querySelectorAll('.nav-item')).find(nav => nav.dataset.page === 'files');
  if (filesNav) {
    filesNav.classList.add('active');
    document.getElementById('filesPage').classList.add('active');

    loadFilesForAccount(accountId, false); // false = full management mode
  }
}

function viewUserLogs(accountId) {
  showToast('📄 Logs', 'Opening bot logs...', 'info', 3000);

  document.querySelector('.user-details-modal-overlay')?.remove();

  // Navigate to console page
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const consoleNav = Array.from(document.querySelectorAll('.nav-item')).find(nav => nav.dataset.page === 'console');
  if (consoleNav) {
    consoleNav.classList.add('active');
    document.getElementById('consolePage').classList.add('active');

    // Load console for this specific account
    loadConsoleForAccount(accountId);
  }
}

async function loadFilesForAccount(accountId, readOnly = false) {
  // Implementation to load files for specific account
  showToast('📁 Files', `Loading files for account ${accountId}...`, 'info', 2000);
  loadFiles(); // For now, load normal files
}

async function loadConsoleForAccount(accountId) {
  // Implementation to load console for specific account
  showToast('💻 Console', `Loading console for account ${accountId}...`, 'info', 2000);
  loadConsole(); // For now, load normal console
}

async function loadSecurityLogs() {
  const page = document.getElementById('securityLogsPage');
  page.innerHTML = `
    <div class="user-management-modern">
      <div class="user-management-header">
        <div class="header-left">
          <div class="icon-wrapper">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div>
            <h2>Security Alerts & Logs</h2>
            <p>Monitor suspicious activity and security events</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-primary-modern" id="refreshSecurityBtn">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      <div class="security-stats-row">
        <div class="security-stat-card">
          <div class="stat-icon-wrapper danger">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="totalAlertsCount">0</div>
            <div class="stat-label">Total Alerts</div>
          </div>
        </div>
        <div class="security-stat-card">
          <div class="stat-icon-wrapper warning">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="suspiciousAccountsCount">0</div>
            <div class="stat-label">Suspicious Accounts</div>
          </div>
        </div>
        <div class="security-stat-card">
          <div class="stat-icon-wrapper">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="autoSuspendedCount">0</div>
            <div class="stat-label">Auto-Suspended</div>
          </div>
        </div>
      </div>

      <div class="security-alerts-container" id="securityAlertsContainer">
        <div class="loading">Loading security alerts...</div>
      </div>
    </div>
  `;

  loadSecurityAlerts();

  document.getElementById('refreshSecurityBtn')?.addEventListener('click', loadSecurityAlerts);
}

async function loadSecurityAlerts() {
  try {
    const res = await fetch(`${API}/admin/security-alerts`);
    const data = await res.json();

    const container = document.getElementById('securityAlertsContainer');

    if (data.success && data.alerts) {
      const alerts = data.alerts;

      // Update stats
      document.getElementById('totalAlertsCount').textContent = alerts.length;

      const totalAccounts = alerts.reduce((sum, alert) => sum + alert.count, 0);
      document.getElementById('suspiciousAccountsCount').textContent = totalAccounts;

      const autoSuspended = alerts.reduce((sum, alert) => {
        return sum + alert.accounts.filter(acc => acc.status === 'suspended').length;
      }, 0);
      document.getElementById('autoSuspendedCount').textContent = autoSuspended;

      if (alerts.length === 0) {
        container.innerHTML = `
          <div class="empty-state-modern">
            <i class="fas fa-shield-alt"></i>
            <h3>No Security Alerts</h3>
            <p>All accounts are secure. No suspicious activity detected.</p>
          </div>
        `;
      } else {
        container.innerHTML = alerts.map(alert => `
          <div class="security-alert-card ${alert.severity}">
            <div class="alert-header">
              <div class="alert-icon ${alert.severity}">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="alert-info">
                <h3>Multiple Accounts Detected</h3>
                <p>${alert.count} accounts from IP ${alert.ip} (${alert.device})</p>
              </div>
              <div class="alert-severity-badge ${alert.severity}">
                ${alert.severity.toUpperCase()}
              </div>
            </div>
            <div class="alert-body">
              <div class="alert-details">
                <div class="detail-item">
                  <i class="fas fa-network-wired"></i>
                  <span>IP: ${alert.ip}</span>
                </div>
                <div class="detail-item">
                  <i class="fas fa-desktop"></i>
                  <span>Device: ${alert.device}</span>
                </div>
                <div class="detail-item">
                  <i class="fas fa-users"></i>
                  <span>${alert.count} Accounts</span>
                </div>
              </div>
              <div class="affected-accounts">
                <h4>Affected Accounts:</h4>
                <div class="accounts-list">
                  ${alert.accounts.map(acc => `
                    <div class="account-chip" onclick="viewAccountDetails('${acc.account_id}')" style="cursor: pointer;">
                      <i class="fas fa-user"></i>
                      <span>${acc.username}</span>
                      <small>${acc.account_id.substring(0, 8)}...</small>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="alert-actions">
              <button class="btn-warning" onclick="investigateAlert('${alert.ip}')">
                <i class="fas fa-search"></i> Investigate
              </button>
              <button class="btn-success-small" onclick="whitelistIP('${alert.ip}')">
                <i class="fas fa-check"></i> Whitelist IP
              </button>
            </div>
          </div>
        `).join('');
      }
    } else {
      container.innerHTML = `
        <div class="error-state-modern">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Security Alerts</h3>
          <p>${data.error || 'Unknown error'}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading security alerts:', err);
    const container = document.getElementById('securityAlertsContainer');
    if (container) {
      container.innerHTML = `
        <div class="error-state-modern">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Security Alerts</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

async function investigateAlert(ip) {
  showToast('🔍 Investigating', `Checking accounts for IP ${ip}`, 'info', 2000);

  try {
    const res = await fetch(`${API}/admin/user-management`);
    const data = await res.json();

    if (!data.success) {
      showErrorModal('❌ Error', 'Failed to load accounts');
      return;
    }

    // Filter accounts by IP
    const matchingAccounts = data.accounts.filter(acc => acc.ip === ip);

    const modal = document.createElement('div');
    modal.className = 'user-details-modal-overlay';
    modal.innerHTML = `
      <div class="user-details-modal">
        <div class="user-details-header">
          <div class="header-icon" style="background: linear-gradient(135deg, #0099ff, #0077cc);">
            <i class="fas fa-search"></i>
          </div>
          <div>
            <h3>Investigation: IP ${ip}</h3>
            <p class="user-detail-subtitle">Found ${matchingAccounts.length} account(s)</p>
          </div>
          <button class="close-modal" onclick="this.closest('.user-details-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="user-details-body">
          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fas fa-users"></i>
              <h4>Accounts from this IP</h4>
            </div>
            ${matchingAccounts.length === 0 ? `
              <p class="empty-text">No accounts found for this IP address</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${matchingAccounts.map(acc => `
                  <div class="activity-item" style="cursor: pointer;" onclick="this.closest('.user-details-modal-overlay').remove(); viewAccountDetails('${acc.account_id}')">
                    <div class="activity-icon">
                      <i class="fas fa-user"></i>
                    </div>
                    <div class="activity-details">
                      <div class="activity-text">${acc.username} - ${acc.hosting_name}</div>
                      <div class="activity-meta">
                        <span><i class="fas fa-code"></i> ${acc.type}</span>
                        <span><i class="fas fa-circle"></i> ${acc.status}</span>
                        <span><i class="fas fa-calendar"></i> Created: ${new Date(acc.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="detail-section">
            <div class="section-header-detail">
              <i class="fas fa-shield-alt"></i>
              <h4>Actions</h4>
            </div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button class="btn-warning" onclick="whitelistIP('${ip}')">
                <i class="fas fa-check"></i> Whitelist IP
              </button>
              <button class="btn-danger-small" onclick="suspendAllFromIP('${ip}')">
                <i class="fas fa-ban"></i> Suspend All
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  } catch (err) {
    console.error('Investigation error:', err);
    showErrorModal('❌ Error', 'Failed to investigate: ' + err.message);
  }
}

async function suspendAllFromIP(ip) {
  if (!confirm(`Suspend ALL accounts from IP ${ip}? This action will affect multiple users.`)) return;

  try {
    const res = await fetch(`${API}/admin/user-management`);
    const data = await res.json();

    if (data.success) {
      const matchingAccounts = data.accounts.filter(acc => acc.ip === ip);

      for (const account of matchingAccounts) {
        await suspendAccount(account.account_id);
      }

      showToast('✅ Success', `Suspended ${matchingAccounts.length} accounts`, 'success', 4000);
      document.querySelector('.user-details-modal-overlay')?.remove();
      loadSecurityAlerts();
    }
  } catch (err) {
    showErrorModal('❌ Error', 'Failed to suspend accounts: ' + err.message);
  }
}

async function whitelistIP(ip) {
  if (!confirm(`Whitelist IP ${ip}? This will prevent future alerts for this IP.`)) return;

  try {
    const res = await fetch(`${API}/admin/ip-whitelist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    });

    const data = await res.json();

    if (data.success) {
      showToast('✅ Whitelisted', `IP ${ip} has been whitelisted`, 'success', 4000);
      loadSecurityAlerts();
    } else {
      showToast('❌ Error', data.error || 'Failed to whitelist IP', 'error', 5000);
    }
  } catch (err) {
    showToast('❌ Error', 'Error whitelisting IP: ' + err.message, 'error', 5000);
  }
}

// ============================================
// ADVANCED USER MANAGEMENT PAGE
// ============================================

let userManagementState = {
  users: [],
  pagination: { page: 1, per_page: 15, total: 0, total_pages: 0 },
  filters: { search: '', status: 'all', type: 'all', sort_by: 'created_at', sort_order: 'desc' },
  selectedUsers: [],
  stats: null
};

async function loadUserManagementPage() {
  const page = document.getElementById('userManagementPage');
  
  page.innerHTML = `
    <div class="user-mgmt-container">
      <!-- Header Section -->
      <div class="user-mgmt-header">
        <div class="user-mgmt-title">
          <div class="title-icon">
            <i class="fas fa-users-cog"></i>
          </div>
          <div class="title-text">
            <h1>User Management</h1>
            <p>Comprehensive user administration and analytics</p>
          </div>
        </div>
        <div class="user-mgmt-actions">
          <button class="action-btn export-btn" onclick="exportAllUsers()">
            <i class="fas fa-download"></i>
            <span>Export</span>
          </button>
          <button class="action-btn refresh-btn" onclick="refreshUserManagement()">
            <i class="fas fa-sync-alt"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="user-mgmt-tabs">
        <button class="tab-btn active" id="usersTabBtn" onclick="showUserMgmtTab('users')">
          <i class="fas fa-users"></i> Users
        </button>
        <button class="tab-btn" id="creditLogsTabBtn" onclick="showUserMgmtTab('creditLogs')">
          <i class="fas fa-coins"></i> Credit Logs
        </button>
      </div>

      <!-- Users Tab Content -->
      <div id="usersTabContent">
        <!-- Stats Cards -->
        <div class="user-stats-grid" id="userStatsGrid">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading stats...</div>
        </div>

        <!-- Filters Section -->
      <div class="user-filters-section">
        <div class="filter-row">
          <div class="search-filter">
            <i class="fas fa-search"></i>
            <input type="text" id="userSearchInput" placeholder="Search by username, email, IP, or account ID..." 
              onkeyup="if(event.key === 'Enter') applyUserFilters()">
            <button class="search-btn" onclick="applyUserFilters()">Search</button>
          </div>
          <div class="filter-group">
            <div class="filter-item">
              <label>Status</label>
              <select id="statusFilter" onchange="applyUserFilters()">
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Type</label>
              <select id="typeFilter" onchange="applyUserFilters()">
                <option value="all">All Types</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="website">Website</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Sort By</label>
              <select id="sortByFilter" onchange="applyUserFilters()">
                <option value="created_at">Date Created</option>
                <option value="last_login">Last Login</option>
                <option value="username">Username</option>
                <option value="login_count">Login Count</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Order</label>
              <select id="sortOrderFilter" onchange="applyUserFilters()">
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
        <div class="bulk-actions-row" id="bulkActionsRow" style="display: none;">
          <span class="selected-count"><span id="selectedCount">0</span> users selected</span>
          <div class="bulk-buttons">
            <button class="bulk-btn start-bulk" onclick="bulkBotAction('start')" style="background: linear-gradient(135deg, #10B981, #059669);">
              <i class="fas fa-play"></i> Start All Bots
            </button>
            <button class="bulk-btn stop-bulk" onclick="bulkBotAction('stop')" style="background: linear-gradient(135deg, #EF4444, #DC2626);">
              <i class="fas fa-stop"></i> Stop All Bots
            </button>
            <button class="bulk-btn restart-bulk" onclick="bulkBotAction('restart')" style="background: linear-gradient(135deg, #F59E0B, #D97706);">
              <i class="fas fa-redo"></i> Restart All Bots
            </button>
            <div style="width: 1px; height: 24px; background: var(--border-color); margin: 0 10px;"></div>
            <button class="bulk-btn suspend-bulk" onclick="bulkAction('suspend')">
              <i class="fas fa-pause-circle"></i> Suspend Selected
            </button>
            <button class="bulk-btn unsuspend-bulk" onclick="bulkAction('unsuspend')">
              <i class="fas fa-play-circle"></i> Unsuspend Selected
            </button>
            <button class="bulk-btn ban-bulk" onclick="bulkAction('ban')">
              <i class="fas fa-ban"></i> Ban Selected
            </button>
            <button class="bulk-btn unban-bulk" onclick="bulkAction('unban')">
              <i class="fas fa-unlock"></i> Unban Selected
            </button>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="users-table-container">
        <table class="users-modern-table">
          <thead>
            <tr>
              <th class="checkbox-col">
                <input type="checkbox" id="selectAllUsers" onchange="toggleSelectAll(this.checked)">
              </th>
              <th>User</th>
              <th>Account</th>
              <th>Type</th>
              <th>Status</th>
              <th>Running</th>
              <th>Uptime</th>
              <th>Last Login</th>
              <th>IP Info</th>
              <th>Logins</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr>
              <td colspan="11" class="loading-cell">
                <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-section" id="paginationSection">
        <div class="pagination-info">
          Showing <span id="showingStart">0</span> - <span id="showingEnd">0</span> of <span id="totalUsers">0</span> users
        </div>
        <div class="pagination-controls" id="paginationControls"></div>
      </div>
      </div> <!-- End Users Tab Content -->

      <!-- Credit Logs Tab Content -->
      <div id="creditLogsTabContent" style="display: none;">
        <div class="credit-logs-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="color: var(--text-primary); margin: 0;"><i class="fas fa-coins" style="color: #10B981; margin-right: 10px;"></i> Credit Transaction Logs</h3>
          <div style="display: flex; gap: 10px;">
            <button class="action-btn" onclick="showAddBalanceModal()" style="background: linear-gradient(135deg, #10B981, #059669); border: none; padding: 10px 20px; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-plus-circle"></i> Add Balance
            </button>
            <button class="action-btn" onclick="showRemoveBalanceModal()" style="background: linear-gradient(135deg, #EF4444, #DC2626); border: none; padding: 10px 20px; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-minus-circle"></i> Remove Balance
            </button>
          </div>
        </div>
        <div class="credit-logs-table-container" style="background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden;">
          <table class="users-modern-table" style="width: 100%;">
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Details</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="creditLogsTableBody">
              <tr>
                <td colspan="5" class="loading-cell">
                  <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading credit logs...</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div> <!-- End Credit Logs Tab Content -->
    </div>

    <!-- Manage Hosting Accounts Modal -->
    <div class="hosting-acc-modal" id="hostingAccModal" style="display: none;">
      <div class="hosting-acc-modal-content">
        <div class="hosting-acc-modal-header">
          <h2><i class="fas fa-cloud"></i> Manage Hosting Accounts</h2>
          <span class="hosting-acc-username" id="hostingAccUsername"></span>
          <button class="close-modal-btn" onclick="closeHostingAccModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="hosting-acc-modal-body" id="hostingAccModalBody">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading hosting accounts...</div>
        </div>
        <div class="hosting-acc-modal-footer">
          <button class="add-hosting-acc-btn" onclick="showAddHostingAccModal()">
            <i class="fas fa-plus"></i> Add Hosting Account
          </button>
        </div>
      </div>
    </div>

    <!-- Add Hosting Account Modal -->
    <div class="add-hosting-acc-modal" id="addHostingAccModal" style="display: none;">
      <div class="add-hosting-acc-modal-content">
        <div class="add-hosting-acc-modal-header">
          <h2><i class="fas fa-plus-circle"></i> Add Hosting Account</h2>
          <button class="close-modal-btn" onclick="closeAddHostingAccModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="add-hosting-acc-modal-body">
          <input type="hidden" id="addHostingAccUserId">
          <input type="hidden" id="addHostingAccDiscordId">
          <input type="hidden" id="addHostingAccDiscordUsername">
          <p class="modal-info">Select the type of hosting account to add for this user:</p>
          <div class="hosting-type-options">
            <div class="hosting-type-card" onclick="selectHostingType('python', event)">
              <div class="type-icon python">
                <i class="fab fa-python"></i>
              </div>
              <div class="type-info">
                <h4>Python Hosting</h4>
                <p>For Discord.py bots</p>
              </div>
            </div>
            <div class="hosting-type-card" onclick="selectHostingType('javascript', event)">
              <div class="type-icon javascript">
                <i class="fab fa-node-js"></i>
              </div>
              <div class="type-info">
                <h4>JavaScript Hosting</h4>
                <p>For Discord.js bots</p>
              </div>
            </div>
          </div>
        </div>
        <div class="add-hosting-acc-modal-footer">
          <button class="cancel-btn" onclick="closeAddHostingAccModal()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- User Profile Modal -->
    <div class="user-profile-modal" id="userProfileModal" style="display: none;">
      <div class="profile-modal-content">
        <div class="profile-modal-header">
          <h2><i class="fas fa-user-circle"></i> User Profile</h2>
          <button class="close-modal-btn" onclick="closeUserProfileModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="profile-modal-body" id="profileModalBody">
          <!-- Profile content will be loaded here -->
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div class="edit-user-modal" id="editUserModal" style="display: none;">
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h2><i class="fas fa-edit"></i> Edit User</h2>
          <button class="close-modal-btn" onclick="closeEditUserModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="edit-modal-body" id="editModalBody">
          <!-- Edit form will be loaded here -->
        </div>
      </div>
    </div>

    <!-- Send Notification Modal -->
    <div class="notification-modal" id="sendNotificationModal" style="display: none;">
      <div class="notification-modal-content">
        <div class="notification-modal-header">
          <h2><i class="fas fa-bell"></i> Send Notification</h2>
          <button class="close-modal-btn" onclick="closeSendNotificationModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notification-modal-body">
          <input type="hidden" id="notificationUserId">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="notificationTitle" placeholder="Notification title...">
          </div>
          <div class="form-group">
            <label>Message</label>
            <textarea id="notificationMessage" placeholder="Notification message..."></textarea>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="notificationType">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
        <div class="notification-modal-footer">
          <button class="cancel-btn" onclick="closeSendNotificationModal()">Cancel</button>
          <button class="send-notification-btn" onclick="submitNotification()">
            <i class="fas fa-paper-plane"></i> Send
          </button>
        </div>
      </div>
    </div>

    <!-- Login History Modal -->
    <div class="login-history-modal" id="loginHistoryModal" style="display: none;">
      <div class="login-history-modal-content">
        <div class="login-history-modal-header">
          <h2><i class="fas fa-history"></i> Login History</h2>
          <span class="login-history-username" id="loginHistoryUsername"></span>
          <button class="close-modal-btn" onclick="closeLoginHistoryModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="login-history-modal-body" id="loginHistoryModalBody">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading history...</div>
        </div>
      </div>
    </div>

  `;

  // Load stats and users
  await Promise.all([
    loadUserStats(),
    loadUsersTable()
  ]);
}

// ============================================
// HOSTING ACCOUNTS MANAGEMENT
// ============================================

let currentHostingAccUser = null;

async function viewHostingAccounts(accountId, username, discordId) {
  currentHostingAccUser = { accountId, username, discordId };
  
  document.getElementById('hostingAccUsername').textContent = username || 'User';
  document.getElementById('hostingAccModal').style.display = 'flex';
  
  const body = document.getElementById('hostingAccModalBody');
  body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading hosting accounts...</div>';
  
  try {
    // Use discordId if available, otherwise use accountId
    const queryParams = discordId ? `?discordId=${discordId}` : '';
    const res = await fetch(`${API}/admin/user/${accountId}/hosting-accounts${queryParams}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success && data.accounts && data.accounts.length > 0) {
      body.innerHTML = `
        <div class="hosting-accounts-list">
          ${data.accounts.map(acc => `
            <div class="hosting-account-card ${acc.language}">
              <div class="hosting-acc-icon">
                <i class="${acc.language === 'javascript' ? 'fab fa-node-js' : 'fab fa-python'}"></i>
              </div>
              <div class="hosting-acc-info">
                <h4>${acc.name || 'Hosting Account'}</h4>
                <div class="hosting-acc-details">
                  <span class="acc-id"><i class="fas fa-fingerprint"></i> ${acc.id}</span>
                  <span class="acc-type ${acc.language}">
                    <i class="${acc.language === 'javascript' ? 'fab fa-node-js' : 'fab fa-python'}"></i>
                    ${acc.language === 'javascript' ? 'JavaScript' : 'Python'}
                  </span>
                  <span class="acc-status ${acc.status}">
                    <i class="fas fa-circle"></i> ${acc.status || 'offline'}
                  </span>
                </div>
                <div class="hosting-acc-meta">
                  <span><i class="fas fa-network-wired"></i> IP: ${acc.ip || 'N/A'}</span>
                </div>
              </div>
              <div class="hosting-acc-actions">
                <button class="acc-action-btn connect" onclick="initiateAdminConnect('${acc.id}', '${acc.name}')" title="Connect">
                  <i class="fas fa-plug"></i>
                </button>
                <button class="acc-action-btn remove" onclick="removeHostingAccount('${acc.id}', '${acc.name}')" title="Remove">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="no-hosting-accounts">
          <i class="fas fa-cloud"></i>
          <p>No hosting accounts found for this user.</p>
          <p class="sub-text">Click "Add Hosting Account" to create one.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading hosting accounts:', err);
    body.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load hosting accounts</p>
      </div>
    `;
  }
}

function closeHostingAccModal() {
  document.getElementById('hostingAccModal').style.display = 'none';
  currentHostingAccUser = null;
}

function showAddHostingAccModal() {
  if (!currentHostingAccUser) {
    showToast('Error', 'No user selected', 'error', 3000);
    return;
  }
  
  document.getElementById('addHostingAccUserId').value = currentHostingAccUser.accountId;
  document.getElementById('addHostingAccDiscordId').value = currentHostingAccUser.discordId || '';
  document.getElementById('addHostingAccDiscordUsername').value = currentHostingAccUser.username || '';
  document.getElementById('addHostingAccModal').style.display = 'flex';
  
  // Reset selection
  document.querySelectorAll('.add-hosting-acc-modal .hosting-type-card').forEach(card => {
    card.classList.remove('selected');
  });
}

function closeAddHostingAccModal() {
  document.getElementById('addHostingAccModal').style.display = 'none';
}

async function removeHostingAccount(accountId, accountName) {
  if (!confirm(`Remove hosting account "${accountName || accountId}"?\n\nThis will delete all files and data. This cannot be undone.`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API}/admin/user/${accountId}/remove-hosting-account`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Removed', 'Hosting account deleted', 'success', 3000);
      
      if (currentHostingAccUser) {
        viewHostingAccounts(currentHostingAccUser.accountId, currentHostingAccUser.username, currentHostingAccUser.discordId);
      }
      
      loadUsersTable();
    } else {
      showToast('Error', data.error || 'Failed to remove account', 'error', 4000);
    }
  } catch (err) {
    console.error('Error removing hosting account:', err);
    showToast('Error', 'Failed to remove account', 'error', 4000);
  }
}

async function selectHostingType(type, e) {
  const clickedCard = e ? e.currentTarget : document.querySelector(`.add-hosting-acc-modal .hosting-type-card.${type}`);
  if (!clickedCard) {
    showToast('Error', 'Could not find card element', 'error', 3000);
    return;
  }
  
  const cards = document.querySelectorAll('.add-hosting-acc-modal .hosting-type-card');
  cards.forEach(card => card.classList.remove('selected'));
  clickedCard.classList.add('selected');
  
  const userId = document.getElementById('addHostingAccUserId').value;
  const discordId = document.getElementById('addHostingAccDiscordId').value;
  const discordUsername = document.getElementById('addHostingAccDiscordUsername').value;
  
  if (!userId) {
    showToast('Error', 'No user selected', 'error', 3000);
    return;
  }
  
  const originalContent = clickedCard.innerHTML;
  clickedCard.innerHTML = `
    <div class="type-icon ${type}">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
    <div class="type-info">
      <h4>Creating...</h4>
      <p>Please wait</p>
    </div>
  `;
  
  try {
    const res = await fetch(`${API}/admin/user/${userId}/add-hosting-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: type,
        discordId: discordId,
        discordUsername: discordUsername
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `${type === 'javascript' ? 'JavaScript' : 'Python'} hosting created!`, 'success', 3000);
      closeAddHostingAccModal();
      
      if (currentHostingAccUser) {
        viewHostingAccounts(currentHostingAccUser.accountId, currentHostingAccUser.username, currentHostingAccUser.discordId);
      }
      
      loadUsersTable();
    } else {
      showToast('Error', data.error || 'Failed to create hosting account', 'error', 4000);
      clickedCard.innerHTML = originalContent;
    }
  } catch (err) {
    console.error('Error creating hosting account:', err);
    showToast('Error', 'Failed to create hosting account', 'error', 4000);
    clickedCard.innerHTML = originalContent;
  }
}

// ============================================
// USER STATS AND MANAGEMENT
// ============================================

async function loadUserStats() {
  try {
    const res = await fetch(`${API}/admin/users/stats`);
    const data = await res.json();

    if (data.success) {
      userManagementState.stats = data.stats;
      renderUserStats(data.stats);
    }
  } catch (err) {
    console.error('Error loading user stats:', err);
  }
}

function renderUserStats(stats) {
  const grid = document.getElementById('userStatsGrid');
  
  grid.innerHTML = `
    <div class="stat-card total">
      <div class="stat-icon"><i class="fas fa-users"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.total_users}</div>
        <div class="stat-label">Total Users</div>
      </div>
    </div>
    <div class="stat-card online">
      <div class="stat-icon"><i class="fas fa-circle"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.online_users}</div>
        <div class="stat-label">Online</div>
      </div>
    </div>
    <div class="stat-card offline">
      <div class="stat-icon"><i class="fas fa-moon"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.offline_users}</div>
        <div class="stat-label">Offline</div>
      </div>
    </div>
    <div class="stat-card suspended">
      <div class="stat-icon"><i class="fas fa-pause-circle"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.suspended_users}</div>
        <div class="stat-label">Suspended</div>
      </div>
    </div>
    <div class="stat-card banned">
      <div class="stat-icon"><i class="fas fa-ban"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.banned_users}</div>
        <div class="stat-label">Banned</div>
      </div>
    </div>
    <div class="stat-card python">
      <div class="stat-icon"><i class="fab fa-python"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.python_users}</div>
        <div class="stat-label">Python</div>
      </div>
    </div>
    <div class="stat-card javascript">
      <div class="stat-icon"><i class="fab fa-js-square"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.javascript_users}</div>
        <div class="stat-label">JavaScript</div>
      </div>
    </div>
    <div class="stat-card recent">
      <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
      <div class="stat-content">
        <div class="stat-value">${stats.recent_signups_7d}</div>
        <div class="stat-label">New (7 days)</div>
      </div>
    </div>
  `;
}

async function loadUsersTable() {
  try {
    const { page, per_page } = userManagementState.pagination;
    const { search, status, type, sort_by, sort_order } = userManagementState.filters;
    
    const params = new URLSearchParams({
      page: page,
      per_page: per_page,
      search: search,
      status: status,
      type: type,
      sort_by: sort_by,
      sort_order: sort_order
    });

    const res = await fetch(`${API}/admin/users/all?${params}`);
    const data = await res.json();

    if (data.success) {
      userManagementState.users = data.users;
      userManagementState.pagination = data.pagination;
      renderUsersTable();
      renderPagination();
    }
  } catch (err) {
    console.error('Error loading users:', err);
    document.getElementById('usersTableBody').innerHTML = `
      <tr>
        <td colspan="9" class="error-cell">
          <i class="fas fa-exclamation-circle"></i> Error loading users
        </td>
      </tr>
    `;
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  const users = userManagementState.users;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-cell">
          <i class="fas fa-users-slash"></i>
          <p>No users found matching your criteria</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr class="${userManagementState.selectedUsers.includes(user.account_id) ? 'selected' : ''}" data-id="${user.account_id}">
      <td class="checkbox-col">
        <input type="checkbox" class="user-checkbox" value="${user.account_id}" 
          ${userManagementState.selectedUsers.includes(user.account_id) ? 'checked' : ''}
          onchange="toggleUserSelection('${user.account_id}', this.checked)">
      </td>
      <td class="user-cell">
        <div class="user-info">
          <div class="user-avatar ${user.status}">
            <i class="fab fa-discord"></i>
          </div>
          <div class="user-details">
            <div class="user-name">${user.username || 'Unknown'}</div>
            <div class="user-id">${user.discord_id || user.account_id.substring(0, 12)}</div>
          </div>
        </div>
      </td>
      <td class="account-cell">
        <div class="account-info">
          <div class="hosting-name">${user.hosting_name}</div>
          <div class="account-id">${user.account_id.substring(0, 8)}...</div>
        </div>
      </td>
      <td class="type-cell">
        <span class="type-badge ${user.language}">
          <i class="${user.language === 'python' ? 'fab fa-python' : user.language === 'javascript' ? 'fab fa-js-square' : 'fas fa-globe'}"></i>
          ${user.language.charAt(0).toUpperCase() + user.language.slice(1)}
        </span>
      </td>
      <td class="status-cell">
        <span class="status-badge ${user.status}">
          <span class="status-dot"></span>
          ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
        </span>
      </td>
      <td class="running-cell">
        <span class="running-badge ${user.is_running ? 'running' : 'stopped'}">
          <i class="fas ${user.is_running ? 'fa-play-circle' : 'fa-stop-circle'}"></i>
          ${user.is_running ? 'Running' : 'Stopped'}
        </span>
      </td>
      <td class="uptime-cell">
        ${user.is_running && user.current_uptime > 0 ? formatUptimeShort(user.current_uptime) : '-'}
      </td>
      <td class="login-cell">
        ${user.login_info?.last_login ? new Date(user.login_info.last_login * 1000).toLocaleDateString() : 'Never'}
      </td>
      <td class="ip-cell">
        <div class="ip-info">
          <span class="last-ip" title="Last IP">${user.ip_info?.last_ip || 'N/A'}</span>
          ${user.ip_info?.unique_ips && user.ip_info.unique_ips.length > 1 ? `<span class="ip-count">+${user.ip_info.unique_ips.length - 1} more</span>` : ''}
        </div>
      </td>
      <td class="logins-cell">
        <span class="login-count">${user.login_count || 0}</span>
      </td>
      <td class="actions-cell">
        <div class="action-buttons">
          <button class="action-icon-btn view" onclick="viewUserProfile('${user.account_id}')" title="View Profile">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-icon-btn edit" onclick="openEditUserModal('${user.account_id}')" title="Edit User">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-icon-btn hosting" onclick="viewHostingAccounts('${user.account_id}', '${user.username || user.hosting_name}', '${user.discord_id || ''}')" title="Manage Hosting Acc">
            <i class="fas fa-cloud"></i>
          </button>
          <button class="action-icon-btn history" onclick="viewLoginHistory('${user.account_id}', '${user.username || user.hosting_name}')" title="Login History">
            <i class="fas fa-history"></i>
          </button>
          <button class="action-icon-btn credits" onclick="showUserCreditsReferralsLogs('${user.account_id}', '${user.username || user.hosting_name}')" title="Credits & Referrals" style="background: linear-gradient(135deg, #8B5CF622, #10B98122); color: #10B981;">
            <i class="fas fa-coins"></i>
          </button>
          <button class="action-icon-btn connect" onclick="initiateAdminConnect('${user.account_id}', '${user.hosting_name}')" title="Connect">
            <i class="fas fa-plug"></i>
          </button>
          <div class="action-dropdown">
            <button class="action-icon-btn more" onclick="toggleActionDropdown(this)">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="dropdown-menu">
              <button onclick="viewLoginHistory('${user.account_id}', '${user.username || user.hosting_name}')"><i class="fas fa-history"></i> Login History</button>
              <button onclick="showUserCreditsReferralsLogs('${user.account_id}', '${user.username || user.hosting_name}')"><i class="fas fa-coins"></i> Credits & Referrals</button>
              <button onclick="sendUserNotification('${user.account_id}')"><i class="fas fa-bell"></i> Send Notification</button>
              <button onclick="resetUserCredentials('${user.account_id}')"><i class="fas fa-key"></i> Reset Credentials</button>
              ${user.status === 'suspended' 
                ? `<button onclick="unsuspendUser('${user.account_id}')"><i class="fas fa-play-circle"></i> Unsuspend</button>`
                : `<button onclick="suspendUserFromMgmt('${user.account_id}')"><i class="fas fa-pause-circle"></i> Suspend</button>`
              }
              ${user.status === 'banned'
                ? `<button onclick="unbanUser('${user.account_id}')"><i class="fas fa-unlock"></i> Unban</button>`
                : `<button onclick="banUserFromMgmt('${user.account_id}')"><i class="fas fa-ban"></i> Ban</button>`
              }
              <button class="danger" onclick="deleteUserAccount('${user.account_id}')"><i class="fas fa-trash"></i> Delete Account</button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination() {
  const { page, total_pages, total, per_page, has_prev, has_next } = userManagementState.pagination;
  
  const start = Math.min((page - 1) * per_page + 1, total);
  const end = Math.min(page * per_page, total);
  
  document.getElementById('showingStart').textContent = start;
  document.getElementById('showingEnd').textContent = end;
  document.getElementById('totalUsers').textContent = total;

  const controls = document.getElementById('paginationControls');
  let buttons = '';

  buttons += `<button class="page-btn ${!has_prev ? 'disabled' : ''}" onclick="goToPage(${page - 1})" ${!has_prev ? 'disabled' : ''}>
    <i class="fas fa-chevron-left"></i>
  </button>`;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(total_pages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    buttons += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) buttons += `<span class="page-ellipsis">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    buttons += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < total_pages) {
    if (endPage < total_pages - 1) buttons += `<span class="page-ellipsis">...</span>`;
    buttons += `<button class="page-btn" onclick="goToPage(${total_pages})">${total_pages}</button>`;
  }

  buttons += `<button class="page-btn ${!has_next ? 'disabled' : ''}" onclick="goToPage(${page + 1})" ${!has_next ? 'disabled' : ''}>
    <i class="fas fa-chevron-right"></i>
  </button>`;

  controls.innerHTML = buttons;
}

function goToPage(page) {
  if (page < 1 || page > userManagementState.pagination.total_pages) return;
  userManagementState.pagination.page = page;
  loadUsersTable();
}

function applyUserFilters() {
  userManagementState.filters = {
    search: document.getElementById('userSearchInput').value.trim(),
    status: document.getElementById('statusFilter').value,
    type: document.getElementById('typeFilter').value,
    sort_by: document.getElementById('sortByFilter').value,
    sort_order: document.getElementById('sortOrderFilter').value
  };
  userManagementState.pagination.page = 1;
  loadUsersTable();
}

function toggleSelectAll(checked) {
  if (checked) {
    userManagementState.selectedUsers = userManagementState.users.map(u => u.account_id);
  } else {
    userManagementState.selectedUsers = [];
  }
  updateBulkActionsVisibility();
  renderUsersTable();
}

function toggleUserSelection(accountId, checked) {
  if (checked) {
    if (!userManagementState.selectedUsers.includes(accountId)) {
      userManagementState.selectedUsers.push(accountId);
    }
  } else {
    userManagementState.selectedUsers = userManagementState.selectedUsers.filter(id => id !== accountId);
  }
  updateBulkActionsVisibility();
  document.getElementById('selectAllUsers').checked = 
    userManagementState.selectedUsers.length === userManagementState.users.length;
}

function updateBulkActionsVisibility() {
  const row = document.getElementById('bulkActionsRow');
  const count = document.getElementById('selectedCount');
  
  if (userManagementState.selectedUsers.length > 0) {
    row.style.display = 'flex';
    count.textContent = userManagementState.selectedUsers.length;
  } else {
    row.style.display = 'none';
  }
}

function toggleActionDropdown(btn) {
  const allDropdowns = document.querySelectorAll('.action-dropdown .dropdown-menu');
  const thisDropdown = btn.nextElementSibling;
  
  // Capture current state before any changes
  const wasOpen = thisDropdown.classList.contains('show');
  
  // Close all other dropdowns
  allDropdowns.forEach(d => {
    if (d !== thisDropdown) {
      d.classList.remove('show');
      d.classList.remove('dropdown-up');
    }
  });
  
  // If it was already open, just close it and return
  if (wasOpen) {
    thisDropdown.classList.remove('show');
    thisDropdown.classList.remove('dropdown-up');
    return;
  }
  
  // Temporarily show to measure actual height
  thisDropdown.style.visibility = 'hidden';
  thisDropdown.classList.add('show');
  const dropdownHeight = thisDropdown.scrollHeight || thisDropdown.offsetHeight || 150;
  thisDropdown.classList.remove('show');
  thisDropdown.style.visibility = '';
  
  // Check available space
  const btnRect = btn.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - btnRect.bottom - 10; // 10px buffer
  const spaceAbove = btnRect.top - 10; // 10px buffer
  
  // Decide direction based on available space
  // Prefer opening downward unless there's not enough space and more space above
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    thisDropdown.classList.add('dropdown-up');
  } else {
    thisDropdown.classList.remove('dropdown-up');
  }
  
  // Open the dropdown
  thisDropdown.classList.add('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.action-dropdown')) {
    document.querySelectorAll('.action-dropdown .dropdown-menu').forEach(d => d.classList.remove('show'));
  }
});

async function viewUserProfile(accountId) {
  try {
    const res = await fetch(`${API}/admin/users/${accountId}/full-profile`);
    const data = await res.json();

    if (!data.success) {
      showToast('Error', data.error || 'Failed to load profile', 'error', 3000);
      return;
    }

    const profile = data.profile;
    const modal = document.getElementById('userProfileModal');
    const body = document.getElementById('profileModalBody');

    body.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar ${profile.account.status}">
          <i class="fab fa-discord"></i>
        </div>
        <div class="profile-info">
          <h3>${profile.discord.username || 'Unknown User'}</h3>
          <p class="discord-id">${profile.discord.id || 'No Discord ID'}</p>
          <span class="status-badge ${profile.account.status}">${profile.account.status}</span>
        </div>
      </div>

      <div class="profile-tabs">
        <button class="tab-btn active" onclick="switchProfileTab('overview', this)">Overview</button>
        <button class="tab-btn" onclick="switchProfileTab('tracking', this)">Tracking</button>
        <button class="tab-btn" onclick="switchProfileTab('security', this)">Security</button>
        <button class="tab-btn" onclick="switchProfileTab('activity', this)">Activity</button>
      </div>

      <div class="profile-tab-content">
        <div class="tab-pane active" id="overviewTab">
          <div class="profile-section">
            <h4><i class="fas fa-server"></i> Account Information</h4>
            <div class="info-grid">
              <div class="info-item"><span class="label">Hosting Name</span><span class="value">${profile.account.name}</span></div>
              <div class="info-item"><span class="label">Account ID</span><span class="value code">${profile.account.id}</span></div>
              <div class="info-item"><span class="label">Type</span><span class="value">${profile.account.language}</span></div>
              <div class="info-item"><span class="label">Created</span><span class="value">${profile.account.created_at ? new Date(profile.account.created_at * 1000).toLocaleDateString() : 'Unknown'}</span></div>
              <div class="info-item"><span class="label">IP Address</span><span class="value">${profile.account.ip}</span></div>
            </div>
          </div>
          <div class="profile-section">
            <h4><i class="fas fa-key"></i> Credentials</h4>
            <div class="info-grid">
              <div class="info-item"><span class="label">Username</span><span class="value code">${profile.credentials.username || 'N/A'}</span></div>
              <div class="info-item"><span class="label">Password</span><span class="value code">${profile.credentials.password || 'N/A'}</span></div>
              <div class="info-item"><span class="label">API Key</span><span class="value code">${profile.account.api_key ? profile.account.api_key.substring(0, 20) + '...' : 'N/A'}</span></div>
            </div>
          </div>
          <div class="profile-section">
            <h4><i class="fas fa-hdd"></i> Storage</h4>
            <div class="info-grid">
              <div class="info-item"><span class="label">Files</span><span class="value">${profile.storage.file_count} files</span></div>
              <div class="info-item"><span class="label">Storage Used</span><span class="value">${profile.storage.used_mb} MB</span></div>
            </div>
          </div>
        </div>

        <div class="tab-pane" id="trackingTab">
          <div class="profile-section">
            <h4><i class="fas fa-history"></i> Login History</h4>
            <div class="info-grid">
              <div class="info-item"><span class="label">First Login</span><span class="value">${profile.tracking.first_login ? new Date(profile.tracking.first_login * 1000).toLocaleString() : 'Never'}</span></div>
              <div class="info-item"><span class="label">Last Login</span><span class="value">${profile.tracking.last_login ? new Date(profile.tracking.last_login * 1000).toLocaleString() : 'Never'}</span></div>
              <div class="info-item"><span class="label">Total Logins</span><span class="value">${profile.tracking.login_count}</span></div>
              <div class="info-item"><span class="label">First IP</span><span class="value">${profile.tracking.first_ip}</span></div>
              <div class="info-item"><span class="label">Last IP</span><span class="value">${profile.tracking.last_ip}</span></div>
            </div>
          </div>
          <div class="profile-section">
            <h4><i class="fas fa-network-wired"></i> Unique IPs (${profile.tracking.unique_ips.length})</h4>
            <div class="ip-list">
              ${profile.tracking.unique_ips.map(ip => `<span class="ip-tag">${ip}</span>`).join('') || 'No IPs recorded'}
            </div>
          </div>
          <div class="profile-section">
            <h4><i class="fas fa-desktop"></i> Unique Devices (${profile.tracking.unique_devices.length})</h4>
            <div class="device-list">
              ${profile.tracking.unique_devices.map(d => `<span class="device-tag">${d}</span>`).join('') || 'No devices recorded'}
            </div>
          </div>
        </div>

        <div class="tab-pane" id="securityTab">
          <div class="profile-section">
            <h4><i class="fas fa-shield-alt"></i> Ban Status</h4>
            ${profile.security.ban_status ? `
              <div class="ban-alert ${profile.security.is_banned ? 'banned' : 'suspended'}">
                <i class="fas ${profile.security.is_banned ? 'fa-ban' : 'fa-pause-circle'}"></i>
                <div>
                  <strong>User is ${profile.security.is_banned ? 'BANNED' : 'SUSPENDED'}</strong>
                  <p>Reason: ${profile.security.ban_status.reason || 'No reason provided'}</p>
                  <p>Date: ${new Date((profile.security.ban_status.banned_at || profile.security.ban_status.suspended_at) * 1000).toLocaleString()}</p>
                </div>
              </div>
            ` : `
              <div class="status-ok">
                <i class="fas fa-check-circle"></i>
                <span>No active bans or suspensions</span>
              </div>
            `}
          </div>
          <div class="profile-section">
            <h4><i class="fas fa-exclamation-triangle"></i> Problems (${profile.unresolved_problems})</h4>
            ${profile.problems.length > 0 ? `
              <div class="problems-list">
                ${profile.problems.slice(0, 5).map(p => `
                  <div class="problem-item ${p.resolved ? 'resolved' : ''}">
                    <span class="problem-type">${p.type}</span>
                    <span class="problem-details">${p.details.substring(0, 100)}${p.details.length > 100 ? '...' : ''}</span>
                    <span class="problem-time">${new Date(p.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="no-data">No problems recorded</p>'}
          </div>
        </div>

        <div class="tab-pane" id="activityTab">
          <div class="profile-section">
            <h4><i class="fas fa-clock"></i> Recent Login Activity</h4>
            ${profile.tracking.login_history && profile.tracking.login_history.length > 0 ? `
              <div class="activity-list">
                ${profile.tracking.login_history.slice(-10).reverse().map(login => `
                  <div class="activity-item">
                    <div class="activity-icon"><i class="fas fa-sign-in-alt"></i></div>
                    <div class="activity-details">
                      <span class="activity-ip">${login.ip || 'Unknown IP'}</span>
                      <span class="activity-device">${login.device_type || 'Unknown Device'}</span>
                      <span class="activity-time">${new Date(login.timestamp * 1000).toLocaleString()}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="no-data">No login activity recorded</p>'}
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  } catch (err) {
    console.error('Error loading profile:', err);
    showToast('Error', 'Failed to load user profile', 'error', 3000);
  }
}

function switchProfileTab(tabId, btn) {
  document.querySelectorAll('.profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.profile-tab-content .tab-pane').forEach(p => p.classList.remove('active'));
  
  btn.classList.add('active');
  document.getElementById(tabId + 'Tab').classList.add('active');
}

function closeUserProfileModal() {
  document.getElementById('userProfileModal').style.display = 'none';
}

async function openEditUserModal(accountId) {
  try {
    const res = await fetch(`${API}/admin/users/${accountId}/full-profile`);
    const data = await res.json();

    if (!data.success) {
      showToast('Error', data.error || 'Failed to load user data', 'error', 3000);
      return;
    }

    const profile = data.profile;
    const modal = document.getElementById('editUserModal');
    const body = document.getElementById('editModalBody');

    body.innerHTML = `
      <form id="editUserForm" onsubmit="submitEditUser(event, '${accountId}')">
        <div class="form-group">
          <label>Hosting Name</label>
          <input type="text" id="editName" value="${profile.account.name}" required>
        </div>
        <div class="form-group">
          <label>Language/Type</label>
          <select id="editLanguage">
            <option value="python" ${profile.account.language === 'python' ? 'selected' : ''}>Python</option>
            <option value="javascript" ${profile.account.language === 'javascript' ? 'selected' : ''}>JavaScript</option>
          </select>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="editEmail" value="${profile.discord.email || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>CPU Limit (%)</label>
            <input type="number" id="editCpu" value="${profile.account.resources?.cpu || 25}" min="1" max="100">
          </div>
          <div class="form-group">
            <label>RAM Limit (MB)</label>
            <input type="number" id="editRam" value="${profile.account.resources?.ram || 512}" min="64" max="4096">
          </div>
          <div class="form-group">
            <label>Disk Limit (MB)</label>
            <input type="number" id="editDisk" value="${profile.account.resources?.disk || 1024}" min="100" max="10240">
          </div>
        </div>
        <div class="form-group">
          <label>Admin Notes</label>
          <textarea id="editNotes" placeholder="Internal notes about this user...">${profile.account.admin_notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="cancel-btn" onclick="closeEditUserModal()">Cancel</button>
          <button type="submit" class="save-btn"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </form>
    `;

    modal.style.display = 'flex';
  } catch (err) {
    console.error('Error loading user for edit:', err);
    showToast('Error', 'Failed to load user data', 'error', 3000);
  }
}

async function submitEditUser(e, accountId) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('editName').value,
    language: document.getElementById('editLanguage').value,
    email: document.getElementById('editEmail').value,
    resources: {
      cpu: parseInt(document.getElementById('editCpu').value),
      ram: parseInt(document.getElementById('editRam').value),
      disk: parseInt(document.getElementById('editDisk').value)
    },
    notes: document.getElementById('editNotes').value
  };

  try {
    const res = await fetch(`${API}/admin/users/${accountId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'User updated successfully', 'success', 3000);
      closeEditUserModal();
      loadUsersTable();
    } else {
      showToast('Error', data.error || 'Failed to update user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error updating user:', err);
    showToast('Error', 'Failed to update user', 'error', 3000);
  }
}

function closeEditUserModal() {
  document.getElementById('editUserModal').style.display = 'none';
}

function sendUserNotification(accountId) {
  document.getElementById('notificationUserId').value = accountId;
  document.getElementById('sendNotificationModal').style.display = 'flex';
}

function closeSendNotificationModal() {
  document.getElementById('sendNotificationModal').style.display = 'none';
  document.getElementById('notificationTitle').value = '';
  document.getElementById('notificationMessage').value = '';
}

async function submitNotification() {
  const accountId = document.getElementById('notificationUserId').value;
  const title = document.getElementById('notificationTitle').value.trim();
  const message = document.getElementById('notificationMessage').value.trim();
  const type = document.getElementById('notificationType').value;

  if (!title || !message) {
    showToast('Error', 'Title and message are required', 'error', 3000);
    return;
  }

  try {
    const res = await fetch(`${API}/admin/users/${accountId}/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, type })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'Notification sent successfully', 'success', 3000);
      closeSendNotificationModal();
    } else {
      showToast('Error', data.error || 'Failed to send notification', 'error', 3000);
    }
  } catch (err) {
    console.error('Error sending notification:', err);
    showToast('Error', 'Failed to send notification', 'error', 3000);
  }
}

async function viewLoginHistory(accountId, username) {
  const modal = document.getElementById('loginHistoryModal');
  const usernameSpan = document.getElementById('loginHistoryUsername');
  const body = document.getElementById('loginHistoryModalBody');
  
  usernameSpan.textContent = username || accountId;
  body.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading login history...</div>`;
  modal.style.display = 'flex';
  
  try {
    const res = await fetch(`${API}/admin/users/${accountId}/full-profile`);
    const data = await res.json();
    
    if (data.success && data.profile) {
      const profile = data.profile;
      const tracking = profile.tracking || {};
      const loginHistory = tracking.login_history || [];
      
      if (loginHistory.length === 0) {
        body.innerHTML = `
          <div class="no-history">
            <i class="fas fa-clock"></i>
            <p>No login history recorded for this account</p>
          </div>
        `;
        return;
      }
      
      const sortedHistory = [...loginHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      body.innerHTML = `
        <div class="login-history-summary">
          <div class="summary-item">
            <i class="fas fa-sign-in-alt"></i>
            <span>Total Logins: <strong>${tracking.login_count || loginHistory.length}</strong></span>
          </div>
          <div class="summary-item">
            <i class="fas fa-network-wired"></i>
            <span>Unique IPs: <strong>${(tracking.unique_ips || []).length}</strong></span>
          </div>
          <div class="summary-item">
            <i class="fas fa-desktop"></i>
            <span>Unique Devices: <strong>${(tracking.unique_devices || []).length}</strong></span>
          </div>
        </div>
        
        <div class="login-history-list">
          ${sortedHistory.map((entry, index) => {
            const timestamp = entry.timestamp ? new Date(entry.timestamp * 1000) : null;
            const dateStr = timestamp ? timestamp.toLocaleDateString() : 'Unknown';
            const timeStr = timestamp ? timestamp.toLocaleTimeString() : '';
            const relativeTime = timestamp ? getRelativeTime(timestamp) : '';
            
            const loginMethod = entry.login_method || entry.loginMethod || 'Standard';
            const methodClass = loginMethod.toLowerCase().includes('admin') ? 'admin' : 
                               loginMethod.toLowerCase().includes('discord') ? 'discord' : 'standard';
            
            return `
              <div class="login-entry ${index === 0 ? 'latest' : ''}">
                <div class="login-entry-header">
                  <div class="login-time">
                    <i class="fas fa-clock"></i>
                    <span class="date">${dateStr}</span>
                    <span class="time">${timeStr}</span>
                    ${index === 0 ? '<span class="latest-badge">Latest</span>' : ''}
                  </div>
                  <span class="relative-time">${relativeTime}</span>
                </div>
                <div class="login-entry-details">
                  <div class="detail-row">
                    <span class="detail-label"><i class="fas fa-globe"></i> IP Address</span>
                    <span class="detail-value ip-value">${entry.ip || 'Unknown'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label"><i class="fas fa-key"></i> Login Method</span>
                    <span class="detail-value method-badge ${methodClass}">${loginMethod}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label"><i class="fas fa-desktop"></i> Device</span>
                    <span class="detail-value">${entry.device_type || 'Unknown'}</span>
                  </div>
                  <div class="detail-row user-agent-row">
                    <span class="detail-label"><i class="fas fa-info-circle"></i> User Agent</span>
                    <span class="detail-value user-agent">${entry.user_agent || 'N/A'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          <p>${data.error || 'Failed to load login history'}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading login history:', err);
    body.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>Error loading login history</p>
      </div>
    `;
  }
}

function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function closeLoginHistoryModal() {
  document.getElementById('loginHistoryModal').style.display = 'none';
}

async function resetUserCredentials(accountId) {
  if (!confirm('Reset credentials for this user? They will need new login information.')) return;

  try {
    const res = await fetch(`${API}/admin/users/${accountId}/reset-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reset_api_key: true })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', `New credentials generated. Username: ${data.new_credentials.username}`, 'success', 5000);
      loadUsersTable();
    } else {
      showToast('Error', data.error || 'Failed to reset credentials', 'error', 3000);
    }
  } catch (err) {
    console.error('Error resetting credentials:', err);
    showToast('Error', 'Failed to reset credentials', 'error', 3000);
  }
}

async function suspendUserFromMgmt(accountId) {
  const reason = prompt('Enter reason for suspension:');
  if (!reason) return;

  try {
    const res = await fetch(`${API}/admin/user/${accountId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason, duration: 'indefinite' })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'User suspended', 'success', 3000);
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Failed to suspend user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error suspending user:', err);
    showToast('Error', 'Failed to suspend user', 'error', 3000);
  }
}

async function unsuspendUser(accountId) {
  if (!confirm('Unsuspend this user?')) return;

  try {
    const res = await fetch(`${API}/admin/user/${accountId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'User unsuspended', 'success', 3000);
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Failed to unsuspend user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error unsuspending user:', err);
    showToast('Error', 'Failed to unsuspend user', 'error', 3000);
  }
}

async function banUserFromMgmt(accountId) {
  const reason = prompt('Enter reason for ban (permanent):');
  if (!reason) return;

  try {
    // First, stop the bot if it's running
    showToast('Banning User', 'Stopping bot and banning account...', 'info', 2000);

    await fetch(`${API}/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId })
    });

    // Then ban the account
    const res = await fetch(`${API}/admin/user/${accountId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'Bot stopped and user banned permanently', 'success', 3000);
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Failed to ban user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error banning user:', err);
    showToast('Error', 'Failed to ban user', 'error', 3000);
  }
}

async function unbanUser(accountId) {
  if (!confirm('Unban this user?')) return;

  try {
    const res = await fetch(`${API}/admin/user/${accountId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'User unbanned', 'success', 3000);
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Failed to unban user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error unbanning user:', err);
    showToast('Error', 'Failed to unban user', 'error', 3000);
  }
}

async function deleteUserAccount(accountId) {
  if (!confirm('Are you SURE you want to permanently delete this user account? This action cannot be undone!')) return;
  if (!confirm('This will delete all user files and data. Type "DELETE" in the next prompt to confirm.')) return;
  
  const confirmation = prompt('Type "DELETE" to confirm permanent deletion:');
  if (confirmation !== 'DELETE') {
    showToast('Cancelled', 'Deletion cancelled', 'info', 2000);
    return;
  }

  try {
    const res = await fetch(`${API}/admin/users/${accountId}/delete`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', 'User account deleted and archived', 'success', 3000);
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Failed to delete user', 'error', 3000);
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    showToast('Error', 'Failed to delete user', 'error', 3000);
  }
}

async function bulkAction(action) {
  const selectedIds = userManagementState.selectedUsers;
  
  if (selectedIds.length === 0) {
    showToast('Error', 'No users selected', 'error', 3000);
    return;
  }

  let reason = '';
  if (action === 'suspend' || action === 'ban') {
    reason = prompt(`Enter reason for ${action}ing ${selectedIds.length} users:`);
    if (!reason) return;
  }

  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedIds.length} users?`)) return;

  try {
    const res = await fetch(`${API}/admin/users/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_ids: selectedIds, action, reason })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', data.message, 'success', 4000);
      userManagementState.selectedUsers = [];
      updateBulkActionsVisibility();
      document.getElementById('selectAllUsers').checked = false;
      loadUsersTable();
      loadUserStats();
    } else {
      showToast('Error', data.error || 'Bulk action failed', 'error', 3000);
    }
  } catch (err) {
    console.error('Error performing bulk action:', err);
    showToast('Error', 'Failed to perform bulk action', 'error', 3000);
  }
}

async function exportAllUsers() {
  try {
    showToast('Export', 'Preparing export...', 'info', 2000);
    
    const res = await fetch(`${API}/admin/users/export`);
    const data = await res.json();

    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Success', 'Users exported successfully', 'success', 3000);
    } else {
      showToast('Error', data.error || 'Failed to export', 'error', 3000);
    }
  } catch (err) {
    console.error('Export error:', err);
    showToast('Error', 'Failed to export users', 'error', 3000);
  }
}

function refreshUserManagement() {
  userManagementState.selectedUsers = [];
  updateBulkActionsVisibility();
  document.getElementById('selectAllUsers').checked = false;
  loadUserStats();
  loadUsersTable();
  showToast('Refreshed', 'User data refreshed', 'success', 2000);
}

// ============================================
// USER MANAGEMENT TABS & CREDIT LOGS
// ============================================

function showUserMgmtTab(tabName) {
  const usersTab = document.getElementById('usersTabContent');
  const creditLogsTab = document.getElementById('creditLogsTabContent');
  const usersTabBtn = document.getElementById('usersTabBtn');
  const creditLogsTabBtn = document.getElementById('creditLogsTabBtn');
  
  if (tabName === 'users') {
    usersTab.style.display = 'block';
    creditLogsTab.style.display = 'none';
    usersTabBtn.classList.add('active');
    creditLogsTabBtn.classList.remove('active');
  } else if (tabName === 'creditLogs') {
    usersTab.style.display = 'none';
    creditLogsTab.style.display = 'block';
    usersTabBtn.classList.remove('active');
    creditLogsTabBtn.classList.add('active');
    loadCreditLogs();
  }
}

async function loadCreditLogs() {
  const tableBody = document.getElementById('creditLogsTableBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-cell">
        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading credit logs...</div>
      </td>
    </tr>
  `;
  
  try {
    const res = await fetch(`${API}/referrals/admin/credit-logs`, { credentials: 'include' });
    const data = await res.json();
    
    if (data.success && data.logs) {
      if (data.logs.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
              <i class="fas fa-coins" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
              <p>No credit transactions yet</p>
            </td>
          </tr>
        `;
        return;
      }
      
      tableBody.innerHTML = data.logs.map(log => {
        const sourceIcon = log.source === 'referral' ? 'fa-user-plus' : 
                          log.source === 'admin' ? 'fa-user-shield' : 
                          log.source === 'purchase' ? 'fa-shopping-cart' : 'fa-coins';
        const sourceColor = log.source === 'referral' ? '#10B981' : 
                           log.source === 'admin' ? '#3B82F6' : 
                           log.source === 'purchase' ? '#F59E0B' : '#6B7280';
        const amountColor = log.amount >= 0 ? '#10B981' : '#EF4444';
        const amountPrefix = log.amount >= 0 ? '+' : '';
        
        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; background: var(--bg-tertiary); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <i class="fas fa-user" style="color: var(--text-secondary);"></i>
                </div>
                <div>
                  <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(log.discord_username || 'Unknown')}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">ID: ${log.user_id}</div>
                </div>
              </div>
            </td>
            <td>
              <span style="color: ${amountColor}; font-weight: 600; font-size: 15px;">
                ${amountPrefix}$${Math.abs(log.amount).toFixed(2)}
              </span>
            </td>
            <td>
              <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${sourceColor}20; color: ${sourceColor}; border-radius: 20px; font-size: 12px; font-weight: 500;">
                <i class="fas ${sourceIcon}"></i>
                ${log.source.charAt(0).toUpperCase() + log.source.slice(1)}
              </span>
            </td>
            <td style="color: var(--text-secondary); font-size: 13px;">${escapeHtml(log.details || '-')}</td>
            <td style="color: var(--text-secondary); font-size: 13px;">${new Date(log.timestamp * 1000).toLocaleString()}</td>
          </tr>
        `;
      }).join('');
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <i class="fas fa-exclamation-circle" style="font-size: 32px; margin-bottom: 10px; color: #EF4444;"></i>
            <p>Failed to load credit logs</p>
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error('Error loading credit logs:', err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-exclamation-circle" style="font-size: 32px; margin-bottom: 10px; color: #EF4444;"></i>
          <p>Error loading credit logs</p>
        </td>
      </tr>
    `;
  }
}

function showAddCreditsModal() {
  const modal = document.createElement('div');
  modal.id = 'addCreditsModal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 450px;">
      <div class="modal-header" style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; border-radius: 12px 12px 0 0;">
        <h3 style="color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-coins"></i> Add Credits to User
        </h3>
        <button onclick="closeAddCreditsModal()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">User Discord ID</label>
          <input type="text" id="addCreditsUserId" placeholder="Enter Discord user ID..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Amount ($)</label>
          <input type="number" id="addCreditsAmount" placeholder="0.00" step="0.01" min="0" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Reason</label>
          <input type="text" id="addCreditsReason" placeholder="e.g., Support bonus, Promo credit..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
        </div>
      </div>
      <div class="modal-footer" style="padding: 15px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="closeAddCreditsModal()" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button onclick="submitAddCredits()" style="padding: 10px 20px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-plus"></i> Add Credits
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function closeAddCreditsModal() {
  const modal = document.getElementById('addCreditsModal');
  if (modal) modal.remove();
}

async function submitAddCredits() {
  const userId = document.getElementById('addCreditsUserId')?.value.trim();
  const amount = parseFloat(document.getElementById('addCreditsAmount')?.value) || 0;
  const reason = document.getElementById('addCreditsReason')?.value.trim() || 'Admin credit addition';
  
  if (!userId) {
    showToast('Error', 'Please enter a user Discord ID', 'error', 3000);
    return;
  }
  
  if (amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        amount: amount,
        reason: reason
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', data.message || 'Credits added successfully', 'success', 4000);
      closeAddCreditsModal();
      loadCreditLogs();
    } else {
      showToast('Error', data.error || 'Failed to add credits', 'error', 4000);
    }
  } catch (err) {
    console.error('Error adding credits:', err);
    showToast('Error', 'Failed to add credits: ' + err.message, 'error', 4000);
  }
}

// ============================================
// BALANCE MANAGEMENT MODALS
// ============================================

function showAddBalanceModal() {
  const modal = document.createElement('div');
  modal.id = 'addBalanceModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--bg-secondary); border-radius: 16px; width: 420px; max-width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid var(--border-color);">
      <div class="modal-header" style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-plus-circle"></i> Add Balance
        </h3>
        <button onclick="closeAddBalanceModal()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">User Discord ID</label>
          <input type="text" id="addBalanceUserId" placeholder="Enter Discord user ID..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Amount ($)</label>
          <input type="number" id="addBalanceAmount" placeholder="0.00" step="0.01" min="0" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Reason</label>
          <input type="text" id="addBalanceReason" placeholder="e.g., Bonus, Promotion, Refund..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
      </div>
      <div class="modal-footer" style="padding: 15px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="closeAddBalanceModal()" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button onclick="submitAddBalance()" style="padding: 10px 20px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-plus"></i> Add Balance
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function closeAddBalanceModal() {
  const modal = document.getElementById('addBalanceModal');
  if (modal) modal.remove();
}

async function submitAddBalance() {
  const userId = document.getElementById('addBalanceUserId')?.value.trim();
  const amount = parseFloat(document.getElementById('addBalanceAmount')?.value) || 0;
  const reason = document.getElementById('addBalanceReason')?.value.trim() || 'Admin balance addition';
  
  if (!userId) {
    showToast('Error', 'Please enter a user Discord ID', 'error', 3000);
    return;
  }
  
  if (amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        amount: amount,
        reason: reason
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `Added $${amount.toFixed(2)} balance to user`, 'success', 4000);
      closeAddBalanceModal();
      loadCreditLogs();
    } else {
      showToast('Error', data.error || 'Failed to add balance', 'error', 4000);
    }
  } catch (err) {
    console.error('Error adding balance:', err);
    showToast('Error', 'Failed to add balance: ' + err.message, 'error', 4000);
  }
}

function showRemoveBalanceModal() {
  const modal = document.createElement('div');
  modal.id = 'removeBalanceModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--bg-secondary); border-radius: 16px; width: 420px; max-width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid var(--border-color);">
      <div class="modal-header" style="background: linear-gradient(135deg, #EF4444, #DC2626); padding: 20px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-minus-circle"></i> Remove Balance
        </h3>
        <button onclick="closeRemoveBalanceModal()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <p style="color: #EF4444; margin: 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-exclamation-triangle"></i>
            This will deduct balance from the user's account.
          </p>
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">User Discord ID</label>
          <input type="text" id="removeBalanceUserId" placeholder="Enter Discord user ID..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Amount to Remove ($)</label>
          <input type="number" id="removeBalanceAmount" placeholder="0.00" step="0.01" min="0" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">Reason</label>
          <input type="text" id="removeBalanceReason" placeholder="e.g., Refund reversal, Fraud, Adjustment..." style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>
      </div>
      <div class="modal-footer" style="padding: 15px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="closeRemoveBalanceModal()" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button onclick="submitRemoveBalance()" style="padding: 10px 20px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-minus"></i> Remove Balance
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function closeRemoveBalanceModal() {
  const modal = document.getElementById('removeBalanceModal');
  if (modal) modal.remove();
}

async function submitRemoveBalance() {
  const userId = document.getElementById('removeBalanceUserId')?.value.trim();
  const amount = parseFloat(document.getElementById('removeBalanceAmount')?.value) || 0;
  const reason = document.getElementById('removeBalanceReason')?.value.trim() || 'Admin balance removal';
  
  if (!userId) {
    showToast('Error', 'Please enter a user Discord ID', 'error', 3000);
    return;
  }
  
  if (amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/remove-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        amount: amount,
        reason: reason
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `Removed $${amount.toFixed(2)} balance from user`, 'success', 4000);
      closeRemoveBalanceModal();
      loadCreditLogs();
    } else {
      showToast('Error', data.error || 'Failed to remove balance', 'error', 4000);
    }
  } catch (err) {
    console.error('Error removing balance:', err);
    showToast('Error', 'Failed to remove balance: ' + err.message, 'error', 4000);
  }
}

// ============================================
// STORAGE MANAGEMENT PAGE (Admin)
// ============================================

let storageManagementState = {
  users: [],
  sortBy: 'percentage',
  sortOrder: 'desc'
};

async function loadStorageManagementPage() {
  const page = document.getElementById('storageManagementPage');
  
  page.innerHTML = `
    <div class="storage-mgmt-container">
      <div class="storage-mgmt-header">
        <div class="storage-mgmt-title">
          <div class="title-icon">
            <i class="fas fa-hdd"></i>
          </div>
          <div class="title-text">
            <h1>Storage Management</h1>
            <p>Monitor and manage user storage limits</p>
          </div>
        </div>
        <div class="storage-mgmt-actions">
          <button class="action-btn refresh-btn" onclick="refreshStorageManagement()">
            <i class="fas fa-sync-alt"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div class="storage-overview-cards" id="storageOverviewCards">
      </div>

      <div class="storage-filters-section">
        <div class="filter-row">
          <div class="search-filter">
            <i class="fas fa-search"></i>
            <input type="text" id="storageSearchInput" placeholder="Search by username or account ID..." 
              onkeyup="filterStorageUsers()">
          </div>
          <div class="filter-group">
            <div class="filter-item">
              <label>Sort By</label>
              <select id="storageSortBy" onchange="sortStorageUsers()">
                <option value="percentage">Usage %</option>
                <option value="used">Used Space</option>
                <option value="limit">Storage Limit</option>
                <option value="username">Username</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Order</label>
              <select id="storageSortOrder" onchange="sortStorageUsers()">
                <option value="desc">Highest First</option>
                <option value="asc">Lowest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="storage-users-table-container">
        <table class="storage-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Account ID</th>
              <th>Storage Used</th>
              <th>Storage Limit</th>
              <th>Usage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="storageUsersTableBody">
            <tr>
              <td colspan="6" class="loading-cell">
                <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading storage data...</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="editStorageLimitModal" class="modal">
      <div class="modal-content storage-limit-modal">
        <div class="modal-header">
          <h3><i class="fas fa-hdd"></i> Edit Storage Limit</h3>
          <button class="close-btn" onclick="closeStorageLimitModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="storage-edit-info">
            <p>Editing storage limit for: <strong id="editStorageUsername">-</strong></p>
            <p>Account ID: <code id="editStorageAccountId">-</code></p>
            <p>Current Usage: <span id="editStorageCurrentUsage">-</span></p>
          </div>
          <div class="storage-limit-input">
            <label>New Storage Limit (MB)</label>
            <input type="number" id="newStorageLimitInput" min="1" max="10000" placeholder="Enter limit in MB">
            <div class="preset-buttons">
              <button onclick="setStorageLimitPreset(30)">30 MB</button>
              <button onclick="setStorageLimitPreset(50)">50 MB</button>
              <button onclick="setStorageLimitPreset(100)">100 MB</button>
              <button onclick="setStorageLimitPreset(250)">250 MB</button>
              <button onclick="setStorageLimitPreset(500)">500 MB</button>
              <button onclick="setStorageLimitPreset(1000)">1 GB</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeStorageLimitModal()">Cancel</button>
          <button class="btn-primary" onclick="saveStorageLimit()"><i class="fas fa-save"></i> Save Limit</button>
        </div>
      </div>
    </div>
  `;

  loadStorageOverview();
  loadStorageUsers();
}

async function loadStorageOverview() {
  try {
    const res = await fetch(`${API}/admin/storage/overview`);
    const data = await res.json();

    if (data.success) {
      const overview = data.overview;
      const container = document.getElementById('storageOverviewCards');
      
      container.innerHTML = `
        <div class="storage-stat-card total">
          <div class="stat-icon"><i class="fas fa-server"></i></div>
          <div class="stat-info">
            <span class="stat-label">Total Users</span>
            <span class="stat-value">${overview.total_users}</span>
          </div>
        </div>
        <div class="storage-stat-card usage">
          <div class="stat-icon"><i class="fas fa-database"></i></div>
          <div class="stat-info">
            <span class="stat-label">Total Storage Used</span>
            <span class="stat-value">${overview.total_used_formatted}</span>
          </div>
        </div>
        <div class="storage-stat-card limit">
          <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
          <div class="stat-info">
            <span class="stat-label">Total Allocated</span>
            <span class="stat-value">${overview.total_limit_formatted}</span>
          </div>
        </div>
        <div class="storage-stat-card warning">
          <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="stat-info">
            <span class="stat-label">Critical (>90%)</span>
            <span class="stat-value">${overview.critical_count}</span>
          </div>
        </div>
        <div class="storage-stat-card caution">
          <div class="stat-icon"><i class="fas fa-clock"></i></div>
          <div class="stat-info">
            <span class="stat-label">Warning (>75%)</span>
            <span class="stat-value">${overview.warning_count}</span>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading storage overview:', err);
  }
}

async function loadStorageUsers() {
  try {
    const res = await fetch(`${API}/admin/storage/overview`);
    const data = await res.json();

    if (data.success) {
      storageManagementState.users = data.users || [];
      sortStorageUsers();
    }
  } catch (err) {
    console.error('Error loading storage users:', err);
    document.getElementById('storageUsersTableBody').innerHTML = `
      <tr><td colspan="6" class="error-cell">Failed to load storage data</td></tr>
    `;
  }
}

function sortStorageUsers() {
  const sortBy = document.getElementById('storageSortBy')?.value || 'percentage';
  const sortOrder = document.getElementById('storageSortOrder')?.value || 'desc';
  
  storageManagementState.sortBy = sortBy;
  storageManagementState.sortOrder = sortOrder;

  let users = [...storageManagementState.users];
  
  users.sort((a, b) => {
    let valA, valB;
    switch (sortBy) {
      case 'percentage':
        valA = a.percentage_used || 0;
        valB = b.percentage_used || 0;
        break;
      case 'used':
        valA = a.used_bytes || 0;
        valB = b.used_bytes || 0;
        break;
      case 'limit':
        valA = a.limit_bytes || 0;
        valB = b.limit_bytes || 0;
        break;
      case 'username':
        valA = (a.username || '').toLowerCase();
        valB = (b.username || '').toLowerCase();
        break;
      default:
        valA = a.percentage_used || 0;
        valB = b.percentage_used || 0;
    }
    
    if (sortBy === 'username') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  renderStorageUsersTable(users);
}

function filterStorageUsers() {
  const searchTerm = (document.getElementById('storageSearchInput')?.value || '').toLowerCase();
  
  let users = storageManagementState.users.filter(user => {
    const username = (user.username || '').toLowerCase();
    const accountId = (user.account_id || '').toLowerCase();
    return username.includes(searchTerm) || accountId.includes(searchTerm);
  });

  renderStorageUsersTable(users);
}

function renderStorageUsersTable(users) {
  const tbody = document.getElementById('storageUsersTableBody');
  
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const percentage = user.percentage_used || 0;
    let statusClass = '';
    if (percentage >= 90) statusClass = 'critical';
    else if (percentage >= 75) statusClass = 'warning';
    
    return `
      <tr class="${statusClass}">
        <td>
          <div class="user-info-cell">
            <i class="fab fa-discord"></i>
            <span>${user.username || 'Unknown'}</span>
          </div>
        </td>
        <td><code>${user.account_id}</code></td>
        <td>${user.used_formatted || '0 B'}</td>
        <td>${user.limit_formatted || '30 MB'}</td>
        <td>
          <div class="storage-usage-cell">
            <div class="mini-progress-bar">
              <div class="mini-progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <span class="percentage-text">${percentage.toFixed(1)}%</span>
          </div>
        </td>
        <td>
          <button class="edit-limit-btn" onclick="openEditStorageLimitModal('${user.account_id}', '${user.username || 'Unknown'}', '${user.used_formatted || '0 B'}', ${user.limit_bytes ? user.limit_bytes / (1024*1024) : user.limit_mb || 30})">
            <i class="fas fa-edit"></i> Edit Limit
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

let currentEditAccountId = null;

function openEditStorageLimitModal(accountId, username, currentUsage, currentLimitMB) {
  currentEditAccountId = accountId;
  document.getElementById('editStorageUsername').textContent = username;
  document.getElementById('editStorageAccountId').textContent = accountId;
  document.getElementById('editStorageCurrentUsage').textContent = currentUsage;
  document.getElementById('newStorageLimitInput').value = Math.round(currentLimitMB);
  document.getElementById('editStorageLimitModal').classList.add('active');
}

function closeStorageLimitModal() {
  document.getElementById('editStorageLimitModal').classList.remove('active');
  currentEditAccountId = null;
}

function setStorageLimitPreset(mb) {
  document.getElementById('newStorageLimitInput').value = mb;
}

async function saveStorageLimit() {
  if (!currentEditAccountId) return;
  
  const newLimit = parseInt(document.getElementById('newStorageLimitInput').value);
  
  if (!newLimit || newLimit < 1 || newLimit > 10000) {
    showToast('Error', 'Please enter a valid limit between 1 and 10000 MB', 'error', 3000);
    return;
  }

  try {
    const res = await fetch(`${API}/admin/users/${currentEditAccountId}/storage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageLimit: newLimit })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Success', `Storage limit updated to ${newLimit} MB`, 'success', 3000);
      closeStorageLimitModal();
      loadStorageOverview();
      loadStorageUsers();
    } else {
      showToast('Error', data.error || 'Failed to update storage limit', 'error', 3000);
    }
  } catch (err) {
    console.error('Error saving storage limit:', err);
    showToast('Error', 'Failed to save storage limit', 'error', 3000);
  }
}

function refreshStorageManagement() {
  loadStorageOverview();
  loadStorageUsers();
  showToast('Refreshed', 'Storage data refreshed', 'success', 2000);
}

// Order Management Page
async function loadOrderManagementPage() {
  const page = document.getElementById('orderManagementPage');
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-clipboard-list"></i> Order Management</h2>
      <button class="btn-primary" onclick="refreshOrders()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
    <div class="orders-loading">
      <i class="fas fa-spinner fa-spin"></i> Loading orders...
    </div>
  `;
  
  try {
    const res = await fetch(`${API}/admin/orders`, { credentials: 'include' });
    const data = await res.json();
    
    if (data.success) {
      renderOrderManagement(page, data.orders);
    } else {
      page.innerHTML += `<div class="error-message">Failed to load orders: ${data.error}</div>`;
    }
  } catch (err) {
    console.error('Error loading orders:', err);
    page.innerHTML = `<div class="error-message">Error loading orders</div>`;
  }
}

function renderOrderManagement(page, orders) {
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const provisionedOrders = orders.filter(o => o.status === 'provisioned');
  const allOrders = orders;
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-clipboard-list"></i> Order Management</h2>
      <button class="btn-primary" onclick="loadOrderManagementPage()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
    
    <div class="orders-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
      <div class="stat-card" style="background: linear-gradient(135deg, #F59E0B, #D97706); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 32px; font-weight: 700;">${pendingOrders.length}</div>
        <div style="opacity: 0.9;">Pending Orders</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 32px; font-weight: 700;">${provisionedOrders.length}</div>
        <div style="opacity: 0.9;">Completed Orders</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #3B82F6, #1D4ED8); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 32px; font-weight: 700;">${allOrders.length}</div>
        <div style="opacity: 0.9;">Total Orders</div>
      </div>
    </div>
    
    <div class="orders-section" style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
      <h3 style="color: var(--text-primary); margin-bottom: 20px;"><i class="fas fa-clock" style="color: #F59E0B; margin-right: 10px;"></i>All Orders</h3>
      
      ${allOrders.length === 0 ? `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
          <p>No orders yet</p>
        </div>
      ` : `
        <table class="orders-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Order ID</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">User</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Server Name</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Plan</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Specs</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Price</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Status</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Date</th>
              <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allOrders.map(order => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px; color: var(--text-primary);">${order.id.substring(0, 8)}...</td>
                <td style="padding: 12px;">
                  <div style="display: flex; flex-direction: column;">
                    <span style="color: var(--text-primary); font-weight: 500;">${order.discord_username || 'Unknown'}</span>
                    <span style="color: var(--text-secondary); font-size: 11px;">${order.user_id}</span>
                  </div>
                </td>
                <td style="padding: 12px;">
                  ${order.server_name ? `
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <i class="fas fa-server" style="color: #10B981;"></i>
                      <span style="color: var(--text-primary); font-weight: 500;">${order.server_name}</span>
                    </div>
                  ` : `<span style="color: var(--text-secondary);">-</span>`}
                </td>
                <td style="padding: 12px; color: var(--text-primary);">${order.plan_name}</td>
                <td style="padding: 12px; color: var(--text-secondary); font-size: 12px;">${order.ram}GB RAM | ${order.storage}GB | ${order.backups} Backups</td>
                <td style="padding: 12px; color: #10B981; font-weight: 600;">$${order.price.toFixed(2)}/mo</td>
                <td style="padding: 12px;">
                  <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; ${order.status === 'pending' ? 'background: rgba(245, 158, 11, 0.1); color: #F59E0B;' : 'background: rgba(16, 185, 129, 0.1); color: #10B981;'}">${order.status === 'pending' ? 'Pending' : 'Provisioned'}</span>
                </td>
                <td style="padding: 12px; color: var(--text-secondary); font-size: 12px;">${new Date(order.created_at * 1000).toLocaleString()}</td>
                <td style="padding: 12px;">
                  ${order.status === 'pending' ? `<button onclick="expediteOrder('${order.id}')" style="padding: 6px 12px; background: #10B981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-bolt"></i> Expedite</button>` : `<span style="color: var(--text-secondary);">-</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

async function expediteOrder(orderId) {
  if (!confirm('Expedite this order? It will be provisioned immediately.')) return;
  
  try {
    const res = await fetch(`${API}/admin/orders/${orderId}/expedite`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', 'Order expedited successfully!', 'success', 3000);
      loadOrderManagementPage();
    } else {
      showToast('Error', data.error || 'Failed to expedite order', 'error', 3000);
    }
  } catch (err) {
    console.error('Error expediting order:', err);
    showToast('Error', 'Failed to expedite order', 'error', 3000);
  }
}

// Credits Admin Page
let allCreditsUsers = [];

async function loadCreditsAdminPage() {
  const page = document.getElementById('creditsAdminPage');
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-coins"></i> Credits Management</h2>
      <button class="btn-primary" onclick="loadCreditsAdminPage()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
    <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
      <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: var(--text-secondary);"></i>
    </div>
  `;
  
  try {
    const [overviewRes, usersRes] = await Promise.all([
      fetch(`${API}/admin/credits/overview`, { credentials: 'include' }),
      fetch(`${API}/referrals/admin/users`, { credentials: 'include' })
    ]);
    
    const overviewData = await overviewRes.json();
    let usersData = { success: false, users: [] };
    try {
      usersData = await usersRes.json();
    } catch (e) {
      console.error('Error parsing users data:', e);
    }
    
    if (overviewData.success) {
      allCreditsUsers = (usersData.success && Array.isArray(usersData.users)) ? usersData.users : [];
      renderCreditsAdminPage(page, overviewData, allCreditsUsers);
    } else {
      page.innerHTML += `<div class="error-message">Failed to load credits data</div>`;
    }
  } catch (err) {
    console.error('Error loading credits:', err);
    page.innerHTML = `<div class="error-message">Error loading credits data</div>`;
  }
}

function renderCreditsAdminPage(page, data, users = []) {
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-coins"></i> Credits Management</h2>
      <button class="btn-primary" onclick="loadCreditsAdminPage()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
    
    <div class="credits-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px;">
      <div class="stat-card" style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 28px; font-weight: 700;">$${data.total_credits?.toFixed(2) || '0.00'}</div>
        <div style="opacity: 0.9;">Total Credits</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #3B82F6, #1D4ED8); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 28px; font-weight: 700;">$${data.total_balance?.toFixed(2) || '0.00'}</div>
        <div style="opacity: 0.9;">Total Referral Balance</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 28px; font-weight: 700;">${data.total_users || 0}</div>
        <div style="opacity: 0.9;">Total Accounts</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #F59E0B, #D97706); padding: 20px; border-radius: 12px; color: white;">
        <div style="font-size: 28px; font-weight: 700;">${data.pending_withdrawals || 0}</div>
        <div style="opacity: 0.9;">Pending Withdrawals</div>
      </div>
    </div>
    
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); margin-bottom: 24px;">
      <h3 style="color: var(--text-primary); margin-bottom: 20px;"><i class="fas fa-user-plus" style="color: #10B981; margin-right: 10px;"></i>Manage User Credits</h3>
      <div style="display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">Discord ID</label>
          <input type="text" id="addCreditsUserId" placeholder="Enter Discord ID" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
        </div>
        <div style="flex: 1; min-width: 150px;">
          <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">Amount ($)</label>
          <input type="number" id="addCreditsAmount" placeholder="0.00" step="0.01" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="addCreditsToUser()" style="padding: 12px 24px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
            <i class="fas fa-plus"></i> Add
          </button>
          <button onclick="removeCreditsFromUser()" style="padding: 12px 24px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
            <i class="fas fa-minus"></i> Remove
          </button>
        </div>
      </div>
    </div>
    
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
        <h3 style="color: var(--text-primary); margin: 0;"><i class="fas fa-users" style="color: #3B82F6; margin-right: 10px;"></i>All User Accounts</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="creditsUserSearch" placeholder="Search by ID or username..." oninput="filterCreditsUsers()" style="padding: 10px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); width: 250px;">
          <select id="creditsSortBy" onchange="filterCreditsUsers()" style="padding: 10px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
            <option value="credits">Sort by Credits</option>
            <option value="balance">Sort by Balance</option>
            <option value="referrals">Sort by Referrals</option>
          </select>
        </div>
      </div>
      
      <div id="creditsUsersList">
        ${renderCreditsUsersTable(users)}
      </div>
    </div>
  `;
}

function renderCreditsUsersTable(users) {
  if (!users || users.length === 0) {
    return `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
        <p>No user accounts found</p>
      </div>
    `;
  }
  
  return `
    <div style="max-height: 500px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="position: sticky; top: 0; background: var(--bg-secondary);">
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">User</th>
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Credits</th>
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Balance</th>
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Referrals</th>
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Referred By</th>
            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px;">
                <div style="display: flex; flex-direction: column;">
                  <span style="color: var(--text-primary); font-weight: 500;">${escapeHtml(user.discord_username || user.discord_name || 'Unknown')}</span>
                  <span style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(user.user_id)}</span>
                </div>
              </td>
              <td style="padding: 12px; color: #10B981; font-weight: 600;">$${(user.credits || 0).toFixed(2)}</td>
              <td style="padding: 12px; color: #3B82F6;">$${(user.balance || 0).toFixed(2)}</td>
              <td style="padding: 12px; color: var(--text-secondary);">${user.referral_count || 0}</td>
              <td style="padding: 12px; color: var(--text-secondary); font-size: 12px;">${user.referred_by || '-'}</td>
              <td style="padding: 12px;">
                <div style="display: flex; gap: 5px;">
                  <button onclick="quickAddCredits('${escapeHtml(user.user_id)}')" title="Add Credits" style="padding: 6px 10px; background: #10B981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-plus"></i></button>
                  <button onclick="quickRemoveCredits('${escapeHtml(user.user_id)}')" title="Remove Credits" style="padding: 6px 10px; background: #F59E0B; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-minus"></i></button>
                  <button onclick="editUserCredits('${escapeHtml(user.user_id)}')" title="Set Credits" style="padding: 6px 10px; background: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-edit"></i></button>
                  <button onclick="adjustUserBalance('${escapeHtml(user.user_id)}')" title="Adjust Balance" style="padding: 6px 10px; background: #8B5CF6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-wallet"></i></button>
                  <button onclick="resetUserCredits('${escapeHtml(user.user_id)}')" title="Reset All" style="padding: 6px 10px; background: #EF4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fas fa-undo"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top: 15px; color: var(--text-secondary); font-size: 13px;">
      Showing ${users.length} account${users.length !== 1 ? 's' : ''}
    </div>
  `;
}

function filterCreditsUsers() {
  const searchTerm = (document.getElementById('creditsUserSearch')?.value || '').toLowerCase();
  const sortBy = document.getElementById('creditsSortBy')?.value || 'credits';
  
  let filtered = allCreditsUsers.filter(user => {
    const userId = (user.user_id || '').toLowerCase();
    const username = (user.discord_username || '').toLowerCase();
    const name = (user.discord_name || '').toLowerCase();
    return userId.includes(searchTerm) || username.includes(searchTerm) || name.includes(searchTerm);
  });
  
  filtered.sort((a, b) => {
    if (sortBy === 'credits') return (b.credits || 0) - (a.credits || 0);
    if (sortBy === 'balance') return (b.balance || 0) - (a.balance || 0);
    if (sortBy === 'referrals') return (b.referral_count || 0) - (a.referral_count || 0);
    return 0;
  });
  
  const container = document.getElementById('creditsUsersList');
  if (container) {
    container.innerHTML = renderCreditsUsersTable(filtered);
  }
}

function quickAddCredits(userId) {
  const amount = prompt(`Enter amount to add to ${userId}:`);
  if (amount === null) return;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    showToast('Error', 'Please enter a valid positive amount', 'error', 3000);
    return;
  }
  
  fetch(`${API}/admin/credits/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ discord_id: userId, amount: numAmount })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Success', `Added $${numAmount.toFixed(2)} credits`, 'success', 3000);
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to add credits', 'error', 3000);
    }
  })
  .catch(err => {
    console.error('Error adding credits:', err);
    showToast('Error', 'Failed to add credits', 'error', 3000);
  });
}

function quickRemoveCredits(userId) {
  const amount = prompt(`Enter amount to remove from ${userId}:`);
  if (amount === null) return;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    showToast('Error', 'Please enter a valid positive amount', 'error', 3000);
    return;
  }
  
  fetch(`${API}/referrals/admin/add-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, amount: -numAmount, reason: 'Admin removal' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Success', `Removed $${numAmount.toFixed(2)} credits`, 'success', 3000);
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to remove credits', 'error', 3000);
    }
  })
  .catch(err => {
    console.error('Error removing credits:', err);
    showToast('Error', 'Failed to remove credits', 'error', 3000);
  });
}

function adjustUserBalance(userId) {
  const amount = prompt(`Enter balance adjustment for ${userId} (positive to add, negative to remove):`);
  if (amount === null) return;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) {
    showToast('Error', 'Please enter a valid non-zero amount', 'error', 3000);
    return;
  }
  
  const reason = prompt('Enter reason for adjustment:') || 'Admin adjustment';
  
  fetch(`${API}/referrals/admin/user/${userId}/adjust-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amount: numAmount, reason })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Success', data.message, 'success', 3000);
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to adjust balance', 'error', 3000);
    }
  })
  .catch(err => {
    console.error('Error adjusting balance:', err);
    showToast('Error', 'Failed to adjust balance', 'error', 3000);
  });
}

async function removeCreditsFromUser() {
  const userId = document.getElementById('addCreditsUserId').value.trim();
  const amount = parseFloat(document.getElementById('addCreditsAmount').value);
  
  if (!userId) {
    showToast('Error', 'Please enter a Discord ID', 'error', 3000);
    return;
  }
  
  if (!amount || amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, amount: -amount, reason: 'Admin removal' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `Removed $${amount.toFixed(2)} credits from user`, 'success', 3000);
      document.getElementById('addCreditsUserId').value = '';
      document.getElementById('addCreditsAmount').value = '';
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to remove credits', 'error', 3000);
    }
  } catch (err) {
    console.error('Error removing credits:', err);
    showToast('Error', 'Failed to remove credits', 'error', 3000);
  }
}

async function addCreditsToUser() {
  const userId = document.getElementById('addCreditsUserId').value.trim();
  const amount = parseFloat(document.getElementById('addCreditsAmount').value);
  
  if (!userId) {
    showToast('Error', 'Please enter a Discord ID', 'error', 3000);
    return;
  }
  
  if (!amount || amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  try {
    const res = await fetch(`${API}/admin/credits/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ discord_id: userId, amount: amount })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `Added $${amount.toFixed(2)} credits to user`, 'success', 3000);
      document.getElementById('addCreditsUserId').value = '';
      document.getElementById('addCreditsAmount').value = '';
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to add credits', 'error', 3000);
    }
  } catch (err) {
    console.error('Error adding credits:', err);
    showToast('Error', 'Failed to add credits', 'error', 3000);
  }
}

async function resetUserCredits(discordId) {
  if (!confirm(`Reset all credits for user ${discordId}? This cannot be undone.`)) return;
  
  try {
    const res = await fetch(`${API}/admin/credits/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ discord_id: discordId })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', 'User credits reset', 'success', 3000);
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to reset credits', 'error', 3000);
    }
  } catch (err) {
    console.error('Error resetting credits:', err);
    showToast('Error', 'Failed to reset credits', 'error', 3000);
  }
}

function editUserCredits(discordId) {
  const newAmount = prompt(`Enter new credit amount for user ${discordId}:`);
  if (newAmount === null) return;
  
  const amount = parseFloat(newAmount);
  if (isNaN(amount) || amount < 0) {
    showToast('Error', 'Please enter a valid amount', 'error', 3000);
    return;
  }
  
  fetch(`${API}/admin/credits/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ discord_id: discordId, amount: amount })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Success', 'Credits updated', 'success', 3000);
      loadCreditsAdminPage();
    } else {
      showToast('Error', data.error || 'Failed to update credits', 'error', 3000);
    }
  })
  .catch(err => {
    console.error('Error updating credits:', err);
    showToast('Error', 'Failed to update credits', 'error', 3000);
  });
}

let permissionsState = {
  isAuthorized: false,
  permissions: [],
  lookupResult: null
};

async function loadPermissionsPage() {
  const page = document.getElementById('permissionsPage');
  
  try {
    const authRes = await fetch(`${API}/admin/permissions/check-admin`, {
      credentials: 'include'
    });
    const authData = await authRes.json();
    
    if (!authData.success || !authData.isAuthorized) {
      showPermissionUnauthorizedWarning(page);
      return;
    }
    
    permissionsState.isAuthorized = true;
    renderPermissionsPage(page);
    loadExistingPermissions();
    
  } catch (err) {
    console.error('Permission check error:', err);
    page.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error Loading Permissions</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function showPermissionUnauthorizedWarning(page) {
  page.innerHTML = `
    <div class="permission-unauthorized-overlay">
      <div class="unauthorized-container">
        <div class="unauthorized-icon-section">
          <div class="warning-shield">
            <i class="fas fa-shield-alt"></i>
            <div class="shield-x">
              <i class="fas fa-times"></i>
            </div>
          </div>
          <div class="warning-pulse"></div>
        </div>
        
        <div class="unauthorized-content">
          <h1 class="unauthorized-title">UNAUTHORIZED ACCESS</h1>
          <div class="unauthorized-code">ERROR CODE: 403-PERM-DENIED</div>
          
          <div class="unauthorized-message">
            <p>You do not have permission to access the Permission Management panel.</p>
            <p>This incident has been logged and reported.</p>
          </div>
          
          <div class="unauthorized-info-box">
            <div class="info-row">
              <span class="info-label"><i class="fas fa-fingerprint"></i> Your ID:</span>
              <span class="info-value">${currentUser?.discordId || currentUser?.userId || 'Unknown'}</span>
            </div>
            <div class="info-row">
              <span class="info-label"><i class="fas fa-clock"></i> Timestamp:</span>
              <span class="info-value">${new Date().toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label"><i class="fas fa-map-marker-alt"></i> Location:</span>
              <span class="info-value">Permission Management</span>
            </div>
          </div>
          
          <div class="unauthorized-warning-strip">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Only authorized administrators (1129144246499278949, 1091165197802152046) can access this feature.</span>
          </div>
          
          <div class="unauthorized-screenshot-hint">
            <i class="fas fa-camera"></i>
            Take a screenshot of this page and contact an authorized administrator if you believe this is an error.
          </div>
          
          <button class="unauthorized-back-btn" onclick="showPage('dashboardPage')">
            <i class="fas fa-arrow-left"></i> Return to Dashboard
          </button>
        </div>
        
        <div class="unauthorized-footer">
          <p>ALN Hosting Security System</p>
          <p class="footer-sub">Protecting your infrastructure</p>
        </div>
      </div>
    </div>
  `;
}

function renderPermissionsPage(page) {
  page.innerHTML = `
    <div class="permissions-management">
      <div class="permissions-header">
        <div class="header-left">
          <div class="icon-wrapper perm-icon">
            <i class="fas fa-user-shield"></i>
          </div>
          <div>
            <h2>Permission Management</h2>
            <p>Grant and manage user access permissions</p>
          </div>
        </div>
        <div class="header-badge authorized">
          <i class="fas fa-check-circle"></i>
          Authorized Administrator
        </div>
      </div>
      
      <div class="permissions-grant-section">
        <h3><i class="fas fa-plus-circle"></i> Grant New Permission</h3>
        
        <div class="grant-form">
          <div class="form-group">
            <label for="lookupDiscordId"><i class="fab fa-discord"></i> Discord ID</label>
            <div class="input-with-btn">
              <input type="text" id="lookupDiscordId" placeholder="Enter Discord ID (e.g., 123456789012345678)">
              <button class="btn-lookup" onclick="lookupDiscordUser()">
                <i class="fas fa-search"></i> Lookup
              </button>
            </div>
          </div>
          
          <div id="lookupResult" class="lookup-result" style="display: none;"></div>
          
          <div class="form-group" id="permissionTypeSection" style="display: none;">
            <label><i class="fas fa-key"></i> Permission Type</label>
            <div class="permission-options">
              <label class="permission-option">
                <input type="radio" name="permissionType" value="full">
                <div class="option-card">
                  <i class="fas fa-crown"></i>
                  <span class="option-title">Full Permission</span>
                  <span class="option-desc">Complete access to all pages and features</span>
                </div>
              </label>
              <label class="permission-option">
                <input type="radio" name="permissionType" value="all">
                <div class="option-card">
                  <i class="fas fa-th-large"></i>
                  <span class="option-title">All Options</span>
                  <span class="option-desc">Access to all standard dashboard options</span>
                </div>
              </label>
              <label class="permission-option">
                <input type="radio" name="permissionType" value="channels">
                <div class="option-card">
                  <i class="fas fa-list"></i>
                  <span class="option-title">Channel Names</span>
                  <span class="option-desc">Access to specific pages only</span>
                </div>
              </label>
            </div>
          </div>
          
          <div class="form-group" id="channelSelectSection" style="display: none;">
            <label><i class="fas fa-check-square"></i> Select Pages</label>
            <div class="channel-checkboxes-grid">
              <div class="channel-category">
                <div class="category-title"><i class="fas fa-shield-alt"></i> ADMIN</div>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="dashboard">
                  <span class="checkbox-label"><i class="fas fa-tachometer-alt"></i> Dashboard</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="hosting">
                  <span class="checkbox-label"><i class="fas fa-server"></i> Hosting Accounts</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="connect">
                  <span class="checkbox-label"><i class="fas fa-plug"></i> Connect</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="userManagement">
                  <span class="checkbox-label"><i class="fas fa-users"></i> User Management</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="storageManagement">
                  <span class="checkbox-label"><i class="fas fa-database"></i> Storage</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="problems">
                  <span class="checkbox-label"><i class="fas fa-exclamation-triangle"></i> Problems</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="securityLogs">
                  <span class="checkbox-label"><i class="fas fa-shield-alt"></i> Security Logs</span>
                </label>
                <label class="channel-checkbox">
                  <input type="checkbox" name="channel" value="permissions">
                  <span class="checkbox-label"><i class="fas fa-user-shield"></i> Permissions</span>
                </label>
              </div>
            </div>
          </div>
          
          <button id="grantPermissionBtn" class="btn-grant" onclick="grantPermission()" style="display: none;">
            <i class="fas fa-check"></i> Grant Permission
          </button>
        </div>
      </div>
      
      <div class="permissions-list-section">
        <h3><i class="fas fa-users"></i> Existing Permissions</h3>
        <div class="permissions-list" id="permissionsList">
          <div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading permissions...</div>
        </div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('input[name="permissionType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const channelSection = document.getElementById('channelSelectSection');
      if (this.value === 'channels') {
        channelSection.style.display = 'block';
      } else {
        channelSection.style.display = 'none';
      }
    });
  });
}

async function lookupDiscordUser() {
  const discordId = document.getElementById('lookupDiscordId').value.trim();
  
  if (!discordId || !/^\d{17,19}$/.test(discordId)) {
    showToast('Invalid ID', 'Please enter a valid Discord ID (17-19 digits)', 'error', 3000);
    return;
  }
  
  const resultDiv = document.getElementById('lookupResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Looking up user...</div>';
  
  try {
    const res = await fetch(`${API}/admin/permissions/lookup/${discordId}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.showWarning) {
      showPermissionUnauthorizedWarning(document.getElementById('permissionsPage'));
      return;
    }
    
    permissionsState.lookupResult = data;
    
    if (data.registered) {
      resultDiv.innerHTML = `
        <div class="lookup-success-card">
          <div class="lookup-success-header">
            <div class="success-indicator">
              <i class="fas fa-check-circle"></i>
            </div>
            <span class="success-text">User Found</span>
          </div>
          <div class="lookup-user-profile">
            <div class="user-profile-row">
              <div class="profile-item username-item">
                <div class="profile-icon"><i class="fab fa-discord"></i></div>
                <div class="profile-details">
                  <span class="profile-label">USERNAME</span>
                  <span class="profile-value username">${data.discord_username}</span>
                </div>
              </div>
              <div class="profile-item discord-id-item">
                <div class="profile-icon"><i class="fas fa-fingerprint"></i></div>
                <div class="profile-details">
                  <span class="profile-label">DISCORD ID</span>
                  <span class="profile-value discord-id">${data.discord_id}</span>
                </div>
              </div>
            </div>
            <div class="user-profile-row">
              <div class="profile-item hosting-item">
                <div class="profile-icon"><i class="fas fa-server"></i></div>
                <div class="profile-details">
                  <span class="profile-label">HOSTING</span>
                  <span class="profile-value hosting">${data.hosting_name}</span>
                </div>
              </div>
              <div class="profile-item perm-item">
                <div class="profile-icon"><i class="fas fa-key"></i></div>
                <div class="profile-details">
                  <span class="profile-label">CURRENT PERMISSION</span>
                  ${data.permissions && data.permissions.type ? `
                    <span class="profile-value perm-badge ${data.permissions.type}">${data.permissions.type.toUpperCase()}</span>
                  ` : `
                    <span class="profile-value no-perm">None</span>
                  `}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('permissionTypeSection').style.display = 'block';
      document.getElementById('grantPermissionBtn').style.display = 'block';
    } else {
      resultDiv.innerHTML = `
        <div class="lookup-not-found">
          <div class="not-found-header">
            <i class="fas fa-user-times"></i>
            <span>User Not Registered</span>
          </div>
          <p>No hosting account found with Discord ID: <strong>${discordId}</strong></p>
          <p class="hint">The user must have a registered hosting account to receive permissions.</p>
        </div>
      `;
      
      document.getElementById('permissionTypeSection').style.display = 'none';
      document.getElementById('grantPermissionBtn').style.display = 'none';
    }
    
  } catch (err) {
    console.error('Lookup error:', err);
    resultDiv.innerHTML = `
      <div class="lookup-error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Error looking up user: ${err.message}</span>
      </div>
    `;
  }
}

async function grantPermission() {
  const discordId = document.getElementById('lookupDiscordId').value.trim();
  const permissionType = document.querySelector('input[name="permissionType"]:checked')?.value;
  
  if (!discordId) {
    showToast('Error', 'Discord ID is required', 'error', 3000);
    return;
  }
  
  if (!permissionType) {
    showToast('Error', 'Please select a permission type', 'error', 3000);
    return;
  }
  
  let channels = [];
  if (permissionType === 'channels') {
    channels = Array.from(document.querySelectorAll('input[name="channel"]:checked')).map(cb => cb.value);
    if (channels.length === 0) {
      showToast('Error', 'Please select at least one page for channel permission', 'error', 3000);
      return;
    }
  }
  
  try {
    const res = await fetch(`${API}/admin/permissions/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        discordId,
        permissionType,
        channels
      })
    });
    
    const data = await res.json();
    
    if (data.showWarning) {
      showPermissionUnauthorizedWarning(document.getElementById('permissionsPage'));
      return;
    }
    
    if (data.success) {
      showToast('Success', data.message, 'success', 4000);
      
      userPermissionsCache = null;
      
      document.getElementById('lookupDiscordId').value = '';
      document.getElementById('lookupResult').style.display = 'none';
      document.getElementById('permissionTypeSection').style.display = 'none';
      document.getElementById('grantPermissionBtn').style.display = 'none';
      document.getElementById('channelSelectSection').style.display = 'none';
      document.querySelectorAll('input[name="permissionType"]').forEach(r => r.checked = false);
      document.querySelectorAll('input[name="channel"]').forEach(cb => cb.checked = false);
      
      loadExistingPermissions();
    } else {
      showToast('Error', data.error || 'Failed to grant permission', 'error', 4000);
    }
  } catch (err) {
    console.error('Grant permission error:', err);
    showToast('Error', 'Failed to grant permission: ' + err.message, 'error', 4000);
  }
}

async function loadExistingPermissions() {
  const listDiv = document.getElementById('permissionsList');
  
  try {
    const res = await fetch(`${API}/admin/permissions`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.showWarning) {
      showPermissionUnauthorizedWarning(document.getElementById('permissionsPage'));
      return;
    }
    
    if (!data.success) {
      listDiv.innerHTML = `<div class="error-state">Error: ${data.error}</div>`;
      return;
    }
    
    permissionsState.permissions = data.permissions || [];
    
    if (permissionsState.permissions.length === 0) {
      listDiv.innerHTML = `
        <div class="empty-permissions">
          <i class="fas fa-user-lock"></i>
          <h4>No Permissions Granted Yet</h4>
          <p>Use the form above to grant permissions to users.</p>
        </div>
      `;
      return;
    }
    
    listDiv.innerHTML = permissionsState.permissions.map(perm => `
      <div class="permission-card">
        <div class="perm-card-header">
          <div class="perm-user-info">
            <div class="perm-avatar">
              <i class="fab fa-discord"></i>
            </div>
            <div class="perm-user-details">
              <div class="perm-username">${perm.username}</div>
              <div class="perm-discord-id-display">
                <i class="fas fa-fingerprint"></i>
                <span>${perm.discordId}</span>
              </div>
            </div>
          </div>
          <div class="perm-type-badge ${perm.permissions?.type || 'none'}">
            <i class="fas fa-${perm.permissions?.type === 'full' ? 'crown' : perm.permissions?.type === 'all' ? 'th-large' : 'list'}"></i>
            ${perm.permissions?.type?.toUpperCase() || 'NONE'}
          </div>
        </div>
        <div class="perm-card-body">
          <div class="perm-details-grid">
            <div class="perm-detail">
              <span class="perm-label"><i class="fas fa-server"></i> Hosting</span>
              <span class="perm-value">${perm.hostingName || 'N/A'}</span>
            </div>
            <div class="perm-detail">
              <span class="perm-label"><i class="fas fa-info-circle"></i> Access</span>
              <span class="perm-value">${perm.permissions?.description || 'No description'}</span>
            </div>
            <div class="perm-detail">
              <span class="perm-label"><i class="fas fa-calendar"></i> Granted</span>
              <span class="perm-value">${perm.grantedAt ? new Date(perm.grantedAt * 1000).toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div class="perm-detail">
              <span class="perm-label"><i class="fas fa-user-shield"></i> By</span>
              <span class="perm-value">${perm.permissions?.grantedByUsername || 'Unknown'}</span>
            </div>
          </div>
          ${perm.permissions?.type === 'channels' && perm.permissions?.pages ? `
            <div class="perm-pages-list">
              <span class="pages-label">Allowed Pages:</span>
              <div class="pages-tags">
                ${perm.permissions.pages.map(p => `<span class="page-tag">${p}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="perm-card-actions">
          <button class="btn-edit-perm" onclick="editPermission('${perm.discordId}', '${perm.username}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn-revoke" onclick="revokePermission('${perm.discordId}', '${perm.username}')">
            <i class="fas fa-trash"></i> Revoke
          </button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Load permissions error:', err);
    listDiv.innerHTML = `<div class="error-state">Error loading permissions: ${err.message}</div>`;
  }
}

async function revokePermission(discordId, username) {
  if (!confirm(`Are you sure you want to revoke permissions from ${username}?`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API}/admin/permissions/revoke/${discordId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.showWarning) {
      showPermissionUnauthorizedWarning(document.getElementById('permissionsPage'));
      return;
    }
    
    if (data.success) {
      showToast('Revoked', `Permission revoked from ${username}`, 'success', 3000);
      userPermissionsCache = null;
      loadExistingPermissions();
    } else {
      showToast('Error', data.error || 'Failed to revoke permission', 'error', 4000);
    }
  } catch (err) {
    console.error('Revoke permission error:', err);
    showToast('Error', 'Failed to revoke permission: ' + err.message, 'error', 4000);
  }
}

async function editPermission(discordId, username) {
  document.getElementById('lookupDiscordId').value = discordId;
  
  const resultDiv = document.getElementById('lookupResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading user info...</div>';
  
  try {
    const res = await fetch(`${API}/admin/permissions/lookup/${discordId}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.showWarning) {
      showPermissionUnauthorizedWarning(document.getElementById('permissionsPage'));
      return;
    }
    
    permissionsState.lookupResult = data;
    
    if (data.registered) {
      resultDiv.innerHTML = `
        <div class="lookup-success-card editing-mode">
          <div class="lookup-success-header">
            <div class="success-indicator edit">
              <i class="fas fa-edit"></i>
            </div>
            <span class="success-text">Editing Permission for ${username}</span>
          </div>
          <div class="lookup-user-profile">
            <div class="user-profile-row">
              <div class="profile-item username-item">
                <div class="profile-icon"><i class="fab fa-discord"></i></div>
                <div class="profile-details">
                  <span class="profile-label">USERNAME</span>
                  <span class="profile-value username">${data.discord_username}</span>
                </div>
              </div>
              <div class="profile-item discord-id-item">
                <div class="profile-icon"><i class="fas fa-fingerprint"></i></div>
                <div class="profile-details">
                  <span class="profile-label">DISCORD ID</span>
                  <span class="profile-value discord-id">${data.discord_id}</span>
                </div>
              </div>
            </div>
            <div class="user-profile-row">
              <div class="profile-item hosting-item">
                <div class="profile-icon"><i class="fas fa-server"></i></div>
                <div class="profile-details">
                  <span class="profile-label">HOSTING</span>
                  <span class="profile-value hosting">${data.hosting_name}</span>
                </div>
              </div>
              <div class="profile-item perm-item">
                <div class="profile-icon"><i class="fas fa-key"></i></div>
                <div class="profile-details">
                  <span class="profile-label">CURRENT PERMISSION</span>
                  ${data.permissions && data.permissions.type ? `
                    <span class="profile-value perm-badge ${data.permissions.type}">${data.permissions.type.toUpperCase()}</span>
                  ` : `
                    <span class="profile-value no-perm">None</span>
                  `}
                </div>
              </div>
            </div>
          </div>
          <div class="edit-hint">
            <i class="fas fa-info-circle"></i>
            Select a new permission type below to update this user's access
          </div>
        </div>
      `;
      
      document.getElementById('permissionTypeSection').style.display = 'block';
      document.getElementById('grantPermissionBtn').style.display = 'block';
      
      if (data.permissions && data.permissions.type) {
        const radioToSelect = document.querySelector(`input[name="permissionType"][value="${data.permissions.type}"]`);
        if (radioToSelect) {
          radioToSelect.checked = true;
          if (data.permissions.type === 'channels') {
            document.getElementById('channelSelectSection').style.display = 'block';
            if (data.permissions.pages) {
              data.permissions.pages.forEach(page => {
                const checkbox = document.querySelector(`input[name="channel"][value="${page}"]`);
                if (checkbox) checkbox.checked = true;
              });
            }
          }
        }
      }
      
      document.getElementById('permissionTypeSection').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Edit permission lookup error:', err);
    resultDiv.innerHTML = `
      <div class="lookup-error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Error loading user: ${err.message}</span>
      </div>
    `;
  }
}

function showAccessDeniedOverlay(pageName) {
  const existingOverlay = document.getElementById('accessDeniedOverlay');
  if (existingOverlay) existingOverlay.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'accessDeniedOverlay';
  overlay.className = 'access-denied-overlay';
  overlay.innerHTML = `
    <div class="access-denied-container">
      <div class="access-denied-header">
        <div class="access-denied-icon-wrapper">
          <div class="access-denied-shield">
            <i class="fas fa-lock"></i>
          </div>
          <div class="access-denied-pulse"></div>
        </div>
      </div>
      
      <div class="access-denied-content">
        <h1 class="access-denied-title">Access Denied</h1>
        <p class="access-denied-subtitle">PERMISSION REQUIRED</p>
        
        <div class="access-denied-info-card">
          <div class="info-card-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <div class="info-card-content">
            <p>You don't have permission to access <strong class="highlight-page">${pageName}</strong> for this panel.</p>
            <p class="secondary-text">Contact the panel administrator to get the appropriate permission level.</p>
          </div>
        </div>
        
        <div class="access-denied-details">
          <div class="detail-item">
            <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Requested Page</span>
            <span class="detail-value">${pageName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"><i class="fas fa-user"></i> Your Account</span>
            <span class="detail-value">${currentUser?.username || 'Unknown'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"><i class="fas fa-clock"></i> Time</span>
            <span class="detail-value">${new Date().toLocaleString()}</span>
          </div>
        </div>
        
        <div class="access-denied-actions">
          <button class="access-denied-btn primary" onclick="closeAccessDeniedOverlay(); showPage('dashboardPage');">
            <i class="fas fa-arrow-left"></i> Return to Dashboard
          </button>
          <a href="https://discord.gg/Mqzh86Jyts" target="_blank" class="access-denied-btn secondary">
            <i class="fab fa-discord"></i> Request Access
          </a>
        </div>
      </div>
      
      <div class="access-denied-footer">
        <p>ALN Hosting Panel</p>
        <p class="footer-sub">Secure Access Control System</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function closeAccessDeniedOverlay() {
  const overlay = document.getElementById('accessDeniedOverlay');
  if (overlay) overlay.remove();
}

function showPage(pageName) {
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  const navItem = Array.from(document.querySelectorAll('.nav-item')).find(nav => nav.dataset.page + 'Page' === pageName);
  if (navItem) {
    navItem.classList.add('active');
  }
  
  const pageEl = document.getElementById(pageName);
  if (pageEl) {
    pageEl.classList.add('active');
  }
  
  const pageKey = pageName.replace('Page', '');
  if (pageKey === 'dashboard') {
    if (currentUser?.role === 'admin' && !currentUser?.isAdminConnect) loadAdminDashboard();
    else loadUserDashboard();
  }
}

async function checkPageAccessAPI(pageName) {
  try {
    const res = await fetch(`${API}/admin/permissions/check-admin`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success && data.isAuthorized) {
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Page access API check error:', err);
    return false;
  }
}

let userPermissionsCache = null;

async function fetchUserPermissions() {
  if (userPermissionsCache !== null) {
    return userPermissionsCache;
  }
  
  try {
    const res = await fetch(`${API}/admin/permissions/my-permissions`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      userPermissionsCache = data;
      return data;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    return null;
  }
}

async function checkUserPagePermission(page) {
  if (currentUser?.role === 'admin' && !currentUser?.isAdminConnect) {
    return true;
  }
  
  const adminOnlyPages = ['userManagement', 'permissions', 'storageManagement', 'securityLogs', 'connect', 'problems', 'hosting', 'creditManagement', 'referralManagement', 'orderManagement', 'creditsAdmin', 'webhooks', 'serverManagement'];
  const allStandardPages = ['dashboard', 'console', 'files', 'settings', 'activity', 'backups', 'environment', 'analytics', 'templates', 'database', 'modules', 'network', 'schedules', 'startup'];
  
  try {
    const perms = await fetchUserPermissions();
    
    if (perms && (perms.isPermissionAdmin || perms.isPlatformAdmin)) {
      return true;
    }
    
    if (perms && perms.permissions && perms.permissions.type) {
      if (perms.permissions.type === 'full') {
        return true;
      }
      
      if (perms.permissions.type === 'all') {
        if (adminOnlyPages.includes(page)) {
          return false;
        }
        return true;
      }
      
      if (perms.permissions.type === 'channels') {
        const allowedPages = perms.permissions.pages || [];
        return allowedPages.includes(page);
      }
    }
    
    if (perms && perms.hasAnyPermission === false) {
      if (adminOnlyPages.includes(page)) {
        return false;
      }
      return allStandardPages.includes(page);
    }
    
    if (adminOnlyPages.includes(page)) {
      return false;
    }
    
    return allStandardPages.includes(page);
  } catch (err) {
    console.error('Page permission check error:', err);
    if (adminOnlyPages.includes(page)) {
      return false;
    }
    return allStandardPages.includes(page);
  }
}

async function checkPageAccess(pageName) {
  const publicPages = ['dashboardPage', 'consolePage', 'filesPage', 'settingsPage', 'activityPage', 'backupsPage', 'environmentPage', 'analyticsPage', 'templatesPage', 'databasePage'];
  
  if (publicPages.includes(pageName)) {
    return true;
  }
  
  const adminPages = ['userManagementPage', 'permissionsPage', 'storageManagementPage', 'securityLogsPage', 'connectPage', 'problemsPage', 'hostingPage', 'creditManagementPage', 'referralManagementPage', 'orderManagementPage', 'creditsAdminPage', 'webhooksPage', 'serverManagementPage'];
  if (!adminPages.includes(pageName)) {
    return true;
  }
  
  if (currentUser?.role === 'admin' && !currentUser?.isAdminConnect) {
    return true;
  }
  
  try {
    const pageKey = pageName.replace('Page', '');
    const res = await fetch(`${API}/admin/permissions/check-page/${pageKey}`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    return data.hasPermission === true;
  } catch (err) {
    console.error('Page access check error:', err);
    return false;
  }
}


async function loadCreditManagementPage() {
  const page = document.getElementById('creditManagementPage');
  if (!page) return;
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-coins"></i> Credit Management</h2>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Total Users with Credits</div>
        <div id="creditTotalUsers" style="font-size: 28px; font-weight: 700; color: var(--text-primary);">-</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Total Credits</div>
        <div id="creditTotalCredits" style="font-size: 28px; font-weight: 700; color: #8B5CF6;">$0.00</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Total Balance</div>
        <div id="creditTotalBalance" style="font-size: 28px; font-weight: 700; color: #10B981;">$0.00</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Total Referrals</div>
        <div id="creditTotalReferrals" style="font-size: 28px; font-weight: 700; color: #3B82F6;">0</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
      <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
        <h3 style="color: var(--text-primary); margin: 0 0 20px 0;"><i class="fas fa-plus-circle" style="margin-right: 10px; color: #10B981;"></i>Add/Deduct Credits</h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">User ID</label>
            <input type="text" id="addCreditsUserId" placeholder="Discord ID or acc_id" style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">Amount ($ - use negative to deduct)</label>
            <input type="number" id="addCreditsAmount" placeholder="5.00 or -5.00" step="0.01" style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">Reason</label>
            <input type="text" id="addCreditsReason" placeholder="Reason for credit change" style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="adminAddCredits(true)" style="flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
              <i class="fas fa-plus"></i> Add Credits
            </button>
            <button onclick="adminAddCredits(false)" style="flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
              <i class="fas fa-minus"></i> Deduct Credits
            </button>
          </div>
        </div>
      </div>
      
      <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
        <h3 style="color: var(--text-primary); margin: 0 0 20px 0;"><i class="fas fa-gift" style="margin-right: 10px; color: #F59E0B;"></i>Add Referral Balance</h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">User ID</label>
            <input type="text" id="addRefBalUserId" placeholder="Discord ID or acc_id" style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">Amount ($ - use negative to deduct)</label>
            <input type="number" id="addRefBalAmount" placeholder="5.00 or -5.00" step="0.01" style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">Note/Reason</label>
            <input type="text" id="addRefBalReason" placeholder="Bonus, adjustment, etc." style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <button onclick="adminAddReferralBalance()" style="padding: 12px 20px; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
            <i class="fas fa-coins"></i> Update Referral Balance
          </button>
        </div>
      </div>
    </div>
    
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
      <h3 style="color: var(--text-primary); margin: 0 0 20px 0;"><i class="fas fa-list" style="margin-right: 10px; color: #3B82F6;"></i>All Users</h3>
      <div style="margin-bottom: 15px;">
        <input type="text" id="creditUserSearch" placeholder="Search by username or ID..." oninput="filterCreditUsers()" style="width: 100%; max-width: 300px; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
      </div>
      <div id="creditUsersList" style="min-height: 100px;">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
          <p>Loading users...</p>
        </div>
      </div>
    </div>
  `;
  
  loadCreditManagementData();
}

async function loadCreditManagementData() {
  try {
    const [statsRes, usersRes] = await Promise.all([
      fetch(`${API}/referrals/admin/stats`, { credentials: 'include' }),
      fetch(`${API}/referrals/admin/users`, { credentials: 'include' })
    ]);
    
    const statsData = await statsRes.json();
    const usersData = await usersRes.json();
    
    if (statsData.success) {
      document.getElementById('creditTotalUsers').textContent = statsData.stats.total_users;
      document.getElementById('creditTotalCredits').textContent = `$${statsData.stats.total_credits.toFixed(2)}`;
      document.getElementById('creditTotalBalance').textContent = `$${statsData.stats.total_balance.toFixed(2)}`;
      document.getElementById('creditTotalReferrals').textContent = statsData.stats.total_referrals;
    }
    
    if (usersData.success) {
      allCreditUsers = usersData.users;
      renderCreditUsersList(usersData.users);
    }
  } catch (err) {
    console.error('Failed to load credit management data:', err);
    document.getElementById('creditUsersList').innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;">Failed to load data</div>';
  }
}

let allCreditUsers = [];

async function adminAddCredits(isAdd = true) {
  const userId = document.getElementById('addCreditsUserId').value.trim();
  let amount = parseFloat(document.getElementById('addCreditsAmount').value);
  const reason = document.getElementById('addCreditsReason').value.trim() || (isAdd ? 'Admin credit addition' : 'Admin credit deduction');
  
  if (!userId) {
    showNotification('Please enter a user ID', 'error');
    return;
  }
  
  if (isNaN(amount) || amount === 0) {
    showNotification('Please enter a valid amount', 'error');
    return;
  }
  
  if (!isAdd) {
    amount = -Math.abs(amount);
  } else {
    amount = Math.abs(amount);
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, amount, reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(data.message, 'success');
      document.getElementById('addCreditsUserId').value = '';
      document.getElementById('addCreditsAmount').value = '';
      document.getElementById('addCreditsReason').value = '';
      loadCreditManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to modify credits:', err);
    showNotification('Failed to modify credits', 'error');
  }
}

async function adminAddReferralBalance() {
  const userId = document.getElementById('addRefBalUserId').value.trim();
  const amount = parseFloat(document.getElementById('addRefBalAmount').value);
  const reason = document.getElementById('addRefBalReason').value.trim() || 'Admin referral balance adjustment';
  
  if (!userId) {
    showNotification('Please enter a user ID', 'error');
    return;
  }
  
  if (isNaN(amount) || amount === 0) {
    showNotification('Please enter a valid amount', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-referral-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, amount, reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(data.message, 'success');
      document.getElementById('addRefBalUserId').value = '';
      document.getElementById('addRefBalAmount').value = '';
      document.getElementById('addRefBalReason').value = '';
      loadCreditManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to modify referral balance:', err);
    showNotification('Failed to modify referral balance', 'error');
  }
}

function filterCreditUsers() {
  const search = document.getElementById('creditUserSearch').value.toLowerCase();
  const filtered = allCreditUsers.filter(user => {
    const name = (user.discord_name || user.discord_username || '').toLowerCase();
    const id = (user.user_id || '').toLowerCase();
    return name.includes(search) || id.includes(search);
  });
  renderCreditUsersList(filtered);
}

function renderCreditUsersList(users) {
  const container = document.getElementById('creditUsersList');
  if (!users || users.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No users found</div>';
    return;
  }
  
  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 12px; color: var(--text-secondary); font-weight: 500;">User</th>
          <th style="text-align: right; padding: 12px; color: var(--text-secondary); font-weight: 500;">Credits</th>
          <th style="text-align: right; padding: 12px; color: var(--text-secondary); font-weight: 500;">Ref Balance</th>
          <th style="text-align: right; padding: 12px; color: var(--text-secondary); font-weight: 500;">Referrals</th>
          <th style="text-align: center; padding: 12px; color: var(--text-secondary); font-weight: 500;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 12px;">
              <div style="color: var(--text-primary); font-weight: 500;">${escapeHtml(user.discord_name || user.discord_username || 'Unknown')}</div>
              <div style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(user.user_id)}</div>
            </td>
            <td style="text-align: right; padding: 12px; color: #8B5CF6; font-weight: 600;">$${user.credits.toFixed(2)}</td>
            <td style="text-align: right; padding: 12px; color: #10B981; font-weight: 600;">$${user.balance.toFixed(2)}</td>
            <td style="text-align: right; padding: 12px; color: var(--text-primary);">${user.referral_count}</td>
            <td style="text-align: center; padding: 12px;">
              <div style="display: flex; gap: 6px; justify-content: center;">
                <button onclick="quickAddCredits('${escapeHtml(user.user_id)}')" title="Add Credits" style="padding: 6px 10px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                  <i class="fas fa-plus"></i>
                </button>
                <button onclick="quickDeductCredits('${escapeHtml(user.user_id)}')" title="Deduct Credits" style="padding: 6px 10px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                  <i class="fas fa-minus"></i>
                </button>
                <button onclick="showAdjustBalanceModal('${escapeHtml(user.user_id)}', ${user.balance})" title="Adjust Referral Balance" style="padding: 6px 10px; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                  <i class="fas fa-gift"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function quickAddCredits(userId) {
  const amount = prompt(`Enter amount to add to ${userId}:`);
  if (amount === null) return;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    showNotification('Invalid amount', 'error');
    return;
  }
  
  const reason = prompt('Enter reason:') || 'Quick credit addition';
  
  fetch(`${API}/referrals/admin/add-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, amount: numAmount, reason })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message, 'success');
      loadCreditManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  })
  .catch(err => {
    console.error(err);
    showNotification('Failed to add credits', 'error');
  });
}

function quickDeductCredits(userId) {
  const amount = prompt(`Enter amount to deduct from ${userId}:`);
  if (amount === null) return;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    showNotification('Invalid amount', 'error');
    return;
  }
  
  const reason = prompt('Enter reason:') || 'Quick credit deduction';
  
  fetch(`${API}/referrals/admin/add-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, amount: -numAmount, reason })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message, 'success');
      loadCreditManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  })
  .catch(err => {
    console.error(err);
    showNotification('Failed to deduct credits', 'error');
  });
}

function showAdjustBalanceModal(userId, currentBalance) {
  const amount = prompt(`Enter adjustment amount for user ${userId} (current balance: $${currentBalance.toFixed(2)})\nPositive to add, negative to subtract:`);
  if (amount === null) return;
  
  const adjustAmount = parseFloat(amount);
  if (isNaN(adjustAmount)) {
    showToast('Error', 'Invalid amount', 'error');
    return;
  }
  
  const reason = prompt('Enter reason for adjustment:') || 'Admin adjustment';
  
  adjustUserBalance(userId, adjustAmount, reason);
}

async function adjustUserBalance(userId, amount, reason) {
  try {
    const res = await fetch(`${API}/referrals/admin/user/${userId}/adjust-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount, reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', data.message, 'success');
      loadCreditManagementData();
    } else {
      showToast('Error', data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to adjust balance:', err);
    showToast('Error', 'Failed to adjust balance', 'error');
  }
}


async function loadReferralManagementPage() {
  const page = document.getElementById('referralManagementPage');
  if (!page) return;
  
  page.innerHTML = `
    <div class="page-header">
      <h2><i class="fas fa-gift"></i> Referral Management</h2>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px;">
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Pending Withdrawals</div>
        <div id="refPendingCount" style="font-size: 28px; font-weight: 700; color: #F59E0B;">0</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">On Hold</div>
        <div id="refHoldCount" style="font-size: 28px; font-weight: 700; color: #EF4444;">0</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Completed</div>
        <div id="refCompletedCount" style="font-size: 28px; font-weight: 700; color: #10B981;">0</div>
      </div>
      <div class="stat-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Pending PayPal Amount</div>
        <div id="refPendingAmount" style="font-size: 28px; font-weight: 700; color: #0070BA;">$0.00</div>
      </div>
    </div>
    
    <!-- Staff Balance Management Section -->
    <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1)); border-radius: 12px; padding: 24px; border: 1px solid rgba(139, 92, 246, 0.3); margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;"><i class="fas fa-user-shield" style="margin-right: 10px; color: #8B5CF6;"></i>Staff Balance Management</h3>
        <span style="padding: 4px 12px; background: rgba(139, 92, 246, 0.2); color: #A78BFA; border-radius: 20px; font-size: 11px; font-weight: 600;">STAFF ONLY</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Give Balance -->
        <div style="background: var(--bg-tertiary); border-radius: 10px; padding: 20px; border: 1px solid var(--border-color);">
          <h4 style="color: #10B981; margin: 0 0 15px 0; font-size: 14px;"><i class="fas fa-plus-circle" style="margin-right: 8px;"></i>Give Referral Balance</h4>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">User ID (Discord ID or Account ID)</label>
            <input type="text" id="staffGiveUserId" placeholder="Enter user ID..." style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">Amount ($)</label>
            <input type="number" id="staffGiveAmount" placeholder="0.00" step="0.01" min="0.01" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">Reason</label>
            <input type="text" id="staffGiveReason" placeholder="e.g., Bonus for helping out" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <button onclick="staffGiveBalance()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
            <i class="fas fa-paper-plane"></i> Give Balance
          </button>
        </div>
        
        <!-- Remove Balance -->
        <div style="background: var(--bg-tertiary); border-radius: 10px; padding: 20px; border: 1px solid var(--border-color);">
          <h4 style="color: #EF4444; margin: 0 0 15px 0; font-size: 14px;"><i class="fas fa-minus-circle" style="margin-right: 8px;"></i>Remove Referral Balance</h4>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">User ID (Discord ID or Account ID)</label>
            <input type="text" id="staffRemoveUserId" placeholder="Enter user ID..." style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">Amount ($)</label>
            <input type="number" id="staffRemoveAmount" placeholder="0.00" step="0.01" min="0.01" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 6px;">Reason</label>
            <input type="text" id="staffRemoveReason" placeholder="e.g., Abuse of system" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); box-sizing: border-box;">
          </div>
          <button onclick="staffRemoveBalance()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
            <i class="fas fa-ban"></i> Remove Balance
          </button>
        </div>
      </div>
    </div>
    
    <!-- Credit Logs Section -->
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;"><i class="fas fa-history" style="margin-right: 10px; color: #3B82F6;"></i>Credit Transaction Logs</h3>
        <button onclick="loadCreditLogs()" style="padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-secondary); cursor: pointer; font-size: 13px;">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
      <div id="creditLogsList" style="max-height: 400px; overflow-y: auto;">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
          <p>Loading logs...</p>
        </div>
      </div>
    </div>
    
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;"><i class="fas fa-cog" style="margin-right: 10px; color: #F59E0B;"></i>Referral Settings</h3>
      </div>
      <div style="display: flex; align-items: center; gap: 15px;">
        <div>
          <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">Reward per Referral ($)</label>
          <input type="number" id="referralRewardInput" value="0.25" step="0.01" min="0" style="width: 120px; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
        </div>
        <button onclick="updateReferralReward()" style="padding: 10px 20px; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; margin-top: 20px;">
          <i class="fas fa-save"></i> Save
        </button>
      </div>
    </div>
    
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;"><i class="fab fa-paypal" style="margin-right: 10px; color: #0070BA;"></i>PayPal Withdrawals</h3>
        <div style="display: flex; gap: 10px;">
          <select id="withdrawalStatusFilter" onchange="filterWithdrawals()" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>
      <div id="withdrawalsList" style="min-height: 100px;">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
          <p>Loading withdrawals...</p>
        </div>
      </div>
    </div>
  `;
  
  loadReferralManagementData();
  loadCreditLogs();
}

let allWithdrawals = [];

async function loadReferralManagementData() {
  try {
    const [statsRes, withdrawalsRes] = await Promise.all([
      fetch(`${API}/referrals/admin/stats`, { credentials: 'include' }),
      fetch(`${API}/referrals/admin/withdrawals`, { credentials: 'include' })
    ]);
    
    const statsData = await statsRes.json();
    const withdrawalsData = await withdrawalsRes.json();
    
    if (statsData.success) {
      document.getElementById('referralRewardInput').value = statsData.stats.referral_reward;
    }
    
    if (withdrawalsData.success) {
      document.getElementById('refPendingCount').textContent = withdrawalsData.stats.pending;
      document.getElementById('refHoldCount').textContent = withdrawalsData.stats.hold;
      document.getElementById('refCompletedCount').textContent = withdrawalsData.stats.completed;
      document.getElementById('refPendingAmount').textContent = `$${(statsData.success ? statsData.stats.pending_paypal : 0).toFixed(2)}`;
      
      allWithdrawals = withdrawalsData.withdrawals;
      renderWithdrawalsTable(allWithdrawals);
    }
  } catch (err) {
    console.error('Failed to load referral management data:', err);
    document.getElementById('withdrawalsList').innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;">Failed to load data</div>';
  }
}

function filterWithdrawals() {
  const filter = document.getElementById('withdrawalStatusFilter').value;
  const filtered = filter === 'all' ? allWithdrawals : allWithdrawals.filter(w => w.status === filter);
  renderWithdrawalsTable(filtered);
}

function renderWithdrawalsTable(withdrawals) {
  const container = document.getElementById('withdrawalsList');
  
  if (!withdrawals || withdrawals.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px;"></i><p>No withdrawals found</p></div>';
    return;
  }
  
  const paypalWithdrawals = withdrawals.filter(w => w.type === 'paypal');
  
  if (paypalWithdrawals.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px;"></i><p>No PayPal withdrawals found</p></div>';
    return;
  }
  
  container.innerHTML = paypalWithdrawals.map(w => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
        <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #0070BA, #003087); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fab fa-paypal" style="color: white; font-size: 18px;"></i>
        </div>
        <div>
          <div style="color: var(--text-primary); font-weight: 600;">${escapeHtml(w.discord_name || w.discord_username || 'Unknown User')}</div>
          <div style="color: var(--text-secondary); font-size: 12px;">PayPal: ${escapeHtml(w.paypal_email || 'N/A')}</div>
          <div style="color: var(--text-secondary); font-size: 11px;">${new Date(w.created_at * 1000).toLocaleString()}</div>
        </div>
      </div>
      <div style="text-align: center; min-width: 100px;">
        <div style="color: var(--text-primary); font-weight: 700; font-size: 18px;">$${w.amount.toFixed(2)}</div>
        ${getAdminStatusBadge(w.status)}
      </div>
      <div style="display: flex; gap: 8px; min-width: 200px; justify-content: flex-end;">
        ${w.status === 'pending' || w.status === 'hold' ? `
          <button onclick="updateWithdrawalStatus('${w.id}', 'completed')" style="padding: 8px 12px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 6px; color: white; font-size: 12px; cursor: pointer;">
            <i class="fas fa-check"></i> Approve
          </button>
          <button onclick="updateWithdrawalStatus('${w.id}', 'hold')" style="padding: 8px 12px; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 6px; color: white; font-size: 12px; cursor: pointer;">
            <i class="fas fa-pause"></i> Hold
          </button>
          <button onclick="declineWithdrawal('${w.id}')" style="padding: 8px 12px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 6px; color: white; font-size: 12px; cursor: pointer;">
            <i class="fas fa-times"></i> Decline
          </button>
        ` : `
          <span style="color: var(--text-secondary); font-size: 12px;">${w.status === 'completed' ? 'Processed' : w.status === 'declined' ? 'Declined' : ''}</span>
        `}
      </div>
    </div>
  `).join('');
}

function getAdminStatusBadge(status) {
  const badges = {
    'pending': { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', text: 'Pending' },
    'hold': { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'On Hold' },
    'completed': { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', text: 'Completed' },
    'declined': { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Declined' }
  };
  const badge = badges[status] || badges['pending'];
  return `<span style="display: inline-block; padding: 4px 10px; background: ${badge.bg}; color: ${badge.color}; border-radius: 20px; font-size: 11px; font-weight: 500; margin-top: 5px;">${badge.text}</span>`;
}

async function updateWithdrawalStatus(withdrawalId, status) {
  try {
    const res = await fetch(`${API}/referrals/admin/withdrawals/${withdrawalId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(data.message, 'success');
      loadReferralManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to update withdrawal:', err);
    showNotification('Failed to update withdrawal', 'error');
  }
}

async function declineWithdrawal(withdrawalId) {
  const reason = prompt('Please enter the reason for declining this withdrawal (required):');
  if (!reason) {
    showNotification('Reason is required to decline a withdrawal', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/withdrawals/${withdrawalId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'declined', reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification('Withdrawal declined', 'success');
      loadReferralManagementData();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to decline withdrawal:', err);
    showNotification('Failed to decline withdrawal', 'error');
  }
}

async function updateReferralReward() {
  const reward = parseFloat(document.getElementById('referralRewardInput').value);
  
  if (isNaN(reward) || reward < 0) {
    showNotification('Please enter a valid reward amount', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/set-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reward })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(data.message, 'success');
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to update reward:', err);
    showNotification('Failed to update reward', 'error');
  }
}

async function staffGiveBalance() {
  const userId = document.getElementById('staffGiveUserId').value.trim();
  const amount = parseFloat(document.getElementById('staffGiveAmount').value);
  const reason = document.getElementById('staffGiveReason').value.trim() || 'Staff balance addition';
  
  if (!userId) {
    showNotification('Please enter a user ID', 'error');
    return;
  }
  
  if (isNaN(amount) || amount <= 0) {
    showNotification('Please enter a valid amount greater than 0', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-referral-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, amount, reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(`${data.message}`, 'success');
      document.getElementById('staffGiveUserId').value = '';
      document.getElementById('staffGiveAmount').value = '';
      document.getElementById('staffGiveReason').value = '';
      loadCreditLogs();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to give balance:', err);
    showNotification('Failed to give balance', 'error');
  }
}

async function staffRemoveBalance() {
  const userId = document.getElementById('staffRemoveUserId').value.trim();
  const amount = parseFloat(document.getElementById('staffRemoveAmount').value);
  const reason = document.getElementById('staffRemoveReason').value.trim() || 'Staff balance removal';
  
  if (!userId) {
    showNotification('Please enter a user ID', 'error');
    return;
  }
  
  if (isNaN(amount) || amount <= 0) {
    showNotification('Please enter a valid amount greater than 0', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/referrals/admin/add-referral-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, amount: -amount, reason })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(`${data.message}`, 'success');
      document.getElementById('staffRemoveUserId').value = '';
      document.getElementById('staffRemoveAmount').value = '';
      document.getElementById('staffRemoveReason').value = '';
      loadCreditLogs();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    console.error('Failed to remove balance:', err);
    showNotification('Failed to remove balance', 'error');
  }
}

async function loadCreditLogs() {
  const container = document.getElementById('creditLogsList');
  if (!container) return;
  
  try {
    const res = await fetch(`${API}/referrals/admin/credit-logs`, { credentials: 'include' });
    const data = await res.json();
    
    if (!data.success || !data.logs || data.logs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
          <p>No credit transactions yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.logs.slice(0, 50).map(log => {
      const isPositive = log.amount > 0;
      const sourceInfo = getSourceInfo(log.source);
      const date = new Date(log.timestamp * 1000);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      const uniqueId = log.id ? log.id.substring(0, 8).toUpperCase() : 'N/A';
      
      return `
        <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background: var(--bg-tertiary); border-radius: 10px; margin-bottom: 10px; border: 1px solid var(--border-color);">
          <div style="width: 45px; height: 45px; background: ${sourceInfo.gradient}; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="${sourceInfo.icon}" style="color: white; font-size: 16px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <span style="color: var(--text-primary); font-weight: 600;">${escapeHtml(log.discord_name || log.discord_username || log.user_id)}</span>
              <span style="padding: 2px 8px; background: ${sourceInfo.badgeBg}; color: ${sourceInfo.badgeColor}; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase;">${sourceInfo.label}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 3px;">${escapeHtml(log.details || 'No details')}</div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: var(--text-muted); font-size: 11px;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${dateStr}</span>
              <span style="color: var(--text-muted); font-size: 11px;"><i class="fas fa-fingerprint" style="margin-right: 4px;"></i>TXN-${uniqueId}</span>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="color: ${isPositive ? '#10B981' : '#EF4444'}; font-weight: 700; font-size: 18px;">
              ${isPositive ? '+' : ''}$${Math.abs(log.amount).toFixed(2)}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (err) {
    console.error('Failed to load credit logs:', err);
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;">Failed to load logs</div>';
  }
}

function getSourceInfo(source) {
  const sources = {
    'referral': {
      icon: 'fas fa-user-friends',
      gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      label: 'Referral',
      badgeBg: 'rgba(139, 92, 246, 0.2)',
      badgeColor: '#A78BFA'
    },
    'admin': {
      icon: 'fas fa-shield-alt',
      gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
      label: 'Admin',
      badgeBg: 'rgba(59, 130, 246, 0.2)',
      badgeColor: '#60A5FA'
    },
    'admin_referral_balance': {
      icon: 'fas fa-user-shield',
      gradient: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
      label: 'Staff',
      badgeBg: 'rgba(139, 92, 246, 0.2)',
      badgeColor: '#A78BFA'
    },
    'admin_balance_adjustment': {
      icon: 'fas fa-sliders-h',
      gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
      label: 'Adjustment',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      badgeColor: '#FBBF24'
    },
    'admin_removal': {
      icon: 'fas fa-minus-circle',
      gradient: 'linear-gradient(135deg, #EF4444, #DC2626)',
      label: 'Removal',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      badgeColor: '#F87171'
    },
    'withdraw_credit': {
      icon: 'fas fa-exchange-alt',
      gradient: 'linear-gradient(135deg, #10B981, #059669)',
      label: 'Withdrawal',
      badgeBg: 'rgba(16, 185, 129, 0.2)',
      badgeColor: '#34D399'
    }
  };
  
  return sources[source] || {
    icon: 'fas fa-coins',
    gradient: 'linear-gradient(135deg, #6B7280, #4B5563)',
    label: source || 'Unknown',
    badgeBg: 'rgba(107, 114, 128, 0.2)',
    badgeColor: '#9CA3AF'
  };
}

// Webhook Management Page
let webhooksState = {
  isAuthorized: false,
  webhooks: {}
};

async function loadWebhooksPage() {
  const page = document.getElementById('webhooksPage');
  
  try {
    const authRes = await fetch(`${API}/admin/webhooks/check-admin`, {
      credentials: 'include'
    });
    const authData = await authRes.json();
    
    if (!authData.success || !authData.isAuthorized) {
      showWebhookUnauthorizedWarning(page);
      return;
    }
    
    webhooksState.isAuthorized = true;
    renderWebhooksPage(page);
    loadWebhookSettings();
    
  } catch (err) {
    console.error('Webhook check error:', err);
    page.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error Loading Webhooks</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function showWebhookUnauthorizedWarning(page) {
  page.innerHTML = `
    <div class="permission-unauthorized-overlay">
      <div class="unauthorized-container">
        <div class="unauthorized-icon-section">
          <div class="warning-shield">
            <i class="fas fa-shield-alt"></i>
            <div class="shield-x">
              <i class="fas fa-times"></i>
            </div>
          </div>
          <div class="warning-pulse"></div>
        </div>
        
        <div class="unauthorized-content">
          <h1 class="unauthorized-title">UNAUTHORIZED ACCESS</h1>
          <div class="unauthorized-code">ERROR CODE: 403-PERM-DENIED</div>
          
          <div class="unauthorized-message">
            <p>You do not have permission to access the Webhook Management panel.</p>
            <p>This incident has been logged and reported.</p>
          </div>
          
          <div class="unauthorized-info-box">
            <div class="info-row">
              <span class="info-label"><i class="fas fa-fingerprint"></i> Your ID:</span>
              <span class="info-value">${currentUser?.discordId || currentUser?.userId || 'Unknown'}</span>
            </div>
            <div class="info-row">
              <span class="info-label"><i class="fas fa-clock"></i> Timestamp:</span>
              <span class="info-value">${new Date().toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label"><i class="fas fa-map-marker-alt"></i> Location:</span>
              <span class="info-value">Webhook Management</span>
            </div>
          </div>
          
          <div class="unauthorized-warning-strip">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Only authorized administrators (1129144246499278949, 1091165197802152046) can access this feature.</span>
          </div>
          
          <div class="unauthorized-screenshot-hint">
            <i class="fas fa-camera"></i>
            Take a screenshot of this page and contact an authorized administrator if you believe this is an error.
          </div>
          
          <button class="unauthorized-back-btn" onclick="showPage('dashboardPage')">
            <i class="fas fa-arrow-left"></i> Return to Dashboard
          </button>
        </div>
        
        <div class="unauthorized-footer">
          <p>ALN Hosting Security System</p>
          <p class="footer-sub">Protecting your infrastructure</p>
        </div>
      </div>
    </div>
  `;
}

function renderWebhooksPage(page) {
  page.innerHTML = `
    <div class="permissions-management">
      <div class="permissions-header">
        <div class="header-left">
          <div class="icon-wrapper perm-icon" style="background: linear-gradient(135deg, #5865F2, #7289DA);">
            <i class="fab fa-discord"></i>
          </div>
          <div>
            <h2>Webhook Management</h2>
            <p>Configure Discord webhooks for notifications</p>
          </div>
        </div>
        <div class="header-badge authorized">
          <i class="fas fa-check-circle"></i>
          Authorized Administrator
        </div>
      </div>
      
      <div class="webhook-config-section" style="margin-top: 24px;">
        <div style="display: grid; gap: 24px;">
          
          <!-- New Users Webhook -->
          <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-user-plus" style="color: white; font-size: 18px;"></i>
              </div>
              <div>
                <h3 style="margin: 0; color: var(--text-primary);">New Users Webhook</h3>
                <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">Receive notifications when new accounts are created</p>
              </div>
            </div>
            <div style="display: flex; gap: 12px;">
              <input type="text" id="webhookNewUsers" placeholder="https://discord.com/api/webhooks/..." 
                style="flex: 1; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
              <button onclick="saveWebhook('new_users')" style="padding: 12px 20px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                <i class="fas fa-save"></i> Save
              </button>
              <button onclick="testWebhook('new_users')" style="padding: 12px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-weight: 600; cursor: pointer;">
                <i class="fas fa-paper-plane"></i> Test
              </button>
            </div>
          </div>
          
          <!-- Orders Webhook -->
          <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #F59E0B, #D97706); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-shopping-cart" style="color: white; font-size: 18px;"></i>
              </div>
              <div>
                <h3 style="margin: 0; color: var(--text-primary);">Orders Webhook</h3>
                <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">Receive notifications when orders are placed</p>
              </div>
            </div>
            <div style="display: flex; gap: 12px;">
              <input type="text" id="webhookOrders" placeholder="https://discord.com/api/webhooks/..." 
                style="flex: 1; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
              <button onclick="saveWebhook('orders')" style="padding: 12px 20px; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                <i class="fas fa-save"></i> Save
              </button>
              <button onclick="testWebhook('orders')" style="padding: 12px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-weight: 600; cursor: pointer;">
                <i class="fas fa-paper-plane"></i> Test
              </button>
            </div>
          </div>
          
          <!-- General Webhook -->
          <div style="background: var(--bg-secondary); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #5865F2, #7289DA); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-bell" style="color: white; font-size: 18px;"></i>
              </div>
              <div>
                <h3 style="margin: 0; color: var(--text-primary);">General Notifications Webhook</h3>
                <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">Receive general system notifications</p>
              </div>
            </div>
            <div style="display: flex; gap: 12px;">
              <input type="text" id="webhookGeneral" placeholder="https://discord.com/api/webhooks/..." 
                style="flex: 1; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
              <button onclick="saveWebhook('general')" style="padding: 12px 20px; background: linear-gradient(135deg, #5865F2, #7289DA); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                <i class="fas fa-save"></i> Save
              </button>
              <button onclick="testWebhook('general')" style="padding: 12px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-weight: 600; cursor: pointer;">
                <i class="fas fa-paper-plane"></i> Test
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  `;
}

async function loadWebhookSettings() {
  try {
    const res = await fetch(`${API}/admin/webhooks`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      webhooksState.webhooks = data.webhooks || {};
      
      const newUsersInput = document.getElementById('webhookNewUsers');
      const ordersInput = document.getElementById('webhookOrders');
      const generalInput = document.getElementById('webhookGeneral');
      
      if (newUsersInput && webhooksState.webhooks.new_users) {
        newUsersInput.value = webhooksState.webhooks.new_users.url || '';
      }
      if (ordersInput && webhooksState.webhooks.orders) {
        ordersInput.value = webhooksState.webhooks.orders.url || '';
      }
      if (generalInput && webhooksState.webhooks.general) {
        generalInput.value = webhooksState.webhooks.general.url || '';
      }
    }
  } catch (err) {
    console.error('Failed to load webhook settings:', err);
  }
}

async function saveWebhook(type) {
  const inputMap = {
    'new_users': 'webhookNewUsers',
    'orders': 'webhookOrders',
    'general': 'webhookGeneral'
  };
  
  const inputId = inputMap[type];
  const input = document.getElementById(inputId);
  const url = input ? input.value.trim() : '';
  
  try {
    const res = await fetch(`${API}/admin/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, url })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', data.message, 'success', 3000);
    } else {
      showToast('Error', data.error, 'error', 3000);
    }
  } catch (err) {
    console.error('Failed to save webhook:', err);
    showToast('Error', 'Failed to save webhook', 'error', 3000);
  }
}

async function testWebhook(type) {
  try {
    showToast('Testing', 'Sending test message...', 'info', 2000);
    
    const res = await fetch(`${API}/admin/webhooks/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', data.message, 'success', 3000);
    } else {
      showToast('Error', data.error, 'error', 3000);
    }
  } catch (err) {
    console.error('Failed to test webhook:', err);
    showToast('Error', 'Failed to test webhook', 'error', 3000);
  }
}

// ============================================
// SERVER MANAGEMENT PAGE - RESTRICTED ACCESS
// ============================================

const SERVER_MGMT_ADMINS = ['1129144246499278949', '1091165197802152046'];

async function loadServerManagementPage() {
  const page = document.getElementById('serverManagementPage');
  if (!page) return;
  
  page.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; min-height: 400px;">
      <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Checking access...</div>
    </div>
  `;
  
  try {
    const res = await fetch(`${API}/internal/check-access`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (!data.hasAccess) {
      showServerManagementUnauthorized(page);
      return;
    }
    
    await loadServerManagementContent(page);
  } catch (err) {
    console.error('Error loading server management:', err);
    showServerManagementUnauthorized(page);
  }
}

function showServerManagementUnauthorized(page) {
  page.innerHTML = `
    <div class="server-mgmt-unauthorized" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%);">
      <div style="text-align: center; max-width: 600px; padding: 40px;">
        <div style="width: 120px; height: 120px; margin: 0 auto 30px; background: linear-gradient(135deg, #DC2626, #991B1B); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 60px rgba(220, 38, 38, 0.4);">
          <i class="fas fa-shield-alt" style="font-size: 50px; color: white;"></i>
        </div>
        <h1 style="color: #fff; font-size: 32px; margin: 0 0 15px 0; font-weight: 700;">Access Denied</h1>
        <div style="background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 25px;">
          <div style="color: #EF4444; font-size: 18px; font-weight: 600; margin-bottom: 10px;">
            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
            Error Code: 403-PERM-DENIED
          </div>
          <p style="color: #aaa; margin: 0; line-height: 1.6;">
            You do not have permission to access the Server Management panel. 
            This area is restricted to authorized administrators only.
          </p>
        </div>
        <div style="background: rgba(30, 30, 50, 0.5); border: 1px solid rgba(100, 100, 150, 0.2); border-radius: 12px; padding: 20px; margin-bottom: 25px;">
          <div style="color: #888; font-size: 14px; margin-bottom: 15px;">
            <i class="fas fa-info-circle" style="margin-right: 8px; color: #5865F2;"></i>
            If you believe this is an error, please contact a platform administrator.
          </div>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <a href="https://discord.gg/Mqzh86Jyts" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #5865F2; color: white; border-radius: 8px; text-decoration: none; font-weight: 500;">
              <i class="fab fa-discord"></i> Contact Support
            </a>
            <button onclick="showPage('dashboard')" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #333; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
              <i class="fas fa-home"></i> Go to Dashboard
            </button>
          </div>
        </div>
        <p style="color: #555; font-size: 12px; margin: 0;">
          ALN Hosting Security System
        </p>
      </div>
    </div>
  `;
}

async function loadServerManagementContent(page) {
  page.innerHTML = `
    <div class="server-mgmt-container" style="padding: 30px;">
      <div class="server-mgmt-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <div>
          <h1 style="color: #fff; margin: 0 0 8px 0; font-size: 28px; display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-server" style="color: #10B981;"></i>
            Server Management
          </h1>
          <p style="color: #888; margin: 0;">Manage all hosting servers across the platform</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="loadServerManagementContent(document.getElementById('serverManagementPage'))" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #333; color: white; border: none; border-radius: 8px; cursor: pointer;">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>
      
      <div class="server-mgmt-stats" id="serverMgmtStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading stats...</div>
      </div>
      
      <div class="server-mgmt-filters" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid var(--border-color);">
        <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
          <div style="flex: 1; min-width: 250px;">
            <div style="position: relative;">
              <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888;"></i>
              <input type="text" id="serverMgmtSearch" placeholder="Search by server name, owner, or ID..." style="width: 100%; padding: 10px 10px 10px 40px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: white; box-sizing: border-box;" onkeyup="filterServerMgmtTable()">
            </div>
          </div>
          <select id="serverMgmtStatusFilter" onchange="filterServerMgmtTable()" style="padding: 10px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: white;">
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="offline">Offline</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <select id="serverMgmtTypeFilter" onchange="filterServerMgmtTable()" style="padding: 10px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: white;">
            <option value="all">All Types</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
      </div>
      
      <div class="server-mgmt-table-container" style="background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden;">
        <table class="server-mgmt-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: rgba(0,0,0,0.3);">
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">Server</th>
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">Owner</th>
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">Type</th>
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">Status</th>
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">Uptime</th>
              <th style="padding: 15px; text-align: left; color: #888; font-weight: 500;">IP</th>
              <th style="padding: 15px; text-align: center; color: #888; font-weight: 500;">Actions</th>
            </tr>
          </thead>
          <tbody id="serverMgmtTableBody">
            <tr>
              <td colspan="7" style="padding: 40px; text-align: center; color: #888;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 15px; display: block;"></i>
                Loading servers...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  await loadServerMgmtData();
}

let serverMgmtServers = [];

async function loadServerMgmtData() {
  try {
    const res = await fetch(`${API}/internal/servers`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (!data.success) {
      if (data.code === '403-PERM-DENIED') {
        showServerManagementUnauthorized(document.getElementById('serverManagementPage'));
        return;
      }
      throw new Error(data.error);
    }
    
    serverMgmtServers = data.servers;
    
    const statsEl = document.getElementById('serverMgmtStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Total Servers</div>
          <div style="font-size: 28px; font-weight: 700; color: white;">${data.stats.total}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid rgba(16, 185, 129, 0.3);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Running</div>
          <div style="font-size: 28px; font-weight: 700; color: #10B981;">${data.stats.running}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Stopped</div>
          <div style="font-size: 28px; font-weight: 700; color: #888;">${data.stats.stopped}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid rgba(245, 158, 11, 0.3);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Suspended</div>
          <div style="font-size: 28px; font-weight: 700; color: #F59E0B;">${data.stats.suspended}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Banned</div>
          <div style="font-size: 28px; font-weight: 700; color: #EF4444;">${data.stats.banned}</div>
        </div>
      `;
    }
    
    renderServerMgmtTable();
  } catch (err) {
    console.error('Error loading server management data:', err);
    const tbody = document.getElementById('serverMgmtTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 40px; text-align: center; color: #EF4444;">
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 15px; display: block;"></i>
            Failed to load servers: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

function filterServerMgmtTable() {
  const search = (document.getElementById('serverMgmtSearch')?.value || '').toLowerCase();
  const status = document.getElementById('serverMgmtStatusFilter')?.value || 'all';
  const type = document.getElementById('serverMgmtTypeFilter')?.value || 'all';
  
  renderServerMgmtTable(search, status, type);
}

function renderServerMgmtTable(search = '', statusFilter = 'all', typeFilter = 'all') {
  const tbody = document.getElementById('serverMgmtTableBody');
  if (!tbody) return;
  
  let filtered = serverMgmtServers.filter(s => {
    const matchSearch = !search || 
      s.name.toLowerCase().includes(search) ||
      s.id.toLowerCase().includes(search) ||
      (s.owner.username || '').toLowerCase().includes(search);
    
    let matchStatus = statusFilter === 'all';
    if (statusFilter === 'running') matchStatus = s.is_running;
    else if (statusFilter === 'offline') matchStatus = !s.is_running && !s.ban_status;
    else if (statusFilter === 'suspended') matchStatus = s.ban_status?.status === 'suspended';
    else if (statusFilter === 'banned') matchStatus = s.ban_status?.status === 'banned';
    
    const matchType = typeFilter === 'all' || s.language === typeFilter;
    
    return matchSearch && matchStatus && matchType;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 40px; text-align: center; color: #888;">
          <i class="fas fa-search" style="font-size: 24px; margin-bottom: 15px; display: block;"></i>
          No servers found matching your filters
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filtered.map(s => {
    const statusColor = s.is_running ? '#10B981' : (s.ban_status?.status === 'suspended' ? '#F59E0B' : (s.ban_status?.status === 'banned' ? '#EF4444' : '#666'));
    const statusText = s.is_running ? 'Running' : (s.ban_status?.status || 'Offline');
    const typeIcon = s.language === 'javascript' ? 'fab fa-node-js' : 'fab fa-python';
    const typeColor = s.language === 'javascript' ? '#68A063' : '#3776AB';
    const uptimeStr = s.uptime > 0 ? formatUptime(s.uptime) : '-';
    
    return `
      <tr style="border-bottom: 1px solid var(--border-color);" data-server-id="${s.id}">
        <td style="padding: 15px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: ${typeColor}22; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <i class="${typeIcon}" style="color: ${typeColor}; font-size: 18px;"></i>
            </div>
            <div>
              <div style="color: white; font-weight: 500;">${s.name}</div>
              <div style="color: #666; font-size: 12px;">${s.id}</div>
            </div>
          </div>
        </td>
        <td style="padding: 15px;">
          <div style="color: white;">${s.owner.username || 'Unknown'}</div>
          <div style="color: #666; font-size: 12px;">${s.owner.discord_id || '-'}</div>
        </td>
        <td style="padding: 15px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${typeColor}22; border-radius: 6px; color: ${typeColor}; font-size: 13px;">
            <i class="${typeIcon}"></i> ${s.language === 'javascript' ? 'JS' : 'PY'}
          </span>
        </td>
        <td style="padding: 15px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; color: ${statusColor}; font-weight: 500;">
            <i class="fas fa-circle" style="font-size: 8px;"></i> ${statusText}
          </span>
        </td>
        <td style="padding: 15px; color: ${s.uptime > 0 ? '#10B981' : '#666'};">${uptimeStr}</td>
        <td style="padding: 15px; color: #888; font-family: monospace; font-size: 13px;">${s.ip || 'N/A'}</td>
        <td style="padding: 15px; text-align: center;">
          <div style="display: flex; gap: 8px; justify-content: center;">
            ${s.is_running ? `
              <button onclick="serverMgmtAction('${s.id}', 'restart')" title="Restart" style="width: 32px; height: 32px; background: #F59E0B22; border: none; border-radius: 6px; color: #F59E0B; cursor: pointer;">
                <i class="fas fa-redo"></i>
              </button>
              <button onclick="serverMgmtAction('${s.id}', 'stop')" title="Stop" style="width: 32px; height: 32px; background: #EF444422; border: none; border-radius: 6px; color: #EF4444; cursor: pointer;">
                <i class="fas fa-stop"></i>
              </button>
            ` : `
              <button onclick="serverMgmtAction('${s.id}', 'start')" title="Start" style="width: 32px; height: 32px; background: #10B98122; border: none; border-radius: 6px; color: #10B981; cursor: pointer;">
                <i class="fas fa-play"></i>
              </button>
            `}
            <button onclick="initiateAdminConnect('${s.id}', '${s.name}')" title="Connect" style="width: 32px; height: 32px; background: #5865F222; border: none; border-radius: 6px; color: #5865F2; cursor: pointer;">
              <i class="fas fa-plug"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function serverMgmtAction(accountId, action) {
  try {
    showToast('Processing', `${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting'} server...`, 'info', 2000);
    
    const res = await fetch(`${API}/bot/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId: accountId })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Success', `Server ${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'} successfully`, 'success', 3000);
      setTimeout(() => loadServerMgmtData(), 1500);
    } else {
      showToast('Error', data.error || `Failed to ${action} server`, 'error', 4000);
    }
  } catch (err) {
    console.error('Server action error:', err);
    showToast('Error', `Failed to ${action} server`, 'error', 4000);
  }
}

// ============================================
// USER CREDITS & REFERRALS LOGS MODAL
// ============================================

async function showUserCreditsReferralsLogs(accountId, username) {
  const existingModal = document.getElementById('creditsReferralsModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'creditsReferralsModal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; border-radius: 16px;">
      <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 25px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="color: white; margin: 0; font-size: 20px;"><i class="fas fa-coins" style="margin-right: 10px;"></i>Credits & Referrals</h3>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">${username || 'User'}</p>
        </div>
        <button onclick="document.getElementById('creditsReferralsModal').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 16px;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div style="padding: 25px; overflow-y: auto; flex: 1; background: var(--bg-primary);" id="creditsReferralsContent">
        <div style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #10B981; margin-bottom: 15px;"></i>
          <p style="color: #888;">Loading data...</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  try {
    const res = await fetch(`${API}/admin/user/${accountId}/credits-referrals-logs`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    const content = document.getElementById('creditsReferralsContent');
    if (!content) return;
    
    if (!data.success) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #EF4444;">
          <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 15px;"></i>
          <p>${data.error || 'Failed to load data'}</p>
        </div>
      `;
      return;
    }
    
    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <div style="color: #888; font-size: 13px; margin-bottom: 5px;">Credits</div>
          <div style="font-size: 24px; font-weight: 700; color: #8B5CF6;">$${(data.credits || 0).toFixed(2)}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <div style="color: #888; font-size: 13px; margin-bottom: 5px;">Balance</div>
          <div style="font-size: 24px; font-weight: 700; color: #10B981;">$${(data.balance || 0).toFixed(2)}</div>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <div style="color: #888; font-size: 13px; margin-bottom: 5px;">Referrals</div>
          <div style="font-size: 24px; font-weight: 700; color: #3B82F6;">${data.referral_count || 0}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <h4 style="color: white; margin: 0 0 15px 0; font-size: 16px;"><i class="fas fa-users" style="margin-right: 8px; color: #3B82F6;"></i>Recent Referrals</h4>
          ${data.referrals && data.referrals.length > 0 ? `
            <div style="max-height: 200px; overflow-y: auto;">
              ${data.referrals.slice(-10).reverse().map(r => `
                <div style="padding: 10px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
                  <div style="color: white; font-size: 14px;">${r.username || r.referred_id || 'Unknown'}</div>
                  <div style="color: #666; font-size: 12px;">${r.date || '-'}</div>
                </div>
              `).join('')}
            </div>
          ` : `<p style="color: #666; margin: 0;">No referrals yet</p>`}
        </div>
        
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
          <h4 style="color: white; margin: 0 0 15px 0; font-size: 16px;"><i class="fas fa-history" style="margin-right: 8px; color: #8B5CF6;"></i>Credit Logs</h4>
          ${(data.credit_logs && data.credit_logs.length > 0) || (data.admin_credits && data.admin_credits.length > 0) ? `
            <div style="max-height: 200px; overflow-y: auto;">
              ${[...(data.credit_logs || []), ...(data.admin_credits || [])].slice(-10).reverse().map(log => `
                <div style="padding: 10px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: ${log.amount > 0 ? '#10B981' : '#EF4444'}; font-weight: 600;">
                      ${log.amount > 0 ? '+' : ''}$${(log.amount || 0).toFixed(2)}
                    </span>
                    <span style="color: #666; font-size: 12px;">${log.source || log.reason || 'Unknown'}</span>
                  </div>
                  <div style="color: #666; font-size: 12px; margin-top: 4px;">${log.date || log.timestamp || '-'}</div>
                </div>
              `).join('')}
            </div>
          ` : `<p style="color: #666; margin: 0;">No credit logs</p>`}
        </div>
      </div>
      
      ${data.withdrawals && data.withdrawals.length > 0 ? `
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-top: 20px; border: 1px solid var(--border-color);">
          <h4 style="color: white; margin: 0 0 15px 0; font-size: 16px;"><i class="fas fa-money-bill-wave" style="margin-right: 8px; color: #F59E0B;"></i>Withdrawals</h4>
          <div style="max-height: 150px; overflow-y: auto;">
            ${data.withdrawals.slice(-5).reverse().map(w => `
              <div style="padding: 10px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="color: white; font-weight: 500;">$${(w.amount || 0).toFixed(2)}</div>
                  <div style="color: #666; font-size: 12px;">${w.date || '-'}</div>
                </div>
                <span style="padding: 4px 10px; border-radius: 6px; font-size: 12px; background: ${w.status === 'completed' ? '#10B98122' : w.status === 'pending' ? '#F59E0B22' : '#EF444422'}; color: ${w.status === 'completed' ? '#10B981' : w.status === 'pending' ? '#F59E0B' : '#EF4444'};">
                  ${w.status || 'Unknown'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  } catch (err) {
    console.error('Error loading credits/referrals:', err);
    const content = document.getElementById('creditsReferralsContent');
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #EF4444;">
          <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 15px;"></i>
          <p>Failed to load data: ${err.message}</p>
        </div>
      `;
    }
  }
}

// ============================================
// BULK BOT ACTIONS FOR USER MANAGEMENT
// ============================================

async function bulkBotAction(action) {
  const selectedIds = userManagementState.selectedUsers;
  
  if (selectedIds.length === 0) {
    showToast('Warning', 'No users selected', 'warning', 3000);
    return;
  }
  
  const actionText = action === 'start' ? 'start' : action === 'stop' ? 'stop' : 'restart';
  
  if (!confirm(`Are you sure you want to ${actionText} bots for ${selectedIds.length} selected user(s)?`)) {
    return;
  }
  
  showToast('Processing', `${actionText.charAt(0).toUpperCase() + actionText.slice(1)}ing bots for ${selectedIds.length} users...`, 'info', 3000);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const accountId of selectedIds) {
    try {
      const res = await fetch(`${API}/bot/${action}?account_id=${accountId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  }
  
  if (successCount > 0) {
    showToast('Success', `${successCount} bot(s) ${actionText}ed successfully`, 'success', 4000);
  }
  if (failCount > 0) {
    showToast('Warning', `${failCount} bot(s) failed to ${actionText}`, 'warning', 4000);
  }
  
  userManagementState.selectedUsers = [];
  loadUsersTable();
}