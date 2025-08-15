// 用户认证管理

class AuthManager {
    constructor() {
        this.user = null;
        this.token = null;
        this.refreshTimer = null;
        this.init();
    }

    // 初始化
    init() {
        this.loadFromStorage();
        this.setupTokenRefresh();
        this.bindEvents();
    }

    // 从本地存储加载用户信息
    loadFromStorage() {
        const token = Utils.Storage.get('auth_token');
        const user = Utils.Storage.get('user_info');
        
        if (token && user) {
            this.setAuth(user, token);
        }
    }

    // 设置认证信息
    setAuth(user, token) {
        this.user = user;
        this.token = token;
        
        // 设置API认证头
        api.setAuthToken(token);
        
        // 保存到本地存储
        Utils.Storage.set('auth_token', token);
        Utils.Storage.set('user_info', user);
        
        // 更新UI
        this.updateUI();
        
        // 设置token刷新
        this.setupTokenRefresh();
        
        // 触发登录事件
        this.emit('login', user);
    }

    // 清除认证信息
    clearAuth() {
        this.user = null;
        this.token = null;
        
        // 清除API认证头
        api.setAuthToken(null);
        
        // 清除本地存储
        Utils.Storage.remove('auth_token');
        Utils.Storage.remove('user_info');
        
        // 清除刷新定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        // 更新UI
        this.updateUI();
        
        // 触发登出事件
        this.emit('logout');
    }

    // 登录
    async login(credentials) {
        try {
            const response = await API.auth.login(credentials);
            
            if (response.success) {
                this.setAuth(response.user, response.token);
                Utils.Notification.success('登录成功');
                return response;
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            Utils.Notification.error(error.message || '登录失败');
            throw error;
        }
    }

    // 注册
    async register(userData) {
        try {
            const response = await API.auth.register(userData);
            
            if (response.success) {
                Utils.Notification.success('注册成功，请登录');
                return response;
            } else {
                throw new Error(response.message || '注册失败');
            }
        } catch (error) {
            Utils.Notification.error(error.message || '注册失败');
            throw error;
        }
    }

    // 登出
    async logout() {
        try {
            if (this.token) {
                await API.auth.logout();
            }
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            this.clearAuth();
            Utils.Notification.success('已退出登录');
        }
    }

    // 获取用户资料
    async getProfile() {
        try {
            const response = await API.auth.profile();
            if (response.success) {
                this.user = response.user;
                Utils.Storage.set('user_info', this.user);
                this.updateUI();
                return response.user;
            }
        } catch (error) {
            console.error('Get profile error:', error);
            // 如果获取失败，可能token已过期
            if (error.message.includes('401')) {
                this.clearAuth();
            }
        }
    }

    // 更新用户资料
    async updateProfile(data) {
        try {
            const response = await API.auth.updateProfile(data);
            
            if (response.success) {
                this.user = { ...this.user, ...response.user };
                Utils.Storage.set('user_info', this.user);
                this.updateUI();
                Utils.Notification.success('资料更新成功');
                return response.user;
            } else {
                throw new Error(response.message || '更新失败');
            }
        } catch (error) {
            Utils.Notification.error(error.message || '更新失败');
            throw error;
        }
    }

    // 检查是否已登录
    isLoggedIn() {
        return !!(this.user && this.token);
    }

    // 检查用户权限
    hasPermission(permission) {
        if (!this.user) return false;
        
        // 管理员拥有所有权限
        if (this.user.role === 'admin') return true;
        
        // 检查具体权限
        return this.user.permissions && this.user.permissions.includes(permission);
    }

    // 设置token自动刷新
    setupTokenRefresh() {
        if (!this.token) return;
        
        // 清除之前的定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        // 解析token获取过期时间
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const exp = payload.exp * 1000; // 转换为毫秒
            const now = Date.now();
            const refreshTime = exp - now - 5 * 60 * 1000; // 提前5分钟刷新
            
            if (refreshTime > 0) {
                this.refreshTimer = setTimeout(() => {
                    this.refreshToken();
                }, refreshTime);
            }
        } catch (error) {
            console.error('Token parse error:', error);
        }
    }

    // 刷新token
    async refreshToken() {
        try {
            const response = await api.post('/api/auth/refresh.php');
            
            if (response.success) {
                this.setAuth(this.user, response.token);
            } else {
                // 刷新失败，清除认证信息
                this.clearAuth();
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            this.clearAuth();
        }
    }

    // 更新UI
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userMenuBtn = document.getElementById('userMenuBtn');
        
        if (this.isLoggedIn()) {
            loginBtn.classList.add('hidden');
            userMenuBtn.classList.remove('hidden');
            
            // 更新用户信息显示
            const avatar = userMenuBtn.querySelector('.avatar');
            const username = userMenuBtn.querySelector('.username');
            
            if (avatar) {
                avatar.src = this.user.avatar || '/assets/images/default-avatar.png';
            }
            if (username) {
                username.textContent = this.user.username;
            }
        } else {
            loginBtn.classList.remove('hidden');
            userMenuBtn.classList.add('hidden');
        }
    }

