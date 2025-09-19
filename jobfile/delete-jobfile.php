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
$source_path = 'data/' . $filename;
$recycle_bin_dir = 'recycle_bin/';

if (!file_exists($source_path)) {
    json_response(404, 'File not found.');
}

if (!is_dir($recycle_bin_dir)) {
    if (!mkdir($recycle_bin_dir, 0755, true)) {
        json_response(500, 'Failed to create recycle bin directory.');
    }
}

$destination_path = $recycle_bin_dir . $filename;

if (rename($source_path, $destination_path)) {
    json_response(200, 'success');
} else {
    json_response(500, 'Failed to move file to recycle bin.');
}
?>
