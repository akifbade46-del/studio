<?php
// Simple CORS handling
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Set content type to JSON
header('Content-Type: application/json');

// Define the directory path for surveys
$surveys_dir = '../surveys/';
$surveys = [];

// Check if the directory exists
if (!is_dir($surveys_dir)) {
    // If the directory doesn't exist, it means no surveys are saved yet.
    // Return an empty list.
    echo json_encode(['status' => 'success', 'surveys' => []]);
    exit;
}

// Open the directory and read its contents
if ($handle = opendir($surveys_dir)) {
    while (false !== ($entry = readdir($handle))) {
        // Look for .json files
        if (pathinfo($entry, PATHINFO_EXTENSION) === 'json') {
            $file_path = $surveys_dir . $entry;
            $content = file_get_contents($file_path);
            $data = json_decode($content, true);
            
            // Add to the list if JSON is valid
            if (json_last_error() === JSON_ERROR_NONE) {
                $surveys[] = $data;
            }
        }
    }
    closedir($handle);
} else {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not open surveys directory.']);
    exit;
}

// Respond with the list of surveys
echo json_encode(['status' => 'success', 'surveys' => $surveys]);
?>