    // 绑定事件
    bindEvents() {
        // 登录按钮点击
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.showLoginModal();
            });
        }

        // 用户菜单按钮点击
        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                this.showUserMenu();
            });
        }
    }

    // 显示登录模态框
    showLoginModal() {
        const loginForm = `
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label class="form-label">用户名或邮箱</label>
                    <input type="text" name="username" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">密码</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="remember"> 记住我
                    </label>
                </div>
                <button type="submit" class="btn btn-primary btn-large">登录</button>
                <div class="auth-links">
                    <a href="#" id="showRegister">没有账号？立即注册</a>
                </div>
            </form>
        `;

        Utils.Modal.show('用户登录', loginForm);

        // 绑定表单提交事件
        const form = document.getElementById('loginForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const credentials = {
                username: formData.get('username'),
                password: formData.get('password'),
                remember: formData.get('remember') === 'on'
            };

            try {
                await this.login(credentials);
                Utils.Modal.hide();
            } catch (error) {
                // 错误已在login方法中处理
            }
        });

        // 绑定注册链接
        const showRegister = document.getElementById('showRegister');
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterModal();
        });
    }

    // 显示注册模态框
    showRegisterModal() {
        const registerForm = `
            <form id="registerForm" class="auth-form">
                <div class="form-group">
                    <label class="form-label">用户名</label>
                    <input type="text" name="username" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">邮箱</label>
                    <input type="email" name="email" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">密码</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">确认密码</label>
                    <input type="password" name="password_confirm" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary btn-large">注册</button>
                <div class="auth-links">
                    <a href="#" id="showLogin">已有账号？立即登录</a>
                </div>
            </form>
        `;

        Utils.Modal.show('用户注册', registerForm);

        // 绑定表单提交事件
        const form = document.getElementById('registerForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const userData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                password_confirm: formData.get('password_confirm')
            };

            // 验证密码
            if (userData.password !== userData.password_confirm) {
                Utils.Notification.error('两次输入的密码不一致');
                return;
            }

            try {
                await this.register(userData);
                Utils.Modal.hide();
                // 注册成功后显示登录框
                setTimeout(() => this.showLoginModal(), 500);
            } catch (error) {
                // 错误已在register方法中处理
            }
        });

        // 绑定登录链接
        const showLogin = document.getElementById('showLogin');
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });
    }

    // 显示用户菜单
    showUserMenu() {
        const userMenu = `
            <div class="user-menu">
                <div class="user-info">
                    <img src="${this.user.avatar || '/assets/images/default-avatar.png'}" alt="头像" class="user-avatar">
                    <div class="user-details">
                        <div class="user-name">${this.user.username}</div>
                        <div class="user-email">${this.user.email}</div>
                    </div>
                </div>
                <div class="menu-items">
                    <a href="#" id="showProfile" class="menu-item">
                        <span class="icon">👤</span>
                        个人资料
                    </a>
                    <a href="#" id="showFavorites" class="menu-item">
                        <span class="icon">❤️</span>
                        我的收藏
                    </a>
                    <a href="#" id="showHistory" class="menu-item">
                        <span class="icon">🕘</span>
                        观看历史
                    </a>
                    <a href="#" id="showSettings" class="menu-item">
                        <span class="icon">⚙️</span>
                        设置
                    </a>
                    <hr class="menu-divider">
                    <a href="#" id="logoutBtn" class="menu-item">
                        <span class="icon">🚪</span>
                        退出登录
                    </a>
                </div>
            </div>
        `;

        Utils.Modal.show('用户中心', userMenu);

        // 绑定菜单项事件
        document.getElementById('showProfile')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showProfileModal();
        });

        document.getElementById('showFavorites')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showFavoritesModal();
        });

        document.getElementById('showHistory')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showHistoryModal();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
            Utils.Modal.hide();
        });
    }

    // 显示个人资料模态框
    showProfileModal() {
        // 实现个人资料编辑功能
        Utils.Modal.show('个人资料', '<p>个人资料编辑功能开发中...</p>');
    }

    // 显示收藏模态框
    showFavoritesModal() {
        // 实现收藏列表功能
        Utils.Modal.show('我的收藏', '<p>收藏列表功能开发中...</p>');
    }

    // 显示历史记录模态框
    showHistoryModal() {
        // 实现历史记录功能
        Utils.Modal.show('观看历史', '<p>历史记录功能开发中...</p>');
    }

    // 事件系统
    events = {};

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
}

// 创建认证管理器实例
const authManager = new AuthManager();

// 导出认证管理器
window.AuthManager = AuthManager;
window.authManager = authManager;