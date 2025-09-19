<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

function json_response($status, $message) {
    http_response_code($status);
    echo json_encode(['status' => $message === 'success' ? 'success' : 'error', 'message' => $message]);
    exit();
}

if (!isset($_GET['file'])) {
    json_response(400, 'File parameter is missing.');
}

$filename = basename($_GET['file']);
$is_permanent_delete = isset($_GET['permanent']) && $_GET['permanent'] === '1';

if ($is_permanent_delete) {
    $source_path = 'recycle_bin/' . $filename;
    if (file_exists($source_path)) {
        if (unlink($source_path)) {
            json_response(200, 'success');
        } else {
            json_response(500, 'Failed to permanently delete file.');
        }
    } else {
        json_response(404, 'File not found in recycle bin.');
    }
} else {
    $source_path = 'data/' . $filename;
    $recycle_bin_dir = 'recycle_bin/';

    if (!file_exists($source_path)) {
        json_response(404, 'File not found in data directory.');
    }

    if (!is_dir($recycle_bin_dir)) {
        if (!mkdir($recycle_bin_dir, 0755, true)) {
            json_response(500, 'Failed to create recycle bin directory.');
        }
    }
    
    // Add deletion info to file before moving
    $content = file_get_contents($source_path);
    $data = json_decode($content, true);
    if ($data) {
        $data['deletedAt'] = date('c'); // ISO 8601
        $data['deletedBy'] = $_GET['user'] ?? 'Unknown'; // You should pass the user for logging
        $data['isDeleted'] = true;
        file_put_contents($source_path, json_encode($data, JSON_PRETTY_PRINT));
    }


    $destination_path = $recycle_bin_dir . $filename;

    if (rename($source_path, $destination_path)) {
        json_response(200, 'success');
    } else {
        json_response(500, 'Failed to move file to recycle bin.');
    }
}
?>
