<?php
// Simple CORS handling
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Set content type to JSON
header('Content-Type: application/json');

// Check if the request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

// Get the JSON data from the request body
$json_data = file_get_contents('php://input');
$survey_data = json_decode($json_data, true);

// Basic validation
if (json_last_error() !== JSON_ERROR_NONE || !is_array($survey_data) || !isset($survey_data['id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON data provided.']);
    exit;
}

// Define the directory path for surveys (relative to this script)
$surveys_dir = '../surveys/';

// Create the directory if it doesn't exist
if (!is_dir($surveys_dir)) {
    if (!mkdir($surveys_dir, 0775, true)) {
        http_response_code(500); // Internal Server Error
        echo json_encode(['status' => 'error', 'message' => 'Failed to create surveys directory. Check permissions.']);
        exit;
    }
}

// Sanitize the survey ID to prevent directory traversal attacks
$survey_id = basename($survey_data['id']);
$file_path = $surveys_dir . $survey_id . '.json';

// Save the JSON data to a file
if (file_put_contents($file_path, $json_data) === false) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Failed to save survey data. Check directory permissions.']);
    exit;
}

// Respond with success
http_response_code(200); // OK
echo json_encode(['status' => 'success', 'message' => 'Survey saved successfully.', 'file' => $survey_id . '.json']);
?>
