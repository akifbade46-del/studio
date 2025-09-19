<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

function json_response($status, $message, $data = null) {
    http_response_code($status);
    $response = ['status' => $message === 'success' ? 'success' : 'error', 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    json_response(405, 'Invalid request method.');
}

$json_data = file_get_contents('php://input');
$request = json_decode($json_data, true);

if (json_last_error() !== JSON_ERROR_NONE || !isset($request['filename']) || !isset($request['status']) || !isset($request['user'])) {
    json_response(400, 'Invalid or missing parameters.');
}

$filename = basename($request['filename']);
$file_path = 'data/' . $filename;

if (!file_exists($file_path)) {
    json_response(404, 'File not found.');
}

$content = file_get_contents($file_path);
$data = json_decode($content, true);

if (!$data) {
    json_response(500, 'Failed to decode file content.');
}

$data['status'] = $request['status'];
$data['lastUpdatedBy'] = $request['user'];
$data['updatedAt'] = date('c'); // ISO 8601 format

switch ($request['status']) {
    case 'checked':
        $data['checkedBy'] = $request['user'];
        $data['checkedAt'] = date('c');
        break;
    case 'approved':
        $data['approvedBy'] = $request['user'];
        $data['approvedAt'] = date('c');
        break;
    case 'rejected':
        $data['rejectedBy'] = $request['user'];
        $data['rejectedAt'] = date('c');
        $data['rejectionReason'] = $request['reason'] ?? 'No reason provided.';
        break;
}

$json_to_save = json_encode($data, JSON_PRETTY_PRINT);

if (file_put_contents($file_path, $json_to_save) !== false) {
    json_response(200, 'success', $data);
} else {
    json_response(500, 'Failed to update file.');
}
?>
