// 收藏功能管理

class FavoritesManager {
    constructor() {
        this.favorites = new Map();
        this.init();
    }

    // 初始化
    init() {
        this.loadFavorites();
        this.bindEvents();
    }

    // 加载收藏列表
    async loadFavorites() {
        if (!authManager.isLoggedIn()) return;

        try {
            const response = await API.favorites.list();
            if (response.success) {
                this.favorites.clear();
                response.favorites.forEach(item => {
                    const key = `${item.source_id}_${item.content_id}`;
                    this.favorites.set(key, item);
                });
                this.updateUI();
            }
        } catch (error) {
            console.error('Load favorites error:', error);
        }
    }

    // 添加收藏
    async add(data) {
        if (!authManager.isLoggedIn()) {
            Utils.Notification.warning('请先登录');
            authManager.showLoginModal();
            return false;
        }

        try {
            const response = await API.favorites.add(data);
            if (response.success) {
                const key = `${data.source_id}_${data.content_id}`;
                this.favorites.set(key, {
                    ...data,
                    id: response.favorite_id,
                    created_at: new Date().toISOString()
                });
                
                this.updateUI();
                Utils.Notification.success('已添加到收藏');
                return true;
            } else {
                throw new Error(response.message || '收藏失败');
            }
        } catch (error) {
            Utils.Notification.error(error.message || '收藏失败');
            return false;
        }
    }

    // 移除收藏
    async remove(sourceId, contentId) {
        const key = `${sourceId}_${contentId}`;
        const favorite = this.favorites.get(key);
        
        if (!favorite) return false;

        try {
            const response = await API.favorites.remove(favorite.id);
            if (response.success) {
                this.favorites.delete(key);
                this.updateUI();
                Utils.Notification.success('已取消收藏');
                return true;
            } else {
                throw new Error(response.message || '取消收藏失败');
            }
        } catch (error) {
            Utils.Notification.error(error.message || '取消收藏失败');
            return false;
        }
    }

    // 切换收藏状态
    async toggle(data) {
        const key = `${data.source_id}_${data.content_id}`;
        
        if (this.isFavorited(data.source_id, data.content_id)) {
            return await this.remove(data.source_id, data.content_id);
        } else {
            return await this.add(data);
        }
    }

    // 检查是否已收藏
    isFavorited(sourceId, contentId) {
        const key = `${sourceId}_${contentId}`;
        return this.favorites.has(key);
    }

    // 获取收藏列表
    getFavorites(type = '') {
        const favorites = Array.from(this.favorites.values());
        
        if (type) {
            return favorites.filter(item => item.content_type === type);
        }
        
        return favorites;
    }

    // 搜索收藏
    searchFavorites(keyword) {
        const favorites = Array.from(this.favorites.values());
        
        if (!keyword) return favorites;
        
        const lowerKeyword = keyword.toLowerCase();
        return favorites.filter(item => 
            item.content_title.toLowerCase().includes(lowerKeyword)
        );
    }

    // 按类型分组收藏
    getFavoritesByType() {
        const favorites = Array.from(this.favorites.values());
        const grouped = {
            video: [],
            novel: [],
            image: []
        };

        favorites.forEach(item => {
            if (grouped[item.content_type]) {
                grouped[item.content_type].push(item);
            }
        });

        return grouped;
    }

    // 获取收藏统计
    getStats() {
        const favorites = Array.from(this.favorites.values());
        const stats = {
            total: favorites.length,
            video: 0,
            novel: 0,
            image: 0
        };

        favorites.forEach(item => {
            if (stats[item.content_type] !== undefined) {
                stats[item.content_type]++;
            }
        });

        return stats;
    }

