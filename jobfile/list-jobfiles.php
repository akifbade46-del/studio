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
$show_all = isset($_GET['all']);

$directories_to_scan = [];
if ($show_all) {
    if (is_dir('data/')) $directories_to_scan[] = 'data/*.json';
    if (is_dir('recycle_bin/')) $directories_to_scan[] = 'recycle_bin/*.json';
} elseif ($show_deleted) {
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
    if (!$data) {
        continue;
    }

    $updatedTimestamp = null;
    if (isset($data['updatedAt']) && !empty($data['updatedAt'])) {
        $updatedTimestamp = strtotime($data['updatedAt']);
    }
    if ($updatedTimestamp === false || $updatedTimestamp === null) {
        if (isset($data['createdAt']) && !empty($data['createdAt'])) {
            $updatedTimestamp = strtotime($data['createdAt']);
        }
    }
    if ($updatedTimestamp === false || $updatedTimestamp === null) {
         $updatedTimestamp = filemtime($file);
    }
    
    $updatedAtISO = date('c', $updatedTimestamp);

    if ($is_full_data_request) {
        $data['updatedAt'] = $updatedAtISO;
        $file_data[] = $data;
    } else {
        $file_data[] = [
            'jfn' => $data['jfn'] ?? basename($file, '.json'),
            'sh' => $data['sh'] ?? 'N/A',
            'co' => $data['co'] ?? 'N/A',
            'mawb' => $data['mawb'] ?? 'N/A',
            'd' => $data['d'] ?? null,
            'status' => $data['status'] ?? 'pending',
            'updatedAt' => $updatedAtISO,
            'deletedAt' => $data['deletedAt'] ?? null,
            'deletedBy' => $data['deletedBy'] ?? null,
            'isDeleted' => $show_deleted || strpos($file, 'recycle_bin/') !== false,
        ];
    }
}

json_response(200, 'success', $file_data);
?>