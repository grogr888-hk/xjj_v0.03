<?php
// 全新安装脚本 - 支持多内容类型源管理平台

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $dbhost = trim($_POST['dbhost'] ?? '');
    $dbuser = trim($_POST['dbuser'] ?? '');
    $dbpass = trim($_POST['dbpass'] ?? '');
    $dbname = trim($_POST['dbname'] ?? '');
    $admin_user = trim($_POST['admin_user'] ?? '');
    $admin_pass = trim($_POST['admin_pass'] ?? '');
    $admin_pass_confirm = trim($_POST['admin_pass_confirm'] ?? '');
    $admin_email = trim($_POST['admin_email'] ?? '');

    // 验证
    if (!$dbhost || !$dbuser || !$dbname) {
        die('数据库连接信息不能为空');
    }
    if (!$admin_user || !$admin_pass || !$admin_email) {
        die('管理员信息不能为空');
    }
    if ($admin_pass !== $admin_pass_confirm) {
        die('管理员密码和确认密码不一致');
    }

    // 连接数据库
    $conn = new mysqli($dbhost, $dbuser, $dbpass, $dbname);
    if ($conn->connect_errno) {
        die("数据库连接失败: " . $conn->connect_error);
    }
    $conn->set_charset('utf8mb4');

    // 创建所有表
    $tables = [
        // 系统配置表
        "CREATE TABLE IF NOT EXISTS `system_config` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `config_key` VARCHAR(100) NOT NULL UNIQUE,
            `config_value` TEXT NOT NULL,
            `config_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
            `description` VARCHAR(255) DEFAULT '',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 用户表
        "CREATE TABLE IF NOT EXISTS `users` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `username` VARCHAR(50) NOT NULL UNIQUE,
            `email` VARCHAR(100) NOT NULL UNIQUE,
            `password` VARCHAR(255) NOT NULL,
            `avatar` VARCHAR(255) DEFAULT '',
            `role` ENUM('admin', 'user') DEFAULT 'user',
            `status` ENUM('active', 'banned', 'pending') DEFAULT 'active',
            `last_login_at` TIMESTAMP NULL,
            `last_login_ip` VARCHAR(45) DEFAULT '',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 内容源表 (支持视频、小说、图片)
        "CREATE TABLE IF NOT EXISTS `content_sources` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(255) NOT NULL,
            `type` ENUM('video', 'novel', 'image') NOT NULL,
            `api_url` TEXT NOT NULL,
            `parse_url` TEXT DEFAULT '',
            `status` ENUM('active', 'inactive') DEFAULT 'active',
            `priority` INT DEFAULT 0,
            `categories` JSON DEFAULT NULL,
            `headers` JSON DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // IP黑名单表
        "CREATE TABLE IF NOT EXISTS `ip_blacklist` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `ip_address` VARCHAR(45) NOT NULL,
            `ip_range` VARCHAR(50) DEFAULT '',
            `country` VARCHAR(100) DEFAULT '',
            `reason` VARCHAR(255) DEFAULT '',
            `type` ENUM('ip', 'range', 'country') DEFAULT 'ip',
            `created_by` INT DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 访问日志表
        "CREATE TABLE IF NOT EXISTS `access_logs` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `user_id` INT DEFAULT NULL,
            `ip_address` VARCHAR(45) NOT NULL,
            `country` VARCHAR(100) DEFAULT '',
            `city` VARCHAR(100) DEFAULT '',
            `user_agent` TEXT DEFAULT '',
            `device_type` VARCHAR(50) DEFAULT '',
            `request_url` VARCHAR(500) DEFAULT '',
            `referer` VARCHAR(500) DEFAULT '',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
            INDEX `idx_ip` (`ip_address`),
            INDEX `idx_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 播放日志表
        "CREATE TABLE IF NOT EXISTS `play_logs` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `user_id` INT DEFAULT NULL,
            `source_id` INT NOT NULL,
            `content_id` VARCHAR(100) NOT NULL,
            `content_title` VARCHAR(255) DEFAULT '',
            `content_cover` VARCHAR(500) DEFAULT '',
            `episode` VARCHAR(100) DEFAULT '',
            `play_mode` ENUM('direct', 'proxy') DEFAULT 'direct',
            `ip_address` VARCHAR(45) NOT NULL,
            `duration` INT DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
            FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_content` (`content_id`, `source_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 收藏表
        "CREATE TABLE IF NOT EXISTS `favorites` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `user_id` INT NOT NULL,
            `source_id` INT NOT NULL,
            `content_id` VARCHAR(100) NOT NULL,
            `content_title` VARCHAR(255) DEFAULT '',
            `content_cover` VARCHAR(500) DEFAULT '',
            `content_type` ENUM('video', 'novel', 'image') NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE CASCADE,
            UNIQUE KEY `unique_favorite` (`user_id`, `source_id`, `content_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 操作日志表
        "CREATE TABLE IF NOT EXISTS `operation_logs` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `user_id` INT DEFAULT NULL,
            `action` VARCHAR(100) NOT NULL,
            `target_type` VARCHAR(50) DEFAULT '',
            `target_id` VARCHAR(100) DEFAULT '',
            `details` JSON DEFAULT NULL,
            `ip_address` VARCHAR(45) NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
            INDEX `idx_action` (`action`),
            INDEX `idx_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // 无效内容ID表
        "CREATE TABLE IF NOT EXISTS `invalid_content_ids` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `source_id` INT NOT NULL,
            `content_id` VARCHAR(100) NOT NULL,
            `reason` VARCHAR(255) DEFAULT '',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE CASCADE,
            UNIQUE KEY `unique_invalid` (`source_id`, `content_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
    ];

    // 执行建表语句
    foreach ($tables as $sql) {
        if (!$conn->query($sql)) {
            die("创建表失败: " . $conn->error);
        }
    }

    // 插入管理员用户
    $hashed_password = password_hash($admin_pass, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')");
    $stmt->bind_param('sss', $admin_user, $admin_email, $hashed_password);
    $stmt->execute();
    $stmt->close();

    // 插入默认系统配置
    $default_configs = [
        ['site_name', '多媒体内容管理平台', 'string', '网站名称'],
        ['site_description', '支持视频、小说、图片的多媒体内容管理平台', 'string', '网站描述'],
        ['default_play_mode', 'direct', 'string', '默认播放模式'],
        ['enable_registration', 'true', 'boolean', '是否允许用户注册'],
        ['enable_ip_check', 'true', 'boolean', '是否启用IP检查'],
        ['max_favorites', '1000', 'number', '用户最大收藏数量'],
        ['log_retention_days', '30', 'number', '日志保留天数']
    ];

    $stmt = $conn->prepare("INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)");
    foreach ($default_configs as $config) {
        $stmt->bind_param('ssss', $config[0], $config[1], $config[2], $config[3]);
        $stmt->execute();
    }
    $stmt->close();

    // 生成配置文件
    $config_content = <<<PHP
<?php
// 自动生成的数据库配置文件
define('DB_HOST', '$dbhost');
define('DB_USER', '$dbuser');
define('DB_PASS', '$dbpass');
define('DB_NAME', '$dbname');

// 数据库连接
function getDbConnection() {
    static \$conn = null;
    if (\$conn === null) {
        \$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if (\$conn->connect_errno) {
            die("数据库连接失败: " . \$conn->connect_error);
        }
        \$conn->set_charset('utf8mb4');
    }
    return \$conn;
}

// 全局配置
define('SITE_ROOT', dirname(__FILE__));
define('API_ROOT', SITE_ROOT . '/api');
define('ADMIN_ROOT', SITE_ROOT . '/admin');

// 时区设置
date_default_timezone_set('Asia/Shanghai');
PHP;

    if (file_put_contents(__DIR__ . '/config.php', $config_content) === false) {
        die('生成 config.php 文件失败');
    }

    // 重命名安装文件
    $random_filename = 'install_' . bin2hex(random_bytes(10)) . '.php.bak';
    rename(__FILE__, __DIR__ . '/' . $random_filename);

    echo "
    <div style='max-width: 600px; margin: 50px auto; padding: 30px; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); font-family: -apple-system, BlinkMacSystemFont, sans-serif;'>
        <h2 style='color: #007aff; text-align: center; margin-bottom: 30px;'>🎉 安装完成！</h2>
        <div style='background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;'>
            <h3 style='margin-top: 0; color: #0369a1;'>安装信息</h3>
            <p>✅ 数据库表创建成功</p>
            <p>✅ 管理员账号已创建</p>
            <p>✅ 系统配置已初始化</p>
            <p>✅ 安装文件已重命名为: <code>$random_filename</code></p>
        </div>
        <div style='text-align: center;'>
            <a href='admin/login.php' style='display: inline-block; background: #007aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 10px;'>进入管理后台</a>
            <a href='index.html' style='display: inline-block; background: #34c759; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;'>访问前台</a>
        </div>
        <div style='margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;'>
            <strong>⚠️ 安全提醒：</strong>
            <p style='margin: 5px 0 0 0;'>请删除或重命名安装文件以确保系统安全！</p>
        </div>
    </div>";
    exit;
}
?>

<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多媒体内容管理平台 - 安装向导</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .install-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 500px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            color: #1a1a1a;
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .header p {
            color: #666;
            font-size: 1rem;
        }
        .form-group {
            margin-bottom: 24px;
        }
        .form-section {
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid #eee;
        }
        .form-section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #007aff;
            margin-right: 12px;
            border-radius: 2px;
        }
        label {
            display: block;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
        }
        input[type="text"], input[type="password"], input[type="email"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #fafbfc;
        }
        input:focus {
            outline: none;
            border-color: #007aff;
            background: white;
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
        }
        .install-btn {
            width: 100%;
            background: linear-gradient(135deg, #007aff, #5856d6);
            color: white;
            border: none;
            padding: 16px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
        }
        .install-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 122, 255, 0.3);
        }
        .install-btn:active {
            transform: translateY(0);
        }
        .feature-list {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .feature-list h3 {
            color: #333;
            margin-bottom: 12px;
            font-size: 1rem;
        }
        .feature-list ul {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            padding: 4px 0;
            color: #666;
            font-size: 0.9rem;
        }
        .feature-list li::before {
            content: '✓';
            color: #34c759;
            font-weight: bold;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="install-container">
        <div class="header">
            <h1>🎬 安装向导</h1>
            <p>多媒体内容管理平台</p>
        </div>

        <div class="feature-list">
            <h3>🚀 平台特性</h3>
            <ul>
                <li>支持视频、小说、图片多种内容类型</li>
                <li>完整的用户管理和权限控制系统</li>
                <li>IP/国家黑名单和地理位置识别</li>
                <li>详细的访问和播放日志记录</li>
                <li>直连播放和代理转发双模式</li>
                <li>用户收藏和个人中心功能</li>
            </ul>
        </div>

        <form method="POST">
            <div class="form-section">
                <div class="section-title">数据库配置</div>
                <div class="form-group">
                    <label>数据库主机</label>
                    <input type="text" name="dbhost" value="localhost" required>
                </div>
                <div class="form-group">
                    <label>数据库用户名</label>
                    <input type="text" name="dbuser" required>
                </div>
                <div class="form-group">
                    <label>数据库密码</label>
                    <input type="password" name="dbpass">
                </div>
                <div class="form-group">
                    <label>数据库名</label>
                    <input type="text" name="dbname" required>
                </div>
            </div>

            <div class="form-section">
                <div class="section-title">管理员账号</div>
                <div class="form-group">
                    <label>管理员用户名</label>
                    <input type="text" name="admin_user" required>
                </div>
                <div class="form-group">
                    <label>管理员邮箱</label>
                    <input type="email" name="admin_email" required>
                </div>
                <div class="form-group">
                    <label>管理员密码</label>
                    <input type="password" name="admin_pass" required>
                </div>
                <div class="form-group">
                    <label>确认密码</label>
                    <input type="password" name="admin_pass_confirm" required>
                </div>
            </div>

            <button type="submit" class="install-btn">🚀 开始安装</button>
        </form>
    </div>
</body>
</html>