
<?php
header('Content-Type: application/json');
require 'github_config.php';

$apiUrl = 'https://api.github.com/repos/' . GITHUB_USER . '/' . GITHUB_REPO . '/contents/' . DATA_PATH;

$ch = curl_init();
$headers = [
    'Authorization: token ' . GITHUB_TOKEN,
    'Accept: application/vnd.github.v3+json',
    'User-Agent: ' . GITHUB_USER
];

curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code != 200) {
    http_response_code($http_code);
    echo json_encode(['error' => 'Could not list files from GitHub.', 'details' => json_decode($response)]);
    exit;
}

$files_raw = json_decode($response, true);
$files = [];

if (is_array($files_raw)) {
    foreach ($files_raw as $file_info) {
        if ($file_info['type'] == 'file' && pathinfo($file_info['name'], PATHINFO_EXTENSION) == 'json') {
            
            $file_content_raw = file_get_contents($file_info['download_url']);
            $file_content = json_decode($file_content_raw, true);

            // Create a summary, don't send the whole file
            $summary = [
                'id' => pathinfo($file_info['name'], PATHINFO_FILENAME),
                'jfn' => $file_content['jfn'] ?? '',
                'sh' => $file_content['sh'] ?? '',
                'co' => $file_content['co'] ?? '',
                'totalProfit' => $file_content['totalProfit'] ?? 0,
                'bd' => $file_content['bd'] ?? '',
                // Use updatedAt from file content if available, otherwise fallback is needed client-side
                'updatedAt' => $file_content['updatedAt'] ?? date('c', time()), 
            ];
            $files[] = $summary;
        }
    }
}

echo json_encode($files);
?>

    