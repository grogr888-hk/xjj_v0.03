<?php
require_once '../../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '只支持POST请求']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['username']) || !isset($input['email']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'message' => '用户名、邮箱和密码不能为空']);
    exit;
}

$username = trim($input['username']);
$email = trim($input['email']);
$password = $input['password'];

// 验证输入
if (strlen($username) < 3 || strlen($username) > 50) {
    echo json_encode(['success' => false, 'message' => '用户名长度必须在3-50个字符之间']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => '邮箱格式不正确']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'message' => '密码长度不能少于6个字符']);
    exit;
}

try {
    $conn = getDbConnection();
    
    // 检查系统是否允许注册
    $stmt = $conn->prepare("SELECT config_value FROM system_config WHERE config_key = 'enable_registration'");
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        $config = $result->fetch_assoc();
        if ($config['config_value'] !== 'true') {
            echo json_encode(['success' => false, 'message' => '系统暂时关闭注册功能']);
            exit;
        }
    }
    
    // 检查用户名是否已存在
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param('s', $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => '用户名已存在']);
        exit;
    }
    
    // 检查邮箱是否已存在
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => '邮箱已被注册']);
        exit;
    }
    
    // 创建用户
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, 'user', 'active')");
    $stmt->bind_param('sss', $username, $email, $hashedPassword);
    
    if ($stmt->execute()) {
        $userId = $conn->insert_id;
        
        // 记录操作日志
        logOperation($userId, 'user_register', 'user', $userId, [
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => '注册成功',
            'user_id' => $userId
        ]);
    } else {
        throw new Exception('创建用户失败');
    }
    
} catch (Exception $e) {
    error_log('Register error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '注册失败，请稍后重试']);
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