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
$source_path = 'recycle_bin/' . $filename;
$destination_path = 'data/' . $filename;

if (!file_exists($source_path)) {
    json_response(404, 'File not found in recycle bin.');
}

// Remove deletion info from file before restoring
$content = file_get_contents($source_path);
$data = json_decode($content, true);
if ($data) {
    unset($data['deletedAt']);
    unset($data['deletedBy']);
    unset($data['isDeleted']);
    file_put_contents($source_path, json_encode($data, JSON_PRETTY_PRINT));
}

if (rename($source_path, $destination_path)) {
    json_response(200, 'success');
} else {
    json_response(500, 'Failed to restore file.');
}
?>
