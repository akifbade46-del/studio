<?php
header('Access-Control-Allow-Origin: *');
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
             // We don't fetch content here anymore to speed things up
             $summary = [
                'id' => pathinfo($file_info['name'], PATHINFO_FILENAME),
                'name' => $file_info['name'],
                'path' => $file_info['path']
             ];
             $files[] = $summary;
        }
    }
}

// Now, fetch summary data for each file
$summaries = [];
$mh = curl_multi_init();
$handles = [];

foreach($files as $file) {
    $ch = curl_init();
    $headers = [
        'Authorization: token ' . GITHUB_TOKEN,
        'Accept: application/vnd.github.v3.raw',
        'User-Agent: ' . GITHUB_USER
    ];
    curl_setopt($ch, CURLOPT_URL, 'https://api.github.com/repos/' . GITHUB_USER . '/' . GITHUB_REPO . '/contents/' . $file['path']);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_multi_add_handle($mh, $ch);
    $handles[$file['id']] = $ch;
}

$running = null;
do {
    curl_multi_exec($mh, $running);
} while ($running);

foreach($handles as $id => $ch) {
    $content = curl_multi_getcontent($ch);
    $data = json_decode($content, true);
    if($data) {
        $summaries[] = [
            'id' => $id,
            'jfn' => $data['jfn'] ?? '',
            'sh' => $data['sh'] ?? '',
            'co' => $data['co'] ?? '',
            'totalProfit' => $data['totalProfit'] ?? 0,
            'bd' => $data['bd'] ?? '',
            'updatedAt' => $data['updatedAt'] ?? date('c'), // Use ISO 8601 format
        ];
    }
    curl_multi_remove_handle($mh, $ch);
}
curl_multi_close($mh);


echo json_encode($summaries);
?>
