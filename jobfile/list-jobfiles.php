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

$is_full_data_request = isset($_GET['full']);
$show_deleted = isset($_GET['deleted']);
$show_all = isset($_GET['all']); // To get both deleted and non-deleted for backup

$directory = $show_deleted ? 'recycle_bin/' : 'data/';
$files = [];

if ($show_all) {
    $data_files = glob('data/*.json');
    $recycle_files = glob('recycle_bin/*.json');
    $files = array_merge($data_files, $recycle_files);
} else {
    $files = glob($directory . '*.json');
}

$file_data = [];

foreach ($files as $file) {
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if ($data) {
        if ($is_full_data_request) {
            $file_data[] = $data;
        } else {
            // Only get necessary fields for list view to keep payload small
            $file_data[] = [
                'jfn' => $data['jfn'] ?? basename($file, '.json'),
                'sh' => $data['sh'] ?? 'N/A',
                'co' => $data['co'] ?? 'N/A',
                'mawb' => $data['mawb'] ?? 'N/A',
                'd' => $data['d'] ?? null,
                'status' => $data['status'] ?? 'pending',
                'updatedAt' => $data['updatedAt'] ?? null,
                'deletedAt' => $data['deletedAt'] ?? null,
                'deletedBy' => $data['deletedBy'] ?? null,
                'isDeleted' => $show_deleted,
            ];
        }
    }
}

json_response(200, 'success', $file_data);
?>
