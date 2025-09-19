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

// Determine which directories to scan based on the request
$directories_to_scan = [];
if ($show_deleted) {
    if (is_dir('recycle_bin/')) $directories_to_scan[] = 'recycle_bin/*.json';
} else {
    if (is_dir('data/')) $directories_to_scan[] = 'data/*.json';
}

$all_file_paths = [];
foreach ($directories_to_scan as $pattern) {
    $found_files = glob($pattern);
    if ($found_files) {
        $all_file_paths = array_merge($all_file_paths, $found_files);
    }
}

$file_data = [];

foreach ($all_file_paths as $file) {
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    
    // Skip if JSON is invalid
    if (!$data) {
        continue;
    }

    // Determine the modification date reliably
    $updatedTimestamp = filemtime($file);
    $updatedAtISO = date('c', $updatedTimestamp); // ISO 8601 format (e.g., 2004-02-12T15:19:21+00:00)

    if ($is_full_data_request) {
        // For full requests, ensure date fields exist and are formatted, but send the whole object
        $data['updatedAt'] = $updatedAtISO;
        $data['createdAt'] = $data['createdAt'] ?? $updatedAtISO;
        $file_data[] = $data;
    } else {
        // For list requests, only send essential data
        $file_info = [
            'jfn' => $data['jfn'] ?? basename($file, '.json'),
            'sh' => $data['sh'] ?? 'N/A',
            'co' => $data['co'] ?? 'N/A',
            'mawb' => $data['mawb'] ?? 'N/A',
            'd' => $data['d'] ?? null,
            'status' => $data['status'] ?? 'pending',
            'updatedAt' => $updatedAtISO, // Always use the reliable, formatted date
            'deletedAt' => $data['deletedAt'] ?? null,
            'deletedBy' => $data['deletedBy'] ?? null,
            'isDeleted' => $show_deleted,
        ];
        $file_data[] = $file_info;
    }
}

// Sort all data by the updatedAt date, descending
usort($file_data, function($a, $b) {
    // Both will have 'updatedAt' as a string, so direct comparison works
    return strcmp($b['updatedAt'], $a['updatedAt']);
});


json_response(200, 'success', $file_data);
?>
