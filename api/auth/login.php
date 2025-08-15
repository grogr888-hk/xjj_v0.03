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

if (!$input || !isset($input['username']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'message' => '用户名和密码不能为空']);
    exit;
}

$username = trim($input['username']);
$password = $input['password'];

try {
    $conn = getDbConnection();
    
    // 查询用户
    $stmt = $conn->prepare("SELECT id, username, email, password, role, status, avatar FROM users WHERE (username = ? OR email = ?) AND status = 'active'");
    $stmt->bind_param('ss', $username, $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => '用户不存在或已被禁用']);
        exit;
    }
    
    $user = $result->fetch_assoc();
    
    // 验证密码
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => '密码错误']);
        exit;
    }
    
    // 生成JWT token
    $payload = [
        'user_id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + (isset($input['remember']) && $input['remember'] ? 30 * 24 * 3600 : 24 * 3600) // 记住我30天，否则1天
    ];
    
    $token = generateJWT($payload);
    
    // 更新最后登录信息
    $stmt = $conn->prepare("UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?");
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $stmt->bind_param('si', $ip, $user['id']);
    $stmt->execute();
    
    // 记录操作日志
    logOperation($user['id'], 'user_login', 'user', $user['id'], ['ip' => $ip]);
    
    // 返回用户信息（不包含密码）
    unset($user['password']);
    
    echo json_encode([
        'success' => true,
        'message' => '登录成功',
        'user' => $user,
        'token' => $token
    ]);
    
} catch (Exception $e) {
    error_log('Login error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '登录失败，请稍后重试']);
}

// 生成JWT token
function generateJWT($payload) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode($payload);
    
    $headerEncoded = base64url_encode($header);
    $payloadEncoded = base64url_encode($payload);
    
    $signature = hash_hmac('sha256', $headerEncoded . "." . $payloadEncoded, 'your-secret-key', true);
    $signatureEncoded = base64url_encode($signature);
    
    return $headerEncoded . "." . $payloadEncoded . "." . $signatureEncoded;
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
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