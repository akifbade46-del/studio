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

$backup_file = '../BACKUP/qgo-cargo-full-backup.json';
$data_dir = 'data/';

if (!file_exists($backup_file)) {
    json_response(404, 'Backup file not found. Please upload `qgo-cargo-full-backup.json` to the `BACKUP/` directory.');
}

if (!is_dir($data_dir)) {
    if (!mkdir($data_dir, 0755, true)) {
        json_response(500, 'Failed to create data directory. Please check permissions.');
    }
}

$backup_content = file_get_contents($backup_file);
$backup_data = json_decode($backup_content, true);

if (json_last_error() !== JSON_ERROR_NONE || !isset($backup_data['data']['jobfiles'])) {
    json_response(500, 'Invalid backup file format. Expected a `data.jobfiles` array.');
}

$jobfiles = $backup_data['data']['jobfiles'];
$count = 0;
$errors = [];

foreach ($jobfiles as $jobfile) {
    if (!isset($jobfile['id'])) {
        $errors[] = "A jobfile record is missing an 'id'.";
        continue;
    }
    
    // The ID from firebase might contain characters not suitable for filenames, although yours seem fine.
    // Let's stick to your current naming convention: replace '/' with '_'
    $filename = str_replace('/', '_', $jobfile['id']) . '.json';
    $file_path = $data_dir . $filename;
    
    // Add the original firebase ID to the data if it's different from the cleaned one
    $jobfile['firebase_id'] = $jobfile['id'];

    if (file_put_contents($file_path, json_encode($jobfile, JSON_PRETTY_PRINT))) {
        $count++;
    } else {
        $errors[] = "Failed to write file for job ID: " . $jobfile['id'];
    }
}

if (count($errors) > 0) {
    json_response(500, "Restore completed with errors. Restored {$count} files.", ['errors' => $errors]);
} else {
    json_response(200, 'success', "Successfully restored {$count} job files from backup.");
}

?>
    