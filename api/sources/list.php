<?php
require_once '../../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $conn = getDbConnection();
    
    $type = $_GET['type'] ?? '';
    
    $sql = "SELECT id, name, type, api_url, parse_url, status, priority FROM content_sources WHERE status = 'active'";
    $params = [];
    $types = '';
    
    if ($type) {
        $sql .= " AND type = ?";
        $params[] = $type;
        $types .= 's';
    }
    
    $sql .= " ORDER BY priority DESC, id ASC";
    
    $stmt = $conn->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $sources = [];
    while ($row = $result->fetch_assoc()) {
        // 解析分类数据
        $categories = [];
        if ($row['categories']) {
            $categoriesData = json_decode($row['categories'], true);
            if (is_array($categoriesData)) {
                $categories = $categoriesData;
            }
        }
        
        $sources[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'api_url' => $row['api_url'],
            'parse_url' => $row['parse_url'],
            'categories' => $categories
        ];
    }
    
    echo json_encode([
        'success' => true,
        'sources' => $sources
    ]);
    
} catch (Exception $e) {
    error_log('List sources error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => '获取内容源失败'
    ]);
}
?>