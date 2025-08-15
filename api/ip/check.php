<?php
require_once '../../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $conn = getDbConnection();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    
    // 检查系统是否启用IP检查
    $stmt = $conn->prepare("SELECT config_value FROM system_config WHERE config_key = 'enable_ip_check'");
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $config = $result->fetch_assoc();
        if ($config['config_value'] !== 'true') {
            echo json_encode(['allowed' => true]);
            exit;
        }
    }
    
    // 检查IP黑名单
    $isBlocked = false;
    $reason = '';
    
    // 检查精确IP
    $stmt = $conn->prepare("SELECT reason FROM ip_blacklist WHERE ip_address = ? AND type = 'ip'");
    $stmt->bind_param('s', $ip);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $isBlocked = true;
        $reason = $row['reason'] ?: 'IP地址已被封禁';
    }
    
    // 检查IP段
    if (!$isBlocked) {
        $stmt = $conn->prepare("SELECT reason, ip_range FROM ip_blacklist WHERE type = 'range'");
        $stmt->execute();
        $result = $stmt->get_result();
        
        while ($row = $result->fetch_assoc()) {
            if (ipInRange($ip, $row['ip_range'])) {
                $isBlocked = true;
                $reason = $row['reason'] ?: 'IP段已被封禁';
                break;
            }
        }
    }
    
    // 检查国家/地区
    if (!$isBlocked) {
        $country = getCountryByIP($ip);
        if ($country) {
            $stmt = $conn->prepare("SELECT reason FROM ip_blacklist WHERE country = ? AND type = 'country'");
            $stmt->bind_param('s', $country);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $isBlocked = true;
                $reason = $row['reason'] ?: '该地区已被限制访问';
            }
        }
    }
    
    echo json_encode([
        'allowed' => !$isBlocked,
        'reason' => $reason,
        'ip' => $ip
    ]);
    
} catch (Exception $e) {
    error_log('IP check error: ' . $e->getMessage());
    // 出错时默认允许访问
    echo json_encode(['allowed' => true]);
}

// 检查IP是否在指定范围内
function ipInRange($ip, $range) {
    if (strpos($range, '/') !== false) {
        // CIDR格式
        list($subnet, $mask) = explode('/', $range);
        $ip_long = ip2long($ip);
        $subnet_long = ip2long($subnet);
        $mask_long = -1 << (32 - $mask);
        return ($ip_long & $mask_long) === ($subnet_long & $mask_long);
    } else if (strpos($range, '-') !== false) {
        // 范围格式
        list($start, $end) = explode('-', $range);
        $ip_long = ip2long($ip);
        return $ip_long >= ip2long(trim($start)) && $ip_long <= ip2long(trim($end));
    }
    return false;
}

// 根据IP获取国家
function getCountryByIP($ip) {
    try {
        // 使用免费的IP地理位置API
        $url = "http://ip-api.com/json/{$ip}?fields=country";
        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
                'user_agent' => 'Mozilla/5.0 (compatible; ContentManager/1.0)'
            ]
        ]);
        
        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            return null;
        }
        
        $data = json_decode($response, true);
        return $data['country'] ?? null;
        
    } catch (Exception $e) {
        error_log('Get country by IP error: ' . $e->getMessage());
        return null;
    }
}
?>