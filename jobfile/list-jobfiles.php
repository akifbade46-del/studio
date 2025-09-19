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

$directories_to_scan = [];
if ($show_deleted) {
    if (is_dir('recycle_bin/')) $directories_to_scan[] = 'recycle_bin/*.json';
} else {
    if (is_dir('data/')) $directories_to_scan[] = 'data/*.json';
}

$file_data = [];

foreach ($directories_to_scan as $pattern) {
    $found_files = glob($pattern);
    if ($found_files === false) continue;

    foreach ($found_files as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        if (!$data || !isset($data['jfn'])) continue;

        // Use ISO 8601 format for dates which JS understands reliably
        $updatedTimestamp = filemtime($file);
        $updatedAtISO = date('c', $updatedTimestamp);

        if ($is_full_data_request) {
            $data['updatedAt'] = $updatedAtISO;
            $data['createdAt'] = $data['createdAt'] ?? $updatedAtISO;
            $file_data[] = $data;
        } else {
            $file_info = [
                'jfn' => $data['jfn'],
                'sh' => $data['sh'] ?? 'N/A',
                'co' => $data['co'] ?? 'N/A',
                'mawb' => $data['mawb'] ?? 'N/A',
                'd' => $data['d'] ?? null,
                'status' => $data['status'] ?? 'pending',
                'updatedAt' => $updatedAtISO,
                'deletedAt' => $data['deletedAt'] ?? null,
                'deletedBy' => $data['deletedBy'] ?? null,
                'isDeleted' => $show_deleted,
            ];
            $file_data[] = $file_info;
        }
    }
}

// Sort all data by the updatedAt date (string comparison works for ISO 8601), descending
usort($file_data, function($a, $b) {
    $dateA = $a['updatedAt'] ?? '1970-01-01T00:00:00+00:00';
    $dateB = $b['updatedAt'] ?? '1970-01-01T00:00:00+00:00';
    return strcmp($dateB, $dateA);
});

json_response(200, 'success', $file_data);
?>
