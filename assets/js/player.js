// 视频播放器管理

class VideoPlayer {
    constructor() {
        this.player = null;
        this.hls = null;
        this.currentSource = null;
        this.currentEpisode = null;
        this.playMode = 'direct'; // direct 或 proxy
        this.autoNext = true;
        this.init();
    }

    // 初始化播放器
    init() {
        this.player = document.getElementById('videoPlayer');
        this.bindEvents();
        this.loadSettings();
    }

    // 绑定事件
    bindEvents() {
        if (!this.player) return;

        // 播放结束事件
        this.player.addEventListener('ended', () => {
            this.onPlayEnded();
        });

        // 播放错误事件
        this.player.addEventListener('error', (e) => {
            this.onPlayError(e);
        });

        // 播放进度事件
        this.player.addEventListener('timeupdate', () => {
            this.onTimeUpdate();
        });

        // 播放开始事件
        this.player.addEventListener('play', () => {
            this.onPlayStart();
        });

        // 暂停事件
        this.player.addEventListener('pause', () => {
            this.onPlayPause();
        });

        // 音量变化事件
        this.player.addEventListener('volumechange', () => {
            this.saveSettings();
        });
    }

    // 播放视频
    async play(url, options = {}) {
        if (!url) {
            Utils.Notification.error('播放地址为空');
            return;
        }

        try {
            // 停止当前播放
            this.stop();

            // 记录当前播放信息
            this.currentSource = options.source;
            this.currentEpisode = options.episode;

            // 根据播放模式处理URL
            const playUrl = this.playMode === 'proxy' ? 
                await this.getProxyUrl(url) : url;

            // 根据文件类型选择播放方式
            if (this.isHLSUrl(playUrl)) {
                await this.playHLS(playUrl);
            } else {
                await this.playDirect(playUrl);
            }

            // 记录播放日志
            this.logPlay(options);

        } catch (error) {
            console.error('Play error:', error);
            Utils.Notification.error('播放失败: ' + error.message);
        }
    }

    // 播放HLS流
    async playHLS(url) {
        if (Hls.isSupported()) {
            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });

            this.hls.loadSource(url);
            this.hls.attachMedia(this.player);

            // HLS事件监听
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.player.play().catch(e => {
                    console.error('Auto play failed:', e);
                });
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    this.onPlayError(new Error('HLS播放错误: ' + data.type));
                }
            });

        } else if (this.player.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari原生支持
            this.player.src = url;
            await this.player.play();
        } else {
            throw new Error('浏览器不支持HLS播放');
        }
    }

    // 直接播放
    async playDirect(url) {
        this.player.src = url;
        await this.player.play();
    }

    // 停止播放
    stop() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (this.player) {
            this.player.pause();
            this.player.removeAttribute('src');
            this.player.load();
        }
    }

    // 暂停播放
    pause() {
        if (this.player) {
            this.player.pause();
        }
    }

    // 恢复播放
    resume() {
        if (this.player) {
            this.player.play().catch(e => {
                console.error('Resume play failed:', e);
            });
        }
    }

    // 设置音量
    setVolume(volume) {
        if (this.player) {
            this.player.volume = Math.max(0, Math.min(1, volume));
        }
    }

    // 获取音量
    getVolume() {
        return this.player ? this.player.volume : 0;
    }

    // 设置播放位置
    setCurrentTime(time) {
        if (this.player) {
            this.player.currentTime = time;
        }
    }

    // 获取播放位置
    getCurrentTime() {
        return this.player ? this.player.currentTime : 0;
    }

    // 获取总时长
    getDuration() {
        return this.player ? this.player.duration : 0;
    }

    // 设置播放模式
    setPlayMode(mode) {
        this.playMode = mode;
        this.saveSettings();
        Utils.Notification.success(`已切换到${mode === 'direct' ? '直连' : '代理'}模式`);
    }

    // 获取代理播放地址
    async getProxyUrl(url) {
        try {
            const response = await API.proxy.play(url);
            return response.proxy_url || url;
        } catch (error) {
            console.error('Get proxy URL failed:', error);
            return url; // 降级到直连模式
        }
    }

    // 判断是否为HLS地址
    isHLSUrl(url) {
        return url.includes('.m3u8') || url.includes('m3u8');
    }

    // 播放结束处理
    onPlayEnded() {
        // 记录播放完成
        this.logPlayComplete();

        // 自动播放下一集
        if (this.autoNext) {
            this.playNext();
        }
    }

    // 播放错误处理
    onPlayError(error) {
        console.error('Player error:', error);
        Utils.Notification.error('播放出错，正在尝试其他线路...');
        
        // 尝试切换线路
        this.tryNextSource();
    }

    // 播放开始处理
    onPlayStart() {
        // 恢复播放位置
        this.restorePlayPosition();
    }

    // 播放暂停处理
    onPlayPause() {
        // 保存播放位置
        this.savePlayPosition();
    }

    // 时间更新处理
    onTimeUpdate() {
        // 定期保存播放位置
        if (this.getCurrentTime() % 10 < 0.5) { // 每10秒保存一次
            this.savePlayPosition();
        }
    }

    // 播放下一集
    playNext() {
        // 触发下一集播放事件
        this.emit('playNext');
    }

    // 尝试下一个播放源
    tryNextSource() {
        // 触发切换播放源事件
        this.emit('tryNextSource');
    }

    // 记录播放日志
    async logPlay(options) {
        try {
            await API.logs.play({
                source_id: options.sourceId,
                content_id: options.contentId,
                content_title: options.title,
                content_cover: options.cover,
                episode: options.episode,
                play_mode: this.playMode,
                duration: 0
            });
        } catch (error) {
            console.error('Log play error:', error);
        }
    }

    // 记录播放完成
    async logPlayComplete() {
        try {
            await API.logs.play({
                source_id: this.currentSource?.id,
                content_id: this.currentSource?.contentId,
                episode: this.currentEpisode,
                play_mode: this.playMode,
                duration: this.getDuration()
            });
        } catch (error) {
            console.error('Log play complete error:', error);
        }
    }

    // 保存播放位置
    savePlayPosition() {
        if (!this.currentSource) return;

        const key = `play_position_${this.currentSource.id}_${this.currentSource.contentId}_${this.currentEpisode}`;
        const position = {
            time: this.getCurrentTime(),
            duration: this.getDuration(),
            timestamp: Date.now()
        };

        Utils.Storage.set(key, position);
    }

    // 恢复播放位置
    restorePlayPosition() {
        if (!this.currentSource) return;

        const key = `play_position_${this.currentSource.id}_${this.currentSource.contentId}_${this.currentEpisode}`;
        const position = Utils.Storage.get(key);

        if (position && position.time > 30) { // 超过30秒才恢复
            const shouldRestore = confirm(`是否从上次播放位置 ${this.formatTime(position.time)} 继续播放？`);
            if (shouldRestore) {
                this.setCurrentTime(position.time);
            }
        }
    }

    // 保存播放器设置
    saveSettings() {
        const settings = {
            volume: this.getVolume(),
            playMode: this.playMode,
            autoNext: this.autoNext
        };

        Utils.Storage.set('player_settings', settings);
    }

    // 加载播放器设置
    loadSettings() {
        const settings = Utils.Storage.get('player_settings', {});

        if (settings.volume !== undefined) {
            this.setVolume(settings.volume);
        }

        if (settings.playMode) {
            this.playMode = settings.playMode;
        }

        if (settings.autoNext !== undefined) {
            this.autoNext = settings.autoNext;
        }

        // 更新UI
        this.updatePlayModeUI();
    }

    // 更新播放模式UI
    updatePlayModeUI() {
        const toggle = document.getElementById('playModeToggle');
        if (toggle) {
            toggle.checked = this.playMode === 'proxy';
        }
    }

    // 格式化时间
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // 获取播放统计
    getPlayStats() {
        return {
            currentTime: this.getCurrentTime(),
            duration: this.getDuration(),
            volume: this.getVolume(),
            playMode: this.playMode,
            source: this.currentSource,
            episode: this.currentEpisode
        };
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

// 创建播放器实例
const videoPlayer = new VideoPlayer();

// 导出播放器
window.VideoPlayer = VideoPlayer;
window.videoPlayer = videoPlayer;