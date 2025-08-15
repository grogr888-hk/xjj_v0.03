// API接口管理

class ApiClient {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    // 设置认证token
    setAuthToken(token) {
        if (token) {
            this.defaultHeaders['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.defaultHeaders['Authorization'];
        }
    }

    // 通用请求方法
    async request(url, options = {}) {
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(this.baseURL + url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // GET请求
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request(fullUrl, { method: 'GET' });
    }

    // POST请求
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT请求
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE请求
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
}

// 创建API客户端实例
const api = new ApiClient();

// API接口定义
const API = {
    // 用户相关
    auth: {
        login: (credentials) => api.post('/api/auth/login.php', credentials),
        register: (userData) => api.post('/api/auth/register.php', userData),
        logout: () => api.post('/api/auth/logout.php'),
        profile: () => api.get('/api/auth/profile.php'),
        updateProfile: (data) => api.put('/api/auth/profile.php', data)
    },

    // 内容源管理
    sources: {
        list: (type = '') => api.get('/api/sources/list.php', { type }),
        get: (id) => api.get(`/api/sources/get.php?id=${id}`),
        categories: (sourceId) => api.get(`/api/sources/categories.php?source_id=${sourceId}`)
    },

    // 内容相关
    content: {
        random: (sourceId, category = '') => api.get('/api/content/random.php', { source_id: sourceId, category }),
        get: (sourceId, contentId) => api.get('/api/content/get.php', { source_id: sourceId, content_id: contentId }),
        search: (sourceId, keyword, page = 1) => api.get('/api/content/search.php', { source_id: sourceId, keyword, page })
    },

    // 收藏相关
    favorites: {
        list: (type = '', page = 1) => api.get('/api/favorites/list.php', { type, page }),
        add: (data) => api.post('/api/favorites/add.php', data),
        remove: (id) => api.delete(`/api/favorites/remove.php?id=${id}`),
        check: (sourceId, contentId) => api.get('/api/favorites/check.php', { source_id: sourceId, content_id: contentId })
    },

    // 播放历史
    history: {
        list: (page = 1) => api.get('/api/history/list.php', { page }),
        add: (data) => api.post('/api/history/add.php', data),
        remove: (id) => api.delete(`/api/history/remove.php?id=${id}`),
        clear: () => api.delete('/api/history/clear.php')
    },

    // 系统配置
    config: {
        get: (key) => api.get(`/api/config/get.php?key=${key}`),
        public: () => api.get('/api/config/public.php')
    },

    // 日志记录
    logs: {
        access: (data) => api.post('/api/logs/access.php', data),
        play: (data) => api.post('/api/logs/play.php', data),
        operation: (data) => api.post('/api/logs/operation.php', data)
    },

    // IP检查
    ip: {
        check: () => api.get('/api/ip/check.php'),
        info: () => api.get('/api/ip/info.php')
    },

    // 代理播放
    proxy: {
        play: (url) => api.get('/api/proxy/play.php', { url: encodeURIComponent(url) })
    }
};

// 错误处理
api.interceptors = {
    response: {
        use: (successHandler, errorHandler) => {
            // 这里可以添加响应拦截器逻辑
        }
    }
};

// 请求重试机制
class RetryableRequest {
    constructor(maxRetries = 3, retryDelay = 1000) {
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    async execute(requestFn) {
        let lastError;
        
        for (let i = 0; i <= this.maxRetries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;
                
                if (i < this.maxRetries) {
                    await this.delay(this.retryDelay * Math.pow(2, i)); // 指数退避
                }
            }
        }
        
        throw lastError;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 缓存管理
class ApiCache {
    constructor(ttl = 5 * 60 * 1000) { // 默认5分钟
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    clear() {
        this.cache.clear();
    }

    delete(key) {
        this.cache.delete(key);
    }
}

// 创建缓存实例
const apiCache = new ApiCache();

// 带缓存的API请求
const CachedAPI = {
    async get(key, requestFn, useCache = true) {
        if (useCache) {
            const cached = apiCache.get(key);
            if (cached) return cached;
        }

        const data = await requestFn();
        if (useCache) {
            apiCache.set(key, data);
        }
        
        return data;
    }
};

// 批量请求管理
class BatchRequest {
    constructor(batchSize = 5, delay = 100) {
        this.batchSize = batchSize;
        this.delay = delay;
        this.queue = [];
        this.processing = false;
    }

    add(requestFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ requestFn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.batchSize);
            
            const promises = batch.map(async ({ requestFn, resolve, reject }) => {
                try {
                    const result = await requestFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            await Promise.allSettled(promises);
            
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }
        
        this.processing = false;
    }
}

// 创建批量请求实例
const batchRequest = new BatchRequest();

// 导出API相关工具
window.API = API;
window.ApiClient = ApiClient;
window.RetryableRequest = RetryableRequest;
window.ApiCache = ApiCache;
window.CachedAPI = CachedAPI;
window.BatchRequest = BatchRequest;
window.api = api;
window.apiCache = apiCache;
window.batchRequest = batchRequest;