<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

function json_response($status, $message, $data = null) {
    http_response_code($status);
    $response = ['status' => $message === 'success' ? 'success' : 'error', 'message' => $message];
    if ($data !== null) {
        if ($message === 'success') {
            $response['files'] = $data;
        } else {
            $response['details'] = $data;
        }
    }
    echo json_encode($response);
    exit();
}

$is_full_data_request = isset($_GET['full']);
$show_deleted = isset($_GET['deleted']);

$directories_to_scan = [];
if ($show_deleted) {
    if (is_dir('recycle_bin/')) $directories_to_scan[] = 'recycle_bin';
} else {
    if (is_dir('data/')) $directories_to_scan[] = 'data';
}

if (empty($directories_to_scan)) {
    json_response(200, 'success', []);
}

$file_data = [];

foreach ($directories_to_scan as $dir) {
    $found_files = glob($dir . '/*.json');
    if ($found_files === false) continue;

    foreach ($found_files as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        if (!$data || !isset($data['jfn'])) continue;

        // Use ISO 8601 format (date('c')) which JS's new Date() understands reliably
        $updatedTimestamp = filemtime($file);
        $updatedAtISO = date('c', $updatedTimestamp);

        // Fallback for createdAt if it doesn't exist in the file
        if (isset($data['createdAt']) && is_array($data['createdAt']) && isset($data['createdAt']['seconds'])) {
             $createdAtISO = date('c', $data['createdAt']['seconds']);
        } else if (isset($data['createdAt'])) {
            $createdAtTimestamp = strtotime($data['createdAt']);
            $createdAtISO = $createdAtTimestamp ? date('c', $createdAtTimestamp) : $updatedAtISO;
        } else {
            $createdAtISO = $updatedAtISO;
        }


        if ($is_full_data_request) {
            $data['id'] = basename($file, '.json');
            $data['updatedAt'] = $updatedAtISO;
            $data['createdAt'] = $createdAtISO;
            $file_data[] = $data;
        } else {
            $file_info = [
                'id' => basename($file, '.json'),
                'jfn' => $data['jfn'],
                'sh' => $data['sh'] ?? 'N/A',
                'co' => $data['co'] ?? 'N/A',
                'status' => $data['status'] ?? 'pending',
                'updatedAt' => $updatedAtISO,
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
