<?php
session_start();
require '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: login.php');
    exit;
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if (!$username || !$password) {
    $_SESSION['error'] = '用户名和密码不能为空';
    header('Location: login.php');
    exit;
}

try {
    $conn = getDbConnection();
    
    // 查询管理员用户
    $stmt = $conn->prepare("SELECT id, username, email, password FROM users WHERE (username = ? OR email = ?) AND role = 'admin' AND status = 'active'");
    $stmt->bind_param('ss', $username, $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $_SESSION['error'] = '管理员账号不存在或已被禁用';
        header('Location: login.php');
        exit;
    }
    
    $admin = $result->fetch_assoc();
    
    // 验证密码
    if (!password_verify($password, $admin['password'])) {
        $_SESSION['error'] = '密码错误';
        header('Location: login.php');
        exit;
    }
    
    // 登录成功，设置session
    $_SESSION['admin_user'] = [
        'id' => $admin['id'],
        'username' => $admin['username'],
        'email' => $admin['email']
    ];
    
    // 更新最后登录信息
    $stmt = $conn->prepare("UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?");
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $stmt->bind_param('si', $ip, $admin['id']);
    $stmt->execute();
    
    // 记录操作日志
    logOperation($admin['id'], 'admin_login', 'user', $admin['id'], ['ip' => $ip]);
    
    header('Location: index.php');
    exit;
    
} catch (Exception $e) {
    error_log('Admin login error: ' . $e->getMessage());
    $_SESSION['error'] = '登录失败，请稍后重试';
    header('Location: login.php');
    exit;
}

// 记录操作日志
function logOperation($userId, $action, $targetType = '', $targetId = '', $details = []) {
    try {
        $conn = getDbConnection();
        $stmt = $conn->prepare("INSERT INTO operation_logs (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $detailsJson = json_encode($details);
        $stmt->bind_param('isssss', $userId, $action, $targetType, $targetId, $detailsJson, $ip);
        $stmt->execute();
    } catch (Exception $e) {
        error_log('Log operation error: ' . $e->getMessage());
    }
}
?>