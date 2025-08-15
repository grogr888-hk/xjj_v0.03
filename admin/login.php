<?php
session_start();
if (isset($_SESSION['admin_user'])) {
    header('Location: index.php');
    exit;
}

$error = $_SESSION['error'] ?? '';
unset($_SESSION['error']);
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台登录</title>
    <link rel="stylesheet" href="assets/css/admin.css">
</head>
<body class="login-page">
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1>🎬 管理后台</h1>
                <p>多媒体内容管理平台</p>
            </div>
            
            <?php if ($error): ?>
                <div class="alert alert-error">
                    <span class="icon">⚠️</span>
                    <?= htmlspecialchars($error) ?>
                </div>
            <?php endif; ?>
            
            <form method="POST" action="login_check.php" class="login-form">
                <div class="form-group">
                    <label class="form-label">用户名或邮箱</label>
                    <input type="text" name="username" class="form-input" required autofocus>
                </div>
                
                <div class="form-group">
                    <label class="form-label">密码</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="remember">
                        <span class="checkmark"></span>
                        记住我
                    </label>
                </div>
                
                <button type="submit" class="btn btn-primary btn-large">
                    <span class="icon">🔑</span>
                    登录
                </button>
            </form>
            
            <div class="login-footer">
                <p>© 2025 多媒体内容管理平台</p>
            </div>
        </div>
    </div>
</body>
</html>