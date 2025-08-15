<?php
session_start();

// 记录登出日志
if (isset($_SESSION['admin_user'])) {
    require '../config.php';
    
    try {
        $conn = getDbConnection();
        $stmt = $conn->prepare("INSERT INTO operation_logs (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
        $userId = $_SESSION['admin_user']['id'];
        $action = 'admin_logout';
        $targetType = 'user';
        $targetId = $userId;
        $details = json_encode(['ip' => $_SERVER['REMOTE_ADDR'] ?? '']);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt->bind_param('isssss', $userId, $action, $targetType, $targetId, $details, $ip);
        $stmt->execute();
    } catch (Exception $e) {
        error_log('Logout log error: ' . $e->getMessage());
    }
}

// 清除session
session_destroy();

// 重定向到登录页
header('Location: login.php');
exit;
?>