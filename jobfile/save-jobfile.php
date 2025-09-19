<?php
// Set headers to allow cross-origin requests (for development) and define content type
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check if it's a POST request
if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit();
}

// Get the raw POST data
$json_data = file_get_contents('php://input');

// Decode the JSON data
$request_data = json_decode($json_data, true);

// Check if JSON decoding was successful and data exists
if (json_last_error() !== JSON_ERROR_NONE || !isset($request_data['filename']) || !isset($request_data['data'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['status' => 'error', 'message' => 'Invalid or missing JSON data.']);
    exit();
}

// Sanitize filename to prevent directory traversal attacks
$filename = basename($request_data['filename']);
if (empty($filename)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Filename is invalid or empty.']);
    exit();
}

// Define the directory to save files. Make sure this directory exists and is writable.
$directory = 'data/';

// Create the directory if it doesn't exist
if (!is_dir($directory)) {
    if (!mkdir($directory, 0755, true)) {
        http_response_code(500); // Internal Server Error
        echo json_encode(['status' => 'error', 'message' => 'Failed to create data directory.']);
        exit();
    }
}

// Construct the full file path
$file_path = $directory . $filename;

// Convert the job file data back to a nicely formatted JSON string
$json_to_save = json_encode($request_data['data'], JSON_PRETTY_PRINT);

// Write the data to the file
if (file_put_contents($file_path, $json_to_save) !== false) {
    http_response_code(200); // OK
    echo json_encode(['status' => 'success', 'message' => 'File saved successfully.', 'path' => $file_path]);
} else {
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Failed to write file to server. Check directory permissions.']);
}
?>

    