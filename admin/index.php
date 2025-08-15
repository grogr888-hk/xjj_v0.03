<?php
session_start();
require '../config.php';

// 检查登录状态
if (!isset($_SESSION['admin_user'])) {
    header('Location: login.php');
    exit;
}

$admin = $_SESSION['admin_user'];

try {
    $conn = getDbConnection();
    
    // 获取统计数据
    $stats = getSystemStats($conn);
    
} catch (Exception $e) {
    error_log('Admin dashboard error: ' . $e->getMessage());
    $stats = [];
}

// 获取系统统计
function getSystemStats($conn) {
    $stats = [];
    
    try {
        // 用户统计
        $result = $conn->query("SELECT COUNT(*) as total, 
                                      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                                      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
                               FROM users");
        $stats['users'] = $result->fetch_assoc();
        
        // 内容源统计
        $result = $conn->query("SELECT COUNT(*) as total,
                                      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                                      SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) as video,
                                      SUM(CASE WHEN type = 'novel' THEN 1 ELSE 0 END) as novel,
                                      SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) as image
                               FROM content_sources");
        $stats['sources'] = $result->fetch_assoc();
        
        // 访问日志统计（今日）
        $result = $conn->query("SELECT COUNT(*) as total,
                                      COUNT(DISTINCT ip_address) as unique_ips
                               FROM access_logs 
                               WHERE DATE(created_at) = CURDATE()");
        $stats['access_today'] = $result->fetch_assoc();
        
        // 播放日志统计（今日）
        $result = $conn->query("SELECT COUNT(*) as total,
                                      COUNT(DISTINCT user_id) as unique_users,
                                      SUM(duration) as total_duration
                               FROM play_logs 
                               WHERE DATE(created_at) = CURDATE()");
        $stats['play_today'] = $result->fetch_assoc();
        
        // 收藏统计
        $result = $conn->query("SELECT COUNT(*) as total,
                                      SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) as video,
                                      SUM(CASE WHEN content_type = 'novel' THEN 1 ELSE 0 END) as novel,
                                      SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) as image
                               FROM favorites");
        $stats['favorites'] = $result->fetch_assoc();
        
        // IP黑名单统计
        $result = $conn->query("SELECT COUNT(*) as total,
                                      SUM(CASE WHEN type = 'ip' THEN 1 ELSE 0 END) as ip,
                                      SUM(CASE WHEN type = 'range' THEN 1 ELSE 0 END) as range,
                                      SUM(CASE WHEN type = 'country' THEN 1 ELSE 0 END) as country
                               FROM ip_blacklist");
        $stats['blacklist'] = $result->fetch_assoc();
        
    } catch (Exception $e) {
        error_log('Get system stats error: ' . $e->getMessage());
    }
    
    return $stats;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台 - 多媒体内容管理平台</title>
    <link rel="stylesheet" href="assets/css/admin.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="admin-layout">
        <!-- 侧边栏 -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>🎬 管理后台</h1>
                <p>欢迎，<?= htmlspecialchars($admin['username']) ?></p>
            </div>
            
            <nav class="sidebar-nav">
                <a href="#dashboard" class="nav-item active" data-page="dashboard">
                    <span class="icon">📊</span>
                    仪表板
                </a>
                <a href="#sources" class="nav-item" data-page="sources">
                    <span class="icon">🔗</span>
                    内容源管理
                </a>
                <a href="#users" class="nav-item" data-page="users">
                    <span class="icon">👥</span>
                    用户管理
                </a>
                <a href="#blacklist" class="nav-item" data-page="blacklist">
                    <span class="icon">🚫</span>
                    IP黑名单
                </a>
                <a href="#logs" class="nav-item" data-page="logs">
                    <span class="icon">📝</span>
                    日志管理
                </a>
                <a href="#favorites" class="nav-item" data-page="favorites">
                    <span class="icon">❤️</span>
                    收藏管理
                </a>
                <a href="#config" class="nav-item" data-page="config">
                    <span class="icon">⚙️</span>
                    系统配置
                </a>
                <a href="#monitor" class="nav-item" data-page="monitor">
                    <span class="icon">📈</span>
                    系统监控
                </a>
                <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border-color);">
                <a href="logout.php" class="nav-item">
                    <span class="icon">🚪</span>
                    退出登录
                </a>
            </nav>
        </aside>
        
        <!-- 主内容区 -->
        <main class="main-content">
            <!-- 仪表板页面 -->
            <div id="page-dashboard" class="page-content active">
                <div class="page-header">
                    <h1 class="page-title">仪表板</h1>
                    <p class="page-subtitle">系统概览和统计信息</p>
                </div>
                
                <!-- 统计卡片 -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value"><?= $stats['users']['total'] ?? 0 ?></div>
                        <div class="stat-label">总用户数</div>
                        <div class="stat-meta">
                            活跃: <?= $stats['users']['active'] ?? 0 ?> | 
                            管理员: <?= $stats['users']['admins'] ?? 0 ?>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">🔗</div>
                        <div class="stat-value"><?= $stats['sources']['total'] ?? 0 ?></div>
                        <div class="stat-label">内容源数量</div>
                        <div class="stat-meta">
                            视频: <?= $stats['sources']['video'] ?? 0 ?> | 
                            小说: <?= $stats['sources']['novel'] ?? 0 ?> | 
                            图片: <?= $stats['sources']['image'] ?? 0 ?>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-value"><?= $stats['access_today']['total'] ?? 0 ?></div>
                        <div class="stat-label">今日访问量</div>
                        <div class="stat-meta">
                            独立IP: <?= $stats['access_today']['unique_ips'] ?? 0 ?>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">▶️</div>
                        <div class="stat-value"><?= $stats['play_today']['total'] ?? 0 ?></div>
                        <div class="stat-label">今日播放量</div>
                        <div class="stat-meta">
                            用户: <?= $stats['play_today']['unique_users'] ?? 0 ?> | 
                            时长: <?= formatDuration($stats['play_today']['total_duration'] ?? 0) ?>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">❤️</div>
                        <div class="stat-value"><?= $stats['favorites']['total'] ?? 0 ?></div>
                        <div class="stat-label">总收藏数</div>
                        <div class="stat-meta">
                            视频: <?= $stats['favorites']['video'] ?? 0 ?> | 
                            小说: <?= $stats['favorites']['novel'] ?? 0 ?> | 
                            图片: <?= $stats['favorites']['image'] ?? 0 ?>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">🚫</div>
                        <div class="stat-value"><?= $stats['blacklist']['total'] ?? 0 ?></div>
                        <div class="stat-label">黑名单条目</div>
                        <div class="stat-meta">
                            IP: <?= $stats['blacklist']['ip'] ?? 0 ?> | 
                            段: <?= $stats['blacklist']['range'] ?? 0 ?> | 
                            国家: <?= $stats['blacklist']['country'] ?? 0 ?>
                        </div>
                    </div>
                </div>
                
                <!-- 图表区域 -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">访问趋势</h2>
                    </div>
                    <canvas id="accessChart" width="400" height="200"></canvas>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">内容类型分布</h2>
                    </div>
                    <canvas id="contentChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <!-- 其他页面内容将通过AJAX加载 -->
            <div id="page-sources" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">内容源管理</h1>
                    <p class="page-subtitle">管理视频、小说、图片等内容源</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-users" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">用户管理</h1>
                    <p class="page-subtitle">管理系统用户和权限</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-blacklist" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">IP黑名单</h1>
                    <p class="page-subtitle">管理IP和地区访问限制</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-logs" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">日志管理</h1>
                    <p class="page-subtitle">查看系统访问和操作日志</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-favorites" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">收藏管理</h1>
                    <p class="page-subtitle">查看和管理用户收藏</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-config" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">系统配置</h1>
                    <p class="page-subtitle">配置系统参数和选项</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
            
            <div id="page-monitor" class="page-content">
                <div class="page-header">
                    <h1 class="page-title">系统监控</h1>
                    <p class="page-subtitle">监控系统性能和状态</p>
                </div>
                <div class="loading-placeholder">
                    <div class="loading"></div>
                    <p>加载中...</p>
                </div>
            </div>
        </main>
    </div>
    
    <script src="assets/js/admin.js"></script>
    <script>
        // 初始化图表
        document.addEventListener('DOMContentLoaded', function() {
            initCharts();
        });
        
        function initCharts() {
            // 访问趋势图
            const accessCtx = document.getElementById('accessChart').getContext('2d');
            new Chart(accessCtx, {
                type: 'line',
                data: {
                    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                    datasets: [{
                        label: '访问量',
                        data: [120, 190, 300, 500, 200, 300, 450],
                        borderColor: '#007aff',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            
            // 内容类型分布图
            const contentCtx = document.getElementById('contentChart').getContext('2d');
            new Chart(contentCtx, {
                type: 'doughnut',
                data: {
                    labels: ['视频', '小说', '图片'],
                    datasets: [{
                        data: [<?= $stats['sources']['video'] ?? 0 ?>, <?= $stats['sources']['novel'] ?? 0 ?>, <?= $stats['sources']['image'] ?? 0 ?>],
                        backgroundColor: ['#007aff', '#34c759', '#ff9500']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    </script>
</body>
</html>

<?php
// 格式化时长
function formatDuration($seconds) {
    if ($seconds < 60) {
        return $seconds . '秒';
    } elseif ($seconds < 3600) {
        return floor($seconds / 60) . '分钟';
    } else {
        return floor($seconds / 3600) . '小时' . floor(($seconds % 3600) / 60) . '分钟';
    }
}
?>