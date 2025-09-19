<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

function json_response($status, $message, $data = null) {
    http_response_code($status);
    $response = ['status' => $message === 'success' ? 'success' : 'error', 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit();
}

if (!isset($_GET['file'])) {
    json_response(400, 'File parameter is missing.');
}

$filename = basename($_GET['file']);
$file_path = 'data/' . $filename;

if (file_exists($file_path)) {
    $content = file_get_contents($file_path);
    $data = json_decode($content, true);
    if ($data) {
        json_response(200, 'success', $data);
    } else {
        json_response(500, 'Failed to decode JSON from file.');
    }
} else {
    json_response(404, 'File not found.');
}
?>
