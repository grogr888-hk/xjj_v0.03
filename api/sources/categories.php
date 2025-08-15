<?php
require_once '../../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$sourceId = $_GET['source_id'] ?? 0;

if (!$sourceId) {
    echo json_encode(['success' => false, 'message' => '缺少源ID参数']);
    exit;
}

try {
    $conn = getDbConnection();
    
    // 获取源信息
    $stmt = $conn->prepare("SELECT categories, api_url FROM content_sources WHERE id = ? AND status = 'active'");
    $stmt->bind_param('i', $sourceId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => '内容源不存在']);
        exit;
    }
    
    $source = $result->fetch_assoc();
    $categories = [];
    
    // 如果有预设分类，直接返回
    if ($source['categories']) {
        $categoriesData = json_decode($source['categories'], true);
        if (is_array($categoriesData)) {
            $categories = $categoriesData;
        }
    } else {
        // 否则尝试从API获取分类
        $categories = fetchCategoriesFromAPI($source['api_url']);
    }
    
    echo json_encode([
        'success' => true,
        'categories' => $categories
    ]);
    
} catch (Exception $e) {
    error_log('Get categories error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => '获取分类失败'
    ]);
}

// 从API获取分类
function fetchCategoriesFromAPI($apiUrl) {
    try {
        // 构建分类请求URL
        $categoryUrl = str_replace('ac=detail', 'ac=list', $apiUrl);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Mozilla/5.0 (compatible; ContentManager/1.0)'
            ]
        ]);
        
        $response = file_get_contents($categoryUrl, false, $context);
        if ($response === false) {
            return [];
        }
        
        $data = json_decode($response, true);
        if (!$data || !isset($data['class'])) {
            return [];
        }
        
        $categories = [];
        foreach ($data['class'] as $item) {
            $categories[] = [
                'id' => $item['type_id'] ?? '',
                'name' => $item['type_name'] ?? ''
            ];
        }
        
        return $categories;
        
    } catch (Exception $e) {
        error_log('Fetch categories from API error: ' . $e->getMessage());
        return [];
    }
}
?>