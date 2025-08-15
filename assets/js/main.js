// 主应用逻辑

class App {
    constructor() {
        this.currentContentType = 'video';
        this.currentSource = null;
        this.currentContent = null;
        this.sources = [];
        this.categories = [];
        this.episodes = [];
        this.playUrls = [];
        this.currentEpisodeIndex = 0;
        this.currentSourceIndex = 0;
        this.init();
    }

    // 初始化应用
    async init() {
        try {
            // 显示骨架屏
            this.showSkeleton();
            
            // 初始化各个模块
            await this.initModules();
            
            // 加载初始数据
            await this.loadInitialData();
            
            // 绑定事件
            this.bindEvents();
            
            // 隐藏骨架屏，显示应用
            this.hideSkeleton();
            
            // 记录访问日志
            this.logAccess();
            
        } catch (error) {
            console.error('App init error:', error);
            Utils.Notification.error('应用初始化失败');
        }
    }

    // 显示骨架屏
    showSkeleton() {
        document.getElementById('skeleton-loader').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    // 隐藏骨架屏
    hideSkeleton() {
        document.getElementById('skeleton-loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    // 初始化模块
    async initModules() {
        // 检查IP是否被封禁
        await this.checkIPStatus();
        
        // 加载系统配置
        await this.loadSystemConfig();
    }

    // 检查IP状态
    async checkIPStatus() {
        try {
            const response = await API.ip.check();
            if (!response.allowed) {
                document.body.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5;">
                        <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                            <h2 style="color: #ff3b30; margin-bottom: 16px;">🚫 访问受限</h2>
                            <p style="color: #666; margin-bottom: 20px;">${response.reason || '您的IP地址已被限制访问'}</p>
                            <p style="color: #999; font-size: 0.9rem;">如有疑问，请联系管理员</p>
                        </div>
                    </div>
                `;
                throw new Error('IP blocked');
            }
        } catch (error) {
            if (error.message === 'IP blocked') {
                throw error;
            }
            // IP检查失败时继续运行
            console.warn('IP check failed:', error);
        }
    }

    // 加载系统配置
    async loadSystemConfig() {
        try {
            const config = await API.config.public();
            if (config.success) {
                // 应用系统配置
                document.title = config.site_name || document.title;
                
                // 设置默认播放模式
                if (config.default_play_mode) {
                    videoPlayer.setPlayMode(config.default_play_mode);
                }
            }
        } catch (error) {
            console.error('Load system config error:', error);
        }
    }

    // 加载初始数据
    async loadInitialData() {
        await this.loadSources();
        if (this.sources.length > 0) {
            await this.selectSource(this.sources[0]);
            await this.loadRandomContent();
        }
    }

    // 加载内容源列表
    async loadSources() {
        try {
            const response = await API.sources.list(this.currentContentType);
            if (response.success) {
                this.sources = response.sources;
                this.updateSourceSelect();
            }
        } catch (error) {
            console.error('Load sources error:', error);
            Utils.Notification.error('加载内容源失败');
        }
    }

    // 更新源选择器
    updateSourceSelect() {
        const select = document.getElementById('sourceSelect');
        select.innerHTML = '';
        
        if (this.sources.length === 0) {
            select.innerHTML = '<option value="">暂无可用源</option>';
            return;
        }

        this.sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.id;
            option.textContent = source.name;
            select.appendChild(option);
        });

        // 选择第一个源
        if (this.sources.length > 0) {
            select.value = this.sources[0].id;
        }
    }

    // 选择内容源
    async selectSource(source) {
        this.currentSource = source;
        await this.loadCategories();
    }

    // 加载分类列表
    async loadCategories() {
        if (!this.currentSource) return;

        try {
            const response = await API.sources.categories(this.currentSource.id);
            if (response.success) {
                this.categories = response.categories || [];
                this.updateCategorySelect();
            }
        } catch (error) {
            console.error('Load categories error:', error);
            this.categories = [];
            this.updateCategorySelect();
        }
    }

    // 更新分类选择器
    updateCategorySelect() {
        const select = document.getElementById('categorySelect');
        select.innerHTML = '<option value="">全部分类</option>';
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id || category.name;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    // 加载随机内容
    async loadRandomContent() {
        if (!this.currentSource) return;

        try {
            const categorySelect = document.getElementById('categorySelect');
            const category = categorySelect.value;
            
            const response = await API.content.random(this.currentSource.id, category);
            if (response.success && response.content) {
                await this.displayContent(response.content);
            } else {
                throw new Error(response.message || '获取内容失败');
            }
        } catch (error) {
            console.error('Load random content error:', error);
            Utils.Notification.error('加载内容失败，正在重试...');
            
            // 重试机制
            setTimeout(() => this.loadRandomContent(), 2000);
        }
    }

    // 显示内容
    async displayContent(content) {
        this.currentContent = content;
        
        // 更新基本信息
        this.updateContentInfo(content);
        
        // 解析播放数据
        this.parsePlayData(content);
        
        // 更新UI
        this.updatePlayUI();
        
        // 更新收藏按钮状态
        this.updateFavoriteButton();
    }

    // 更新内容信息
    updateContentInfo(content) {
        // 标题
        const titleEl = document.getElementById('videoTitle');
        if (titleEl) {
            titleEl.textContent = content.vod_name || '未知标题';
            titleEl.dataset.vodName = content.vod_name || '';
        }

        // 封面
        const posterEl = document.getElementById('videoPoster');
        if (posterEl) {
            posterEl.src = content.vod_pic || '/assets/images/default-cover.png';
            posterEl.onerror = () => {
                posterEl.src = '/assets/images/default-cover.png';
            };
        }

        // 演员
        const actorEl = document.getElementById('videoActor');
        if (actorEl) {
            actorEl.textContent = '演员：' + (content.vod_actor || '未知');
        }

        // 导演
        const directorEl = document.getElementById('videoDirector');
        if (directorEl) {
            directorEl.textContent = '导演：' + (content.vod_director || '未知');
        }

        // 类型
        const typeEl = document.getElementById('videoType');
        if (typeEl) {
            typeEl.textContent = '类型：' + (content.type_name || '未知');
        }

        // 发布时间
        const pubdateEl = document.getElementById('videoPubdate');
        if (pubdateEl) {
            const pubdate = content.vod_pubdate || content.vod_time;
            pubdateEl.textContent = '发布：' + (pubdate ? new Date(pubdate).toLocaleDateString() : '未知');
        }

        // 简介
        const descEl = document.getElementById('videoDesc');
        if (descEl) {
            const desc = (content.vod_content || content.vod_blurb || '暂无简介')
                .replace(/<\/?[^>]+(>|$)/g, "").trim();
            descEl.textContent = desc || '暂无简介';
        }
    }

    // 解析播放数据
    parsePlayData(content) {
        const playUrl = content.vod_play_url || '';
        this.episodes = this.parseEpisodes(playUrl);
        this.currentEpisodeIndex = 0;
    }

    // 解析集数数据
    parseEpisodes(playUrl) {
        if (!playUrl) return [];

        const episodeStrs = playUrl.split('#').filter(s => s.trim());
        return episodeStrs.map((epStr, index) => {
            const playUrls = this.parsePlayUrls(epStr);
            return {
                title: playUrls[0]?.label || `第${index + 1}集`,
                playUrls: playUrls
            };
        });
    }

    // 解析播放地址
    parsePlayUrls(rawStr) {
        const sources = rawStr.split('$$$').filter(Boolean);
        return sources.map(src => {
            const parts = src.split('$');
            return { 
                label: parts[0] || '线路1', 
                url: parts[1] || '' 
            };
        }).filter(s => s.url);
    }

    // 更新播放UI
    updatePlayUI() {
        this.updateEpisodeList();
        this.updateSourceList();
        
        // 默认播放第一集第一个线路
        if (this.episodes.length > 0) {
            this.playEpisode(0, 0);
        }
    }

    // 更新集数列表
    updateEpisodeList() {
        const container = document.getElementById('episodeContainer');
        if (!container) return;

        container.innerHTML = '';
        
        this.episodes.forEach((episode, index) => {
            const btn = document.createElement('button');
            btn.className = 'episode-btn';
            btn.textContent = episode.title;
            btn.onclick = () => this.playEpisode(index);
            container.appendChild(btn);
        });
    }

    // 更新线路列表
    updateSourceList() {
        const container = document.getElementById('sourceContainer');
        if (!container) return;

        container.innerHTML = '';
        
        if (this.currentEpisodeIndex < this.episodes.length) {
            const episode = this.episodes[this.currentEpisodeIndex];
            episode.playUrls.forEach((source, index) => {
                const btn = document.createElement('button');
                btn.className = 'source-btn';
                btn.textContent = source.label;
                btn.onclick = () => this.playSource(index);
                container.appendChild(btn);
            });
        }
    }

    // 播放指定集数
    async playEpisode(episodeIndex, sourceIndex = 0) {
        if (episodeIndex >= this.episodes.length) return;

        this.currentEpisodeIndex = episodeIndex;
        this.currentSourceIndex = sourceIndex;

        // 更新集数按钮状态
        document.querySelectorAll('.episode-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index === episodeIndex);
        });

        // 更新线路列表
        this.updateSourceList();

        // 播放指定线路
        await this.playSource(sourceIndex);

        // 更新标题
        const episode = this.episodes[episodeIndex];
        const titleEl = document.getElementById('videoTitle');
        if (titleEl) {
            const vodName = titleEl.dataset.vodName || '视频';
            titleEl.textContent = `${vodName} - ${episode.title}`;
        }
    }

    // 播放指定线路
    async playSource(sourceIndex) {
        if (this.currentEpisodeIndex >= this.episodes.length) return;

        const episode = this.episodes[this.currentEpisodeIndex];
        if (sourceIndex >= episode.playUrls.length) return;

        this.currentSourceIndex = sourceIndex;

        // 更新线路按钮状态
        document.querySelectorAll('.source-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index === sourceIndex);
        });

        // 播放视频
        const playUrl = episode.playUrls[sourceIndex];
        await videoPlayer.play(playUrl.url, {
            sourceId: this.currentSource.id,
            contentId: this.currentContent.vod_id,
            title: this.currentContent.vod_name,
            cover: this.currentContent.vod_pic,
            episode: episode.title,
            source: this.currentSource
        });
    }

    // 更新收藏按钮状态
    updateFavoriteButton() {
        const btn = document.getElementById('favoriteBtn');
        if (!btn || !this.currentContent) return;

        // 设置数据属性
        btn.dataset.sourceId = this.currentSource.id;
        btn.dataset.contentId = this.currentContent.vod_id;
        btn.dataset.contentTitle = this.currentContent.vod_name;
        btn.dataset.contentCover = this.currentContent.vod_pic;
        btn.dataset.contentType = this.currentContentType;

        // 更新状态
        favoritesManager.updateUI();
    }

    // 切换内容类型
    async switchContentType(type) {
        if (this.currentContentType === type) return;

        this.currentContentType = type;
        
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // 显示对应的内容区域
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('active', section.id === `${type}Content`);
        });

        // 重新加载数据
        if (type === 'video') {
            await this.loadSources();
            if (this.sources.length > 0) {
                await this.selectSource(this.sources[0]);
                await this.loadRandomContent();
            }
        } else {
            // 其他类型的内容加载逻辑
            Utils.Notification.warning(`${type === 'novel' ? '小说' : '图片'}功能开发中...`);
        }
    }

    // 绑定事件
    bindEvents() {
        // 导航按钮点击
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchContentType(btn.dataset.type);
            });
        });

        // 源选择变化
        const sourceSelect = document.getElementById('sourceSelect');
        sourceSelect.addEventListener('change', async () => {
            const sourceId = parseInt(sourceSelect.value);
            const source = this.sources.find(s => s.id === sourceId);
            if (source) {
                await this.selectSource(source);
                await this.loadRandomContent();
            }
        });

        // 分类选择变化
        const categorySelect = document.getElementById('categorySelect');
        categorySelect.addEventListener('change', () => {
            this.loadRandomContent();
        });

        // 播放模式切换
        const playModeToggle = document.getElementById('playModeToggle');
        playModeToggle.addEventListener('change', () => {
            const mode = playModeToggle.checked ? 'proxy' : 'direct';
            videoPlayer.setPlayMode(mode);
        });

        // 随机播放按钮
        const randomBtn = document.getElementById('randomBtn');
        randomBtn.addEventListener('click', () => {
            this.loadRandomContent();
        });

        // 简介展开/收起
        const descToggle = document.getElementById('descToggle');
        descToggle.addEventListener('click', () => {
            const wrapper = document.getElementById('desc-wrapper');
            const isExpanded = wrapper.classList.toggle('expanded');
            descToggle.textContent = isExpanded ? '收起' : '展开';
        });

        // 历史记录按钮
        const historyBtn = document.getElementById('historyBtn');
        historyBtn.addEventListener('click', () => {
            this.showHistoryModal();
        });

        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        settingsBtn.addEventListener('click', () => {
            this.showSettingsModal();
        });

        // 播放器事件
        videoPlayer.on('playNext', () => {
            this.playNextEpisode();
        });

        videoPlayer.on('tryNextSource', () => {
            this.tryNextSource();
        });

        // 收藏事件
        favoritesManager.on('playFavorite', (data) => {
            this.playFavoriteContent(data);
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }

    // 播放下一集
    playNextEpisode() {
        const nextIndex = this.currentEpisodeIndex + 1;
        if (nextIndex < this.episodes.length) {
            this.playEpisode(nextIndex);
        } else {
            // 播放完毕，加载新内容
            Utils.Notification.success('播放完毕，正在加载新内容...');
            setTimeout(() => this.loadRandomContent(), 2000);
        }
    }

    // 尝试下一个播放源
    tryNextSource() {
        const episode = this.episodes[this.currentEpisodeIndex];
        const nextSourceIndex = this.currentSourceIndex + 1;
        
        if (nextSourceIndex < episode.playUrls.length) {
            this.playSource(nextSourceIndex);
        } else {
            Utils.Notification.error('所有线路都无法播放');
        }
    }

    // 播放收藏的内容
    async playFavoriteContent(data) {
        try {
            // 切换到对应的内容类型
            await this.switchContentType(data.contentType);
            
            // 选择对应的源
            const source = this.sources.find(s => s.id === data.sourceId);
            if (source) {
                await this.selectSource(source);
                
                // 获取具体内容
                const response = await API.content.get(data.sourceId, data.contentId);
                if (response.success) {
                    await this.displayContent(response.content);
                }
            }
        } catch (error) {
            Utils.Notification.error('播放收藏内容失败');
        }
    }

    // 显示历史记录模态框
    showHistoryModal() {
        Utils.Modal.show('观看历史', '<p>历史记录功能开发中...</p>');
    }

    // 显示设置模态框
    showSettingsModal() {
        const settings = `
            <div class="settings-modal">
                <div class="setting-group">
                    <h3>播放设置</h3>
                    <div class="setting-item">
                        <label>默认播放模式</label>
                        <select id="defaultPlayMode" class="form-input">
                            <option value="direct">直连播放</option>
                            <option value="proxy">代理播放</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="autoNext"> 自动播放下一集
                        </label>
                    </div>
                </div>
                <div class="setting-group">
                    <h3>界面设置</h3>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="darkMode"> 深色模式
                        </label>
                    </div>
                </div>
                <div class="setting-actions">
                    <button class="btn btn-primary" onclick="app.saveSettings()">保存设置</button>
                </div>
            </div>
        `;

        Utils.Modal.show('设置', settings);

        // 加载当前设置
        this.loadSettingsUI();
    }

    // 加载设置UI
    loadSettingsUI() {
        const settings = Utils.Storage.get('app_settings', {});
        
        const defaultPlayMode = document.getElementById('defaultPlayMode');
        if (defaultPlayMode) {
            defaultPlayMode.value = settings.defaultPlayMode || 'direct';
        }

        const autoNext = document.getElementById('autoNext');
        if (autoNext) {
            autoNext.checked = settings.autoNext !== false;
        }

        const darkMode = document.getElementById('darkMode');
        if (darkMode) {
            darkMode.checked = settings.darkMode || false;
        }
    }

    // 保存设置
    saveSettings() {
        const settings = {
            defaultPlayMode: document.getElementById('defaultPlayMode')?.value || 'direct',
            autoNext: document.getElementById('autoNext')?.checked !== false,
            darkMode: document.getElementById('darkMode')?.checked || false
        };

        Utils.Storage.set('app_settings', settings);
        
        // 应用设置
        videoPlayer.setPlayMode(settings.defaultPlayMode);
        videoPlayer.autoNext = settings.autoNext;
        
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        Utils.Modal.hide();
        Utils.Notification.success('设置已保存');
    }

    // 键盘快捷键处理
    handleKeyboard(e) {
        // 如果在输入框中，不处理快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case ' ': // 空格键暂停/播放
                e.preventDefault();
                if (videoPlayer.player.paused) {
                    videoPlayer.resume();
                } else {
                    videoPlayer.pause();
                }
                break;
            case 'ArrowLeft': // 左箭头后退10秒
                e.preventDefault();
                videoPlayer.setCurrentTime(videoPlayer.getCurrentTime() - 10);
                break;
            case 'ArrowRight': // 右箭头前进10秒
                e.preventDefault();
                videoPlayer.setCurrentTime(videoPlayer.getCurrentTime() + 10);
                break;
            case 'ArrowUp': // 上箭头音量+
                e.preventDefault();
                videoPlayer.setVolume(Math.min(1, videoPlayer.getVolume() + 0.1));
                break;
            case 'ArrowDown': // 下箭头音量-
                e.preventDefault();
                videoPlayer.setVolume(Math.max(0, videoPlayer.getVolume() - 0.1));
                break;
            case 'f': // F键全屏
            case 'F':
                e.preventDefault();
                if (videoPlayer.player.requestFullscreen) {
                    videoPlayer.player.requestFullscreen();
                }
                break;
            case 'n': // N键下一集
            case 'N':
                e.preventDefault();
                this.playNextEpisode();
                break;
            case 'r': // R键随机播放
            case 'R':
                e.preventDefault();
                this.loadRandomContent();
                break;
        }
    }

    // 记录访问日志
    async logAccess() {
        try {
            const ipInfo = await API.ip.info();
            await API.logs.access({
                ip: ipInfo.ip,
                country: ipInfo.country,
                city: ipInfo.city,
                user_agent: navigator.userAgent,
                device_type: Utils.Device.isMobile() ? 'mobile' : 'desktop',
                request_url: window.location.href,
                referer: document.referrer
            });
        } catch (error) {
            console.error('Log access error:', error);
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// 导出应用类
window.App = App;