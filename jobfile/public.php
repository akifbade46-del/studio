<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Public Job File View</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .print-field { border: 1px solid #6b7280; padding: 0.3rem; min-height: 24px; word-break: break-all; }
        .print-table { border-collapse: collapse; width: 100%; }
        .print-table th, .print-table td { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }
    </style>
</head>
<body class="bg-gray-100">
    <div class="container max-w-4xl mx-auto my-8 p-8 bg-white shadow-lg">
        <?php
            if (!isset($_GET['jobId'])) {
                echo '<p class="text-red-500 font-bold text-center">No Job ID provided.</p>';
                exit();
            }

            $jobId = $_GET['jobId'];
            $filename = str_replace('/', '_', $jobId) . '.json';
            $file_path = 'data/' . $filename;

            if (!file_exists($file_path)) {
                echo '<p class="text-red-500 font-bold text-center">Job File not found.</p>';
                exit();
            }

            $content = file_get_contents($file_path);
            $data = json_decode($content, true);

            if (!$data) {
                echo '<p class="text-red-500 font-bold text-center">Could not read job file data.</p>';
                exit();
            }

            // Function to safely get data
            function get_val($data, $key, $default = 'N/A') {
                return htmlspecialchars($data[$key] ?? $default);
            }
            function get_arr($data, $key) {
                return implode(', ', $data[$key] ?? []);
            }

            $charges_html = '';
            if (isset($data['ch'])) {
                foreach ($data['ch'] as $c) {
                    $charges_html .= '<tr>
                        <td class="px-2 py-1 border">' . get_val($c, 'l') . '</td>
                        <td class="px-2 py-1 border text-right">' . number_format(floatval(get_val($c, 'c', '0')), 3) . '</td>
                        <td class="px-2 py-1 border text-right">' . number_format(floatval(get_val($c, 's', '0')), 3) . '</td>
                        <td class="px-2 py-1 border text-right">' . number_format(floatval(get_val($c, 's', '0')) - floatval(get_val($c, 'c', '0')), 3) . '</td>
                        <td class="px-2 py-1 border">' . get_val($c, 'n') . '</td>
                    </tr>';
                }
            }
            
            $totalCost = number_format($data['totalCost'] ?? 0, 3);
            $totalSelling = number_format($data['totalSelling'] ?? 0, 3);
            $totalProfit = number_format($data['totalProfit'] ?? 0, 3);
        ?>

        <div class="p-4 bg-white text-sm">
            <div class="flex justify-between items-start mb-4">
                <img class="h-16 w-auto" src="https://qgocargo.com/logo.png" alt="Q'go Cargo Logo">
                <div class="text-right">
                    <h1 class="text-2xl font-bold">JOB FILE</h1>
                    <p><strong>Date:</strong> <?php echo get_val($data, 'd'); ?></p>
                    <p><strong>P.O. #:</strong> <?php echo get_val($data, 'po'); ?></p>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-4 mb-4">
                <div><strong class="font-semibold">Job File No:</strong><div class="print-field"><?php echo get_val($data, 'jfn'); ?></div></div>
                <div class="col-span-3"><strong class="font-semibold">Clearance:</strong><div class="print-field"><?php echo get_arr($data, 'cl'); ?></div></div>
                <div><strong class="font-semibold">Invoice No:</strong><div class="print-field"><?php echo get_val($data, 'in'); ?></div></div>
                <div><strong class="font-semibold">Billing Date:</strong><div class="print-field"><?php echo get_val($data, 'bd'); ?></div></div>
                <div class="col-span-2"><strong class="font-semibold">Product Type:</strong><div class="print-field"><?php echo get_arr($data, 'pt'); ?></div></div>
                <div class="col-span-2"><strong class="font-semibold">Shipper's Name:</strong><div class="print-field"><?php echo get_val($data, 'sh'); ?></div></div>
                <div class="col-span-2"><strong class="font-semibold">Consignee's Name:</strong><div class="print-field"><?php echo get_val($data, 'co'); ?></div></div>
            </div>
            <h3 class="font-bold text-lg mb-2">Charges</h3>
            <table class="w-full border-collapse border print-table mb-4">
                <thead><tr class="bg-gray-100">
                    <th class="px-2 py-1 border font-semibold">Description</th>
                    <th class="px-2 py-1 border font-semibold">Cost</th>
                    <th class="px-2 py-1 border font-semibold">Selling</th>
                    <th class="px-2 py-1 border font-semibold">Profit</th>
                    <th class="px-2 py-1 border font-semibold">Notes</th>
                </tr></thead>
                <tbody><?php echo $charges_html; ?></tbody>
                <tfoot><tr class="bg-gray-100 font-bold">
                    <td class="px-2 py-1 border text-right">TOTAL</td>
                    <td class="px-2 py-1 border text-right"><?php echo $totalCost; ?></td>
                    <td class="px-2 py-1 border text-right"><?php echo $totalSelling; ?></td>
                    <td class="px-2 py-1 border text-right"><?php echo $totalProfit; ?></td>
                    <td class="px-2 py-1 border"></td>
                </tr></tfoot>
            </table>
            <div class="mb-4"><strong class="font-semibold">REMARKS:</strong><div class="print-field"><?php echo get_val($data, 're'); ?></div></div>
        </div>
    </div>
</body>
</html>
