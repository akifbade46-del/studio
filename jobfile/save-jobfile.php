<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Function to send JSON response
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
$request_data = json_decode($json_data, true);

if (json_last_error() !== JSON_ERROR_NONE || !isset($request_data['filename']) || !isset($request_data['data'])) {
    json_response(400, 'Invalid or missing JSON data.');
}

$filename = basename($request_data['filename']);
if (empty($filename) || strpos($filename, '.json') === false) {
    json_response(400, 'Filename is invalid or empty.');
}

$directory = 'data/';
if (!is_dir($directory)) {
    if (!mkdir($directory, 0755, true)) {
        json_response(500, 'Failed to create data directory.');
    }
}

$file_path = $directory . $filename;

// Check for duplicates before saving (for new files)
$is_updating = file_exists($file_path);
if (!$is_updating) {
    $all_files = glob($directory . '*.json');
    $new_data = $request_data['data'];
    foreach ($all_files as $file) {
        $content = file_get_contents($file);
        $existing_data = json_decode($content, true);
        if (
            (isset($new_data['in']) && !empty($new_data['in']) && $existing_data['in'] === $new_data['in']) ||
            (isset($new_data['mawb']) && !empty($new_data['mawb']) && $existing_data['mawb'] === $new_data['mawb'])
        ) {
            json_response(409, 'Duplicate Invoice No. or MAWB No. found in file: ' . $existing_data['jfn']);
        }
    }
}


$json_to_save = json_encode($request_data['data'], JSON_PRETTY_PRINT);

if (file_put_contents($file_path, $json_to_save) !== false) {
    json_response(200, 'success', $request_data['data']);
} else {
    json_response(500, 'Failed to write file to server. Check directory permissions.');
}
?>
