
<?php
header('Content-Type: application/json');
require 'github_config.php';

// Function to send requests to GitHub API
function github_api_request($url, $method = 'GET', $data = null, $extra_headers = []) {
    $ch = curl_init();
    $headers = [
        'Authorization: token ' . GITHUB_TOKEN,
        'Accept: application/vnd.github.v3+json',
        'User-Agent: ' . GITHUB_USER
    ];
    $headers = array_merge($headers, $extra_headers);

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['code' => $http_code, 'body' => json_decode($response, true)];
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['fileId']) || !isset($input['content'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$fileId = str_replace('/', '_', $input['fileId']);
$content = $input['content'];
$isUpdating = isset($input['isUpdating']) && $input['isUpdating'];

$filePath = DATA_PATH . $fileId . '.json';
$apiUrl = 'https://api.github.com/repos/' . GITHUB_USER . '/' . GITHUB_REPO . '/contents/' . $filePath;

// Add/update timestamps
$content['updatedAt'] = date('c'); // ISO 8601 format
if (!$isUpdating) {
    $content['createdAt'] = date('c');
}

$message = ($isUpdating ? 'Update' : 'Create') . ' job file: ' . $fileId;
$content_json = json_encode($content, JSON_PRETTY_PRINT);
$content_base64 = base64_encode($content_json);

$payload = [
    'message' => $message,
    'content' => $content_base64,
    'branch' => GITHUB_BRANCH
];

// If updating, we need the SHA of the existing file
if ($isUpdating) {
    $response = github_api_request($apiUrl);
    if ($response['code'] == 200 && isset($response['body']['sha'])) {
        $payload['sha'] = $response['body']['sha'];
    } elseif ($response['code'] != 404) {
        // If it's not a 404 (not found), then it's some other error
        http_response_code($response['code']);
        echo json_encode(['error' => 'Could not get existing file SHA', 'details' => $response['body']]);
        exit;
    }
}

// Create or update the file
$response = github_api_request($apiUrl, 'PUT', $payload);

if ($response['code'] == 200 || $response['code'] == 201) {
    echo json_encode(['success' => true, 'message' => 'File saved successfully.']);
} else {
    http_response_code($response['code']);
    echo json_encode(['error' => 'Failed to save file to GitHub', 'details' => $response['body']]);
}
?>

    