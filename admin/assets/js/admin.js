// 管理后台JavaScript

class AdminApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.bindEvents();
        this.initPage();
    }

    bindEvents() {
        // 导航点击事件
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });

        // 移动端菜单切换
        this.initMobileMenu();
    }

    initMobileMenu() {
        // 在移动端添加菜单切换按钮
        if (window.innerWidth <= 768) {
            const header = document.createElement('div');
            header.className = 'mobile-header';
            header.innerHTML = `
                <button class="menu-toggle">☰</button>
                <h1>管理后台</h1>
            `;
            document.body.insertBefore(header, document.body.firstChild);

            const menuToggle = header.querySelector('.menu-toggle');
            const sidebar = document.querySelector('.sidebar');

            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // 点击主内容区关闭菜单
            document.querySelector('.main-content').addEventListener('click', () => {
                sidebar.classList.remove('open');
            });
        }
    }

    switchPage(page) {
        if (this.currentPage === page) return;

        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // 隐藏当前页面
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`page-${page}`);
        targetPage.classList.add('active');

        // 加载页面内容
        this.loadPageContent(page);

        this.currentPage = page;

        // 更新URL
        history.pushState({ page }, '', `#${page}`);
    }

    async loadPageContent(page) {
        const pageElement = document.getElementById(`page-${page}`);
        
        // 如果页面已经加载过内容，直接返回
        if (pageElement.dataset.loaded === 'true') {
            return;
        }

        try {
            const response = await fetch(`pages/${page}.php`);
            if (response.ok) {
                const html = await response.text();
                pageElement.innerHTML = html;
                pageElement.dataset.loaded = 'true';

                // 初始化页面特定的功能
                this.initPageFeatures(page);
            } else {
                throw new Error('页面加载失败');
            }
        } catch (error) {
            console.error('Load page error:', error);
            pageElement.innerHTML = `
                <div class="error-state">
                    <div class="icon">⚠️</div>
                    <h3>页面加载失败</h3>
                    <p>请刷新页面重试</p>
                    <button class="btn btn-primary" onclick="location.reload()">刷新页面</button>
                </div>
            `;
        }
    }

    initPageFeatures(page) {
        switch (page) {
            case 'sources':
                this.initSourcesPage();
                break;
            case 'users':
                this.initUsersPage();
                break;
            case 'blacklist':
                this.initBlacklistPage();
                break;
            case 'logs':
                this.initLogsPage();
                break;
            case 'favorites':
                this.initFavoritesPage();
                break;
            case 'config':
                this.initConfigPage();
                break;
            case 'monitor':
                this.initMonitorPage();
                break;
        }
    }

    initSourcesPage() {
        // 内容源管理页面初始化
        this.bindSourcesEvents();
    }

    bindSourcesEvents() {
        // 添加源按钮
        const addBtn = document.getElementById('addSourceBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddSourceModal();
            });
        }

        // 编辑源按钮
        document.querySelectorAll('.edit-source-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sourceId = e.target.dataset.sourceId;
                this.showEditSourceModal(sourceId);
            });
        });

        // 删除源按钮
        document.querySelectorAll('.delete-source-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sourceId = e.target.dataset.sourceId;
                this.deleteSource(sourceId);
            });
        });
    }

    showAddSourceModal() {
        const modal = this.createModal('添加内容源', `
            <form id="addSourceForm" class="source-form">
                <div class="form-group">
                    <label class="form-label">源名称</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">内容类型</label>
                    <select name="type" class="form-input" required>
                        <option value="">请选择</option>
                        <option value="video">视频</option>
                        <option value="novel">小说</option>
                        <option value="image">图片</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">API地址</label>
                    <input type="url" name="api_url" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">解析地址</label>
                    <input type="url" name="parse_url" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">优先级</label>
                    <input type="number" name="priority" class="form-input" value="0">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                    <button type="submit" class="btn btn-primary">添加</button>
                </div>
            </form>
        `);

        document.body.appendChild(modal);

        // 绑定表单提交事件
        const form = modal.querySelector('#addSourceForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitSourceForm(form, 'add');
        });
    }

    async submitSourceForm(form, action) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch(`api/sources/${action}.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('操作成功', 'success');
                form.closest('.modal').remove();
                this.reloadCurrentPage();
            } else {
                throw new Error(result.message || '操作失败');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    initUsersPage() {
        // 用户管理页面初始化
        this.bindUsersEvents();
    }

    bindUsersEvents() {
        // 用户状态切换
        document.querySelectorAll('.user-status-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const status = e.target.checked ? 'active' : 'banned';
                await this.updateUserStatus(userId, status);
            });
        });

        // 用户角色变更
        document.querySelectorAll('.user-role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const role = e.target.value;
                await this.updateUserRole(userId, role);
            });
        });
    }

    async updateUserStatus(userId, status) {
        try {
            const response = await fetch('api/users/update_status.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId, status })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户状态更新成功', 'success');
            } else {
                throw new Error(result.message || '更新失败');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    initBlacklistPage() {
        // IP黑名单页面初始化
        this.bindBlacklistEvents();
    }

    bindBlacklistEvents() {
        // 添加黑名单按钮
        const addBtn = document.getElementById('addBlacklistBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddBlacklistModal();
            });
        }

        // 删除黑名单按钮
        document.querySelectorAll('.delete-blacklist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteBlacklist(id);
            });
        });
    }

    showAddBlacklistModal() {
        const modal = this.createModal('添加黑名单', `
            <form id="addBlacklistForm" class="blacklist-form">
                <div class="form-group">
                    <label class="form-label">类型</label>
                    <select name="type" class="form-input" required onchange="toggleBlacklistFields(this.value)">
                        <option value="">请选择</option>
                        <option value="ip">IP地址</option>
                        <option value="range">IP段</option>
                        <option value="country">国家/地区</option>
                    </select>
                </div>
                <div class="form-group" id="ipField" style="display: none;">
                    <label class="form-label">IP地址</label>
                    <input type="text" name="ip_address" class="form-input" placeholder="例如: 192.168.1.1">
                </div>
                <div class="form-group" id="rangeField" style="display: none;">
                    <label class="form-label">IP段</label>
                    <input type="text" name="ip_range" class="form-input" placeholder="例如: 192.168.1.0/24 或 192.168.1.1-192.168.1.100">
                </div>
                <div class="form-group" id="countryField" style="display: none;">
                    <label class="form-label">国家/地区</label>
                    <input type="text" name="country" class="form-input" placeholder="例如: China">
                </div>
                <div class="form-group">
                    <label class="form-label">封禁原因</label>
                    <textarea name="reason" class="form-input" rows="3" placeholder="请输入封禁原因"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                    <button type="submit" class="btn btn-primary">添加</button>
                </div>
            </form>
        `);

        document.body.appendChild(modal);

        // 添加字段切换函数
        window.toggleBlacklistFields = (type) => {
            document.getElementById('ipField').style.display = type === 'ip' ? 'block' : 'none';
            document.getElementById('rangeField').style.display = type === 'range' ? 'block' : 'none';
            document.getElementById('countryField').style.display = type === 'country' ? 'block' : 'none';
        };

        // 绑定表单提交事件
        const form = modal.querySelector('#addBlacklistForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitBlacklistForm(form);
        });
    }

    async submitBlacklistForm(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('api/blacklist/add.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('黑名单添加成功', 'success');
                form.closest('.modal').remove();
                this.reloadCurrentPage();
            } else {
                throw new Error(result.message || '添加失败');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    initLogsPage() {
        // 日志管理页面初始化
        this.bindLogsEvents();
    }

    bindLogsEvents() {
        // 日志类型切换
        document.querySelectorAll('.log-type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const logType = e.target.dataset.logType;
                this.switchLogType(logType);
            });
        });

        // 日志搜索
        const searchInput = document.getElementById('logSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchLogs(e.target.value);
            }, 500));
        }

        // 清理日志按钮
        const clearBtn = document.getElementById('clearLogsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }
    }

    switchLogType(logType) {
        // 更新标签状态
        document.querySelectorAll('.log-type-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-log-type="${logType}"]`).classList.add('active');

        // 加载对应类型的日志
        this.loadLogs(logType);
    }

    async loadLogs(type, search = '', page = 1) {
        try {
            const response = await fetch(`api/logs/list.php?type=${type}&search=${encodeURIComponent(search)}&page=${page}`);
            const result = await response.json();

            if (result.success) {
                this.renderLogs(result.logs, result.pagination);
            } else {
                throw new Error(result.message || '加载日志失败');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    renderLogs(logs, pagination) {
        const container = document.getElementById('logsContainer');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📝</div>
                    <h3>暂无日志</h3>
                    <p>没有找到相关的日志记录</p>
                </div>
            `;
            return;
        }

        const html = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>用户</th>
                            <th>操作</th>
                            <th>IP地址</th>
                            <th>详情</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td>${this.formatDateTime(log.created_at)}</td>
                                <td>${log.username || '游客'}</td>
                                <td>${log.action}</td>
                                <td>${log.ip_address}</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="adminApp.showLogDetails('${log.id}')">
                                        查看
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.renderPagination(pagination)}
        `;

        container.innerHTML = html;
    }

    initConfigPage() {
        // 系统配置页面初始化
        this.bindConfigEvents();
    }

    bindConfigEvents() {
        // 配置保存按钮
        const saveBtn = document.getElementById('saveConfigBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveConfig();
            });
        }

        // 配置重置按钮
        const resetBtn = document.getElementById('resetConfigBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetConfig();
            });
        }
    }

    async saveConfig() {
        const form = document.getElementById('configForm');
        if (!form) return;

        const formData = new FormData(form);
        const config = Object.fromEntries(formData);

        try {
            const response = await fetch('api/config/save.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('配置保存成功', 'success');
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    initMonitorPage() {
        // 系统监控页面初始化
        this.startMonitoring();
    }

    startMonitoring() {
        // 定期更新监控数据
        this.monitorInterval = setInterval(() => {
            this.updateMonitorData();
        }, 30000); // 30秒更新一次

        // 立即更新一次
        this.updateMonitorData();
    }

    async updateMonitorData() {
        try {
            const response = await fetch('api/monitor/status.php');
            const result = await response.json();

            if (result.success) {
                this.renderMonitorData(result.data);
            }
        } catch (error) {
            console.error('Update monitor data error:', error);
        }
    }

    renderMonitorData(data) {
        // 更新CPU使用率
        const cpuElement = document.getElementById('cpuUsage');
        if (cpuElement) {
            cpuElement.textContent = data.cpu_usage + '%';
        }

        // 更新内存使用率
        const memoryElement = document.getElementById('memoryUsage');
        if (memoryElement) {
            memoryElement.textContent = data.memory_usage + '%';
        }

        // 更新磁盘使用率
        const diskElement = document.getElementById('diskUsage');
        if (diskElement) {
            diskElement.textContent = data.disk_usage + '%';
        }

        // 更新在线用户数
        const onlineElement = document.getElementById('onlineUsers');
        if (onlineElement) {
            onlineElement.textContent = data.online_users;
        }
    }

    // 工具方法
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        return modal;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN');
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    renderPagination(pagination) {
        if (!pagination || pagination.total_pages <= 1) {
            return '';
        }

        let html = '<div class="pagination">';
        
        // 上一页
        if (pagination.current_page > 1) {
            html += `<button class="pagination-btn" onclick="adminApp.loadPage(${pagination.current_page - 1})">上一页</button>`;
        }

        // 页码
        for (let i = 1; i <= pagination.total_pages; i++) {
            if (i === pagination.current_page) {
                html += `<button class="pagination-btn active">${i}</button>`;
            } else {
                html += `<button class="pagination-btn" onclick="adminApp.loadPage(${i})">${i}</button>`;
            }
        }

        // 下一页
        if (pagination.current_page < pagination.total_pages) {
            html += `<button class="pagination-btn" onclick="adminApp.loadPage(${pagination.current_page + 1})">下一页</button>`;
        }

        html += '</div>';
        return html;
    }

    reloadCurrentPage() {
        // 重新加载当前页面内容
        const currentPageElement = document.getElementById(`page-${this.currentPage}`);
        currentPageElement.dataset.loaded = 'false';
        this.loadPageContent(this.currentPage);
    }

    initPage() {
        // 根据URL hash初始化页面
        const hash = window.location.hash.substring(1);
        if (hash && document.querySelector(`[data-page="${hash}"]`)) {
            this.switchPage(hash);
        }

        // 监听浏览器前进后退
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.switchPage(e.state.page);
            }
        });
    }

    // 页面卸载时清理
    destroy() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
    }
}

// 初始化管理后台应用
const adminApp = new AdminApp();

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    adminApp.destroy();
});