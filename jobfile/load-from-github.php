<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
require 'github_config.php';

if (!isset($_GET['fileId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'fileId parameter is missing.']);
    exit;
}

$fileId = str_replace(['/', '\\', '.'], '_', $_GET['fileId']); // Sanitize fileId
$filePath = DATA_PATH . $fileId . '.json';
$apiUrl = 'https://api.github.com/repos/' . GITHUB_USER . '/' . GITHUB_REPO . '/contents/' . $filePath;

$ch = curl_init();
$headers = [
    'Authorization: token ' . GITHUB_TOKEN,
    'Accept: application/vnd.github.v3.raw', // Get raw content
    'User-Agent: ' . GITHUB_USER
];

curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code == 200) {
    // The response is the raw JSON string
    echo $response;
} else {
    http_response_code($http_code);
    $decodedResponse = json_decode($response, true);
    echo json_encode(['error' => 'Could not load file from GitHub.', 'details' => $decodedResponse]);
}
?>