    // 绑定事件
    bindEvents() {
        // 收藏按钮点击事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) {
                this.handleFavoriteClick(e);
            }
        });

        // 收藏列表按钮点击事件
        const favoritesBtn = document.getElementById('favoritesBtn');
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', () => {
                this.showFavoritesModal();
            });
        }

        // 监听登录状态变化
        authManager.on('login', () => {
            this.loadFavorites();
        });

        authManager.on('logout', () => {
            this.favorites.clear();
            this.updateUI();
        });
    }

    // 处理收藏按钮点击
    async handleFavoriteClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.target.closest('.favorite-btn');
        const data = this.extractFavoriteData(btn);

        if (!data) return;

        // 添加加载状态
        btn.classList.add('loading');
        
        try {
            await this.toggle(data);
        } finally {
            btn.classList.remove('loading');
        }
    }

    // 提取收藏数据
    extractFavoriteData(btn) {
        // 从按钮的data属性或父元素中提取收藏数据
        const container = btn.closest('[data-source-id][data-content-id]');
        if (!container) return null;

        return {
            source_id: parseInt(container.dataset.sourceId),
            content_id: container.dataset.contentId,
            content_title: container.dataset.contentTitle || '',
            content_cover: container.dataset.contentCover || '',
            content_type: container.dataset.contentType || 'video'
        };
    }

    // 更新UI
    updateUI() {
        // 更新所有收藏按钮状态
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const data = this.extractFavoriteData(btn);
            if (data) {
                const isFavorited = this.isFavorited(data.source_id, data.content_id);
                btn.classList.toggle('active', isFavorited);
                
                const icon = btn.querySelector('.icon');
                if (icon) {
                    icon.textContent = isFavorited ? '❤️' : '🤍';
                }
            }
        });

        // 更新收藏统计
        this.updateStatsUI();
    }

    // 更新统计UI
    updateStatsUI() {
        const stats = this.getStats();
        
        // 更新黏性按钮上的数字
        const favoritesBtn = document.getElementById('favoritesBtn');
        if (favoritesBtn && stats.total > 0) {
            let badge = favoritesBtn.querySelector('.badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                favoritesBtn.appendChild(badge);
            }
            badge.textContent = stats.total;
        }
    }

    // 显示收藏列表模态框
    async showFavoritesModal() {
        if (!authManager.isLoggedIn()) {
            Utils.Notification.warning('请先登录');
            authManager.showLoginModal();
            return;
        }

        const loader = Utils.Loading.show();
        
        try {
            await this.loadFavorites();
            
            const favorites = this.getFavorites();
            const grouped = this.getFavoritesByType();
            
            const content = `
                <div class="favorites-modal">
                    <div class="favorites-tabs">
                        <button class="tab-btn active" data-type="">全部 (${favorites.length})</button>
                        <button class="tab-btn" data-type="video">视频 (${grouped.video.length})</button>
                        <button class="tab-btn" data-type="novel">小说 (${grouped.novel.length})</button>
                        <button class="tab-btn" data-type="image">图片 (${grouped.image.length})</button>
                    </div>
                    <div class="favorites-search">
                        <input type="text" id="favoritesSearch" placeholder="搜索收藏..." class="form-input">
                    </div>
                    <div class="favorites-list" id="favoritesList">
                        ${this.renderFavoritesList(favorites)}
                    </div>
                </div>
            `;

            Utils.Modal.show('我的收藏', content);
            
            // 绑定标签切换事件
            document.querySelectorAll('.favorites-tabs .tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.favorites-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    const type = btn.dataset.type;
                    const filteredFavorites = type ? this.getFavorites(type) : favorites;
                    document.getElementById('favoritesList').innerHTML = this.renderFavoritesList(filteredFavorites);
                });
            });

            // 绑定搜索事件
            const searchInput = document.getElementById('favoritesSearch');
            searchInput.addEventListener('input', Utils.debounce((e) => {
                const keyword = e.target.value;
                const searchResults = this.searchFavorites(keyword);
                document.getElementById('favoritesList').innerHTML = this.renderFavoritesList(searchResults);
            }, 300));

        } catch (error) {
            Utils.Notification.error('加载收藏列表失败');
        } finally {
            Utils.Loading.hide(loader);
        }
    }

    // 渲染收藏列表
    renderFavoritesList(favorites) {
        if (favorites.length === 0) {
            return `
                <div class="empty-state">
                    <div class="icon">❤️</div>
                    <h3>暂无收藏</h3>
                    <p>快去收藏你喜欢的内容吧！</p>
                </div>
            `;
        }

        return favorites.map(item => `
            <div class="favorite-item" 
                 data-source-id="${item.source_id}" 
                 data-content-id="${item.content_id}"
                 data-content-title="${item.content_title}"
                 data-content-cover="${item.content_cover}"
                 data-content-type="${item.content_type}">
                <div class="favorite-cover">
                    <img src="${item.content_cover || '/assets/images/default-cover.png'}" 
                         alt="${item.content_title}" 
                         onerror="this.src='/assets/images/default-cover.png'">
                </div>
                <div class="favorite-info">
                    <h4 class="favorite-title">${item.content_title}</h4>
                    <div class="favorite-meta">
                        <span class="favorite-type">${this.getTypeLabel(item.content_type)}</span>
                        <span class="favorite-time">${Utils.formatTime(item.created_at)}</span>
                    </div>
                </div>
                <div class="favorite-actions">
                    <button class="btn btn-primary btn-sm" onclick="favoritesManager.playFavorite(${item.source_id}, '${item.content_id}')">
                        播放
                    </button>
                    <button class="btn btn-sm favorite-btn active" 
                            data-source-id="${item.source_id}" 
                            data-content-id="${item.content_id}">
                        <span class="icon">❤️</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 获取类型标签
    getTypeLabel(type) {
        const labels = {
            video: '视频',
            novel: '小说',
            image: '图片'
        };
        return labels[type] || type;
    }

    // 播放收藏的内容
    async playFavorite(sourceId, contentId) {
        try {
            // 关闭模态框
            Utils.Modal.hide();
            
            // 切换到对应的内容类型
            const favorite = this.favorites.get(`${sourceId}_${contentId}`);
            if (favorite) {
                // 触发播放事件
                this.emit('playFavorite', {
                    sourceId,
                    contentId,
                    contentType: favorite.content_type
                });
            }
        } catch (error) {
            Utils.Notification.error('播放失败');
        }
    }

    // 导出收藏列表
    exportFavorites() {
        const favorites = this.getFavorites();
        const data = JSON.stringify(favorites, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `favorites_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        Utils.Notification.success('收藏列表已导出');
    }

    // 导入收藏列表
    async importFavorites(file) {
        try {
            const text = await file.text();
            const favorites = JSON.parse(text);
            
            if (!Array.isArray(favorites)) {
                throw new Error('文件格式不正确');
            }

            let successCount = 0;
            for (const favorite of favorites) {
                try {
                    await this.add(favorite);
                    successCount++;
                } catch (error) {
                    console.error('Import favorite error:', error);
                }
            }

            Utils.Notification.success(`成功导入 ${successCount} 个收藏`);
        } catch (error) {
            Utils.Notification.error('导入失败: ' + error.message);
        }
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

// 创建收藏管理器实例
const favoritesManager = new FavoritesManager();

// 导出收藏管理器
window.FavoritesManager = FavoritesManager;
window.favoritesManager = favoritesManager;