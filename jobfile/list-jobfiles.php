<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

function json_response($status, $message, $data = null) {
    http_response_code($status);
    $response = ['status' => $message === 'success' ? 'success' : 'error', 'message' => $message];
    if ($data !== null) {
        $response['files'] = $data;
    }
    echo json_encode($response);
    exit();
}

$directory = 'data/';

if (!is_dir($directory)) {
    json_response(200, 'success', []); // Return empty array if directory doesn't exist
}

$files = glob($directory . '*.json');
$file_data = [];

foreach ($files as $file) {
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if ($data) {
        // Only get necessary fields for list view to keep payload small
        $file_data[] = [
            'jfn' => $data['jfn'] ?? basename($file, '.json'),
            'sh' => $data['sh'] ?? 'N/A',
            'co' => $data['co'] ?? 'N/A',
            'mawb' => $data['mawb'] ?? 'N/A',
            'd' => $data['d'] ?? null,
            'status' => $data['status'] ?? 'pending',
            'updatedAt' => $data['updatedAt'] ?? null,
        ];
    }
}

json_response(200, 'success', $file_data);
?>
