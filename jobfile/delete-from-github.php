
<?php
header('Content-Type: application/json');
require 'github_config.php';

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

if (!$input || !isset($input['fileId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$fileId = str_replace('/', '_', $input['fileId']);
$filePath = DATA_PATH . $fileId . '.json';
$apiUrl = 'https://api.github.com/repos/' . GITHUB_USER . '/' . GITHUB_REPO . '/contents/' . $filePath;

// First, get the SHA of the file to be deleted
$getResponse = github_api_request($apiUrl);
if ($getResponse['code'] != 200 || !isset($getResponse['body']['sha'])) {
    http_response_code($getResponse['code']);
    echo json_encode(['error' => 'Could not find the file to delete on GitHub.', 'details' => $getResponse['body']]);
    exit;
}

$payload = [
    'message' => 'Delete job file: ' . $fileId,
    'sha' => $getResponse['body']['sha'],
    'branch' => GITHUB_BRANCH
];

// Send DELETE request
$deleteResponse = github_api_request($apiUrl, 'DELETE', $payload);

if ($deleteResponse['code'] == 200) {
    echo json_encode(['success' => true, 'message' => 'File deleted successfully from GitHub.']);
} else {
    http_response_code($deleteResponse['code']);
    echo json_encode(['error' => 'Failed to delete file from GitHub.', 'details' => $deleteResponse['body']]);
}
?>

    