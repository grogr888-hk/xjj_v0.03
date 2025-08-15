<?php
require_once '../../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$sourceId = $_GET['source_id'] ?? 0;
$category = $_GET['category'] ?? '';

if (!$sourceId) {
    echo json_encode(['success' => false, 'message' => '缺少源ID参数']);
    exit;
}

try {
    $conn = getDbConnection();
    
    // 获取源信息
    $stmt = $conn->prepare("SELECT api_url, type FROM content_sources WHERE id = ? AND status = 'active'");
    $stmt->bind_param('i', $sourceId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => '内容源不存在']);
        exit;
    }
    
    $source = $result->fetch_assoc();
    
    // 获取随机内容
    $content = getRandomContent($sourceId, $source['api_url'], $category);
    
    if ($content) {
        echo json_encode([
            'success' => true,
            'content' => $content
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => '获取内容失败'
        ]);
    }
    
} catch (Exception $e) {
    error_log('Get random content error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => '获取内容失败'
    ]);
}

// 获取随机内容
function getRandomContent($sourceId, $apiUrl, $category = '') {
    try {
        $conn = getDbConnection();
        
        // 首先尝试获取总数
        $totalUrl = $apiUrl . '&page=1&limit=1';
        if ($category) {
            $totalUrl .= '&t=' . urlencode($category);
        }
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Mozilla/5.0 (compatible; ContentManager/1.0)'
            ]
        ]);
        
        $response = file_get_contents($totalUrl, false, $context);
        if ($response === false) {
            throw new Exception('API请求失败');
        }
        
        $data = json_decode($response, true);
        if (!$data || $data['code'] != 1) {
            throw new Exception('API返回错误');
        }
        
        $total = $data['total'] ?? 1000;
        $maxAttempts = 20; // 最大尝试次数
        
        for ($i = 0; $i < $maxAttempts; $i++) {
            // 生成随机ID
            $randomId = rand(1, min($total, 100000));
            
            // 检查是否为无效ID
            if (isInvalidContent($sourceId, $randomId)) {
                continue;
            }
            
            // 请求具体内容
            $contentUrl = $apiUrl . '&ids=' . $randomId;
            $response = file_get_contents($contentUrl, false, $context);
            
            if ($response === false) {
                continue;
            }
            
            $contentData = json_decode($response, true);
            if (!$contentData || $contentData['code'] != 1 || empty($contentData['list'])) {
                // 记录无效ID
                addInvalidContent($sourceId, $randomId, '内容不存在');
                continue;
            }
            
            $content = $contentData['list'][0];
            
            // 验证内容完整性
            if (empty($content['vod_name']) || empty($content['vod_play_url'])) {
                addInvalidContent($sourceId, $randomId, '内容不完整');
                continue;
            }
            
            return $content;
        }
        
        throw new Exception('多次尝试后仍无法获取有效内容');
        
    } catch (Exception $e) {
        error_log('Get random content error: ' . $e->getMessage());
        return null;
    }
}

// 检查是否为无效内容
function isInvalidContent($sourceId, $contentId) {
    try {
        $conn = getDbConnection();
        $stmt = $conn->prepare("SELECT id FROM invalid_content_ids WHERE source_id = ? AND content_id = ?");
        $stmt->bind_param('is', $sourceId, $contentId);
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    } catch (Exception $e) {
        return false;
    }
}

// 添加无效内容记录
function addInvalidContent($sourceId, $contentId, $reason = '') {
    try {
        $conn = getDbConnection();
        $stmt = $conn->prepare("INSERT IGNORE INTO invalid_content_ids (source_id, content_id, reason) VALUES (?, ?, ?)");
        $stmt->bind_param('iss', $sourceId, $contentId, $reason);
        $stmt->execute();
    } catch (Exception $e) {
        error_log('Add invalid content error: ' . $e->getMessage());
    }
}
?>