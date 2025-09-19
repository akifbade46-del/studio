// Module for Analytics Dashboard Logic
        function openAnalyticsDashboard() {
            const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
            filterAnalyticsByTimeframe('all', dateType);
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('analytics-container').style.display = 'block';
            window.scrollTo(0, 0);
        }

        function filterAnalyticsByTimeframe(timeframe, dateType = 'bd') {
            currentFilteredJobs = jobFilesCache;
            const now = new Date();
            const currentYear = now.getFullYear();
            const lastYear = currentYear - 1;

            if (timeframe !== 'all') {
                currentFilteredJobs = jobFilesCache.filter(job => {
                    const dateField = dateType === 'bd' ? job.bd : job.d;
                    if (!dateField) return false;
                    const jobDate = new Date(dateField);
                    if (timeframe === 'thisYear') {
                        return jobDate.getFullYear() === currentYear;
                    }
                    if (timeframe === 'lastYear') {
                        return jobDate.getFullYear() === lastYear;
                    }
                    if (timeframe.includes('-')) { // Monthly filter like '2025-01'
                        const [year, month] = timeframe.split('-').map(Number);
                        return jobDate.getFullYear() === year && jobDate.getMonth() === month - 1;
                    }
                    return true;
                });
            }
            calculateAndDisplayAnalytics(currentFilteredJobs);
        }


        function calculateAndDisplayAnalytics(jobs) {
            const body = document.getElementById('analytics-body');
             if (jobs.length === 0) {
                 body.innerHTML = `
                <!-- Timeframe Filters -->
                <div class="space-y-3">
                    <div class="flex items-center justify-center gap-4">
                         <label for="analytics-date-type" class="text-sm font-medium">Report Date Type:</label>
                         <select id="analytics-date-type" class="input-field w-auto">
                             <option value="bd">Billing Date</option>
                             <option value="d">Opening Date</option>
                         </select>
                    </div>
                    <div class="flex justify-center flex-wrap gap-2">
                        <button data-timeframe="all" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">All Time</button>
                        <button data-timeframe="thisYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">This Year</button>
                        <button data-timeframe="lastYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">Last Year</button>
                    </div>
                </div>
                 <p class="text-center text-gray-500 mt-8">No data available for the selected period.</p>`;
                
                 document.querySelectorAll('.timeframe-btn').forEach(btn => {
                     btn.addEventListener('click', (e) => {
                         const timeframe = e.target.dataset.timeframe;
                         const dateType = document.getElementById('analytics-date-type').value;
                         filterAnalyticsByTimeframe(timeframe, dateType);
                     });
                 });
                 document.getElementById('analytics-date-type').addEventListener('change', (e) => {
                      const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
                      filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, e.target.value);
                 });
                 return;
            }

            let totalJobs = jobs.length;
            let totalRevenue = 0;
            let totalCost = 0;
            let totalProfit = 0;
            const profitByFile = [];
            const profitByShipper = {};
            const profitByConsignee = {};
            const monthlyStatsByBilling = {};
            const monthlyStatsByOpening = {};
            const profitByUser = {};
            const profitBySalesman = {};

            jobs.forEach(job => {
                const profit = job.totalProfit || 0;
                const revenue = job.totalSelling || 0;
                const cost = job.totalCost || 0;
                const creator = job.createdBy || 'Unknown';
                const salesman = job.sm || 'N/A';
                let status = 'Pending Check';
                if (job.status === 'rejected') status = 'Rejected';
                else if (job.status === 'approved') status = 'Approved';
                else if (job.status === 'checked') status = 'Checked';

                totalRevenue += revenue;
                totalCost += cost;
                totalProfit += profit;

                // Convert updatedAt into a proper Date instance. When data comes
                // from Firestore it will be a Timestamp with a toDate() method,
                // but when loaded from GitHub it is stored as an ISO string. To
                // accommodate both formats we check for the existence of
                // toDate() and fall back to new Date(string).
                let updatedDate;
                if (job.updatedAt) {
                    if (typeof job.updatedAt.toDate === 'function') {
                        updatedDate = job.updatedAt.toDate();
                    } else {
                        updatedDate = new Date(job.updatedAt);
                    }
                } else {
                    updatedDate = new Date(0);
                }
                profitByFile.push({ id: job.id, jfn: job.jfn, shipper: job.sh, consignee: job.co, profit: profit, status: status, date: updatedDate, cost: cost, dsc: job.dsc, mawb: job.mawb, createdBy: creator });

                if (job.sh) {
                    profitByShipper[job.sh] = (profitByShipper[job.sh] || 0) + profit;
                }
                if (job.co) {
                    profitByConsignee[job.co] = (profitByConsignee[job.co] || 0) + profit;
                }
                if (job.bd) {
                    const month = job.bd.substring(0, 7);
                    if (!monthlyStatsByBilling[month]) {
                        monthlyStatsByBilling[month] = { profit: 0, count: 0, jobs: [] };
                    }
                    monthlyStatsByBilling[month].profit += profit;
                    monthlyStatsByBilling[month].count++;
                    monthlyStatsByBilling[month].jobs.push(job);
                }
                if (job.d) {
                    const month = job.d.substring(0, 7);
                    if (!monthlyStatsByOpening[month]) {
                        monthlyStatsByOpening[month] = { profit: 0, count: 0, jobs: [] };
                    }
                    monthlyStatsByOpening[month].profit += profit;
                    monthlyStatsByOpening[month].count++;
                    monthlyStatsByOpening[month].jobs.push(job);
                }
                
                if (!profitByUser[creator]) {
                    profitByUser[creator] = { count: 0, profit: 0, jobs: [] };
                }
                profitByUser[creator].count++;
                profitByUser[creator].profit += profit;
                profitByUser[creator].jobs.push(job);

                if (salesman !== 'N/A') {
                    if (!profitBySalesman[salesman]) {
                        profitBySalesman[salesman] = { count: 0, profit: 0, jobs: [] };
                    }
                    profitBySalesman[salesman].count++;
                    profitBySalesman[salesman].profit += profit;
                    profitBySalesman[salesman].jobs.push(job);
                }
            });

            analyticsDataCache = {
                totalJobs, totalRevenue, totalCost, totalProfit, profitByFile,
                profitByShipper: Object.entries(profitByShipper).sort((a, b) => b[1] - a[1]),
                profitByConsignee: Object.entries(profitByConsignee).sort((a, b) => b[1] - a[1]),
                monthlyStatsByBilling: Object.entries(monthlyStatsByBilling).sort((a, b) => a[0].localeCompare(b[0])),
                monthlyStatsByOpening: Object.entries(monthlyStatsByOpening).sort((a, b) => a[0].localeCompare(b[0])),
                profitByUser: Object.entries(profitByUser).sort((a, b) => b[1].profit - a[1].profit),
                profitBySalesman: Object.entries(profitBySalesman).sort((a, b) => b[1].profit - a[1].profit)
            };

            displayAnalytics(analyticsDataCache);
        }

        function closeAnalyticsDashboard() {
            document.getElementById('analytics-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
        }
        
        function renderProfitChart(data, monthlyReportType) {
            if (profitChartInstance) {
                profitChartInstance.destroy();
            }

            const ctx = document.getElementById('profit-chart')?.getContext('2d');
            if (!ctx) return;
            
            const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
            
            let year;
            if (currentFilteredJobs.length > 0) {
                 const dateField = monthlyReportType === 'billing' ? currentFilteredJobs[0].bd : currentFilteredJobs[0].d;
                 if(dateField) year = new Date(dateField).getFullYear();
            }
            if (!year) year = new Date().getFullYear();


            const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const profits = Array(12).fill(0);
            
            monthlyStats.forEach(([monthStr, stats]) => {
                const [statYear, statMonth] = monthStr.split('-').map(Number);
                if (statYear === year) {
                    profits[statMonth - 1] = stats.profit;
                }
            });

            const maxProfit = Math.max(...profits.map(p => Math.abs(p)));

            const backgroundColors = profits.map(p => {
                if (p === 0) return 'rgba(201, 203, 207, 0.6)';
                const alpha = Math.max(0.2, Math.abs(p) / (maxProfit || 1));
                return p > 0 ? `rgba(75, 192, 192, ${alpha})` : `rgba(255, 99, 132, ${alpha})`;
            });

            profitChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Monthly Profit for ${year}`,
                        data: profits,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(c => c.replace('0.6', '1').replace('0.2','1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value, index, values) {
                                    return 'KD ' + value;
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                             callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += 'KD ' + context.parsed.y.toFixed(3);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }


        function displayAnalytics(data, sortBy = 'profit-desc', searchTerm = '', monthlyReportType = 'billing') {
            const body = document.getElementById('analytics-body');
            
            let filteredFiles = data.profitByFile;

            if (searchTerm) {
                const lowerCaseSearchTerm = searchTerm.toLowerCase();
                filteredFiles = data.profitByFile.filter(file => 
                    (file.jfn || '').toLowerCase().includes(lowerCaseSearchTerm) ||
                    (file.shipper || '').toLowerCase().includes(lowerCaseSearchTerm) ||
                    (file.consignee || '').toLowerCase().includes(lowerCaseSearchTerm) ||
                    (file.mawb || '').toLowerCase().includes(lowerCaseSearchTerm) ||
                    (file.createdBy || '').toLowerCase().includes(lowerCaseSearchTerm)
                );
            }
            
            const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
            const monthlyReportTitle = monthlyReportType === 'billing' ? 'Profit By Month (Billing Date)' : 'Profit By Month (Opening Date)';

            const now = new Date();
            const currentYear = now.getFullYear();
            const lastYear = currentYear - 1;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            let monthButtons = '';
            for(let i=0; i < 12; i++) {
                const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                monthButtons += `<button data-timeframe="${monthStr}" class="timeframe-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-sm">${months[i]}</button>`;
            }


            const sortedFiles = [...filteredFiles];
            if (sortBy === 'profit-desc') {
                sortedFiles.sort((a, b) => b.profit - a.profit);
            } else if (sortBy === 'date-desc') {
                sortedFiles.sort((a, b) => b.date - a.date);
            } else if (sortBy === 'status') {
                const statusOrder = { 'Pending Check': 1, 'Checked': 2, 'Approved': 3, 'Rejected': 4 };
                sortedFiles.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
            } else if (sortBy === 'user') {
                sortedFiles.sort((a, b) => (a.createdBy || '').localeCompare(b.createdBy || ''));
            }

            body.innerHTML = `
                <!-- Timeframe Filters -->
                <div class="space-y-3">
                    <div class="flex items-center justify-center gap-4">
                         <label for="analytics-date-type" class="text-sm font-medium">Report Date Type:</label>
                         <select id="analytics-date-type" class="input-field w-auto">
                             <option value="bd" ${monthlyReportType === 'bd' ? 'selected' : ''}>Billing Date</option>
                             <option value="d" ${monthlyReportType === 'd' ? 'selected' : ''}>Opening Date</option>
                         </select>
                    </div>
                    <div class="flex justify-center flex-wrap gap-2">
                        <button data-timeframe="all" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">All Time</button>
                        <button data-timeframe="thisYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">This Year</button>
                        <button data-timeframe="lastYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">Last Year</button>
                    </div>
                    <div class="flex justify-center flex-wrap gap-1">
                        ${monthButtons}
                    </div>
                </div>
                <!-- Overall Summary -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center mt-6">
                    <div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Jobs</p><p class="text-2xl font-bold">${data.totalJobs}</p></div>
                    <div class="bg-blue-100 p-4 rounded-lg"><p class="text-sm text-blue-800">Total Revenue</p><p class="text-2xl font-bold text-blue-900">KD ${data.totalRevenue.toFixed(3)}</p></div>
                    <div class="bg-red-100 p-4 rounded-lg"><p class="text-sm text-red-800">Total Cost</p><p class="text-2xl font-bold text-red-900">KD ${data.totalCost.toFixed(3)}</p></div>
                    <div class="bg-green-100 p-4 rounded-lg"><p class="text-sm text-green-800">Total Profit</p><p class="text-2xl font-bold text-green-900">KD ${data.totalProfit.toFixed(3)}</p></div>
                </div>
                 <!-- Profit Chart -->
                 <div class="bg-white p-4 rounded-lg shadow-sm">
                     <div style="position: relative; height:300px;">
                         <canvas id="profit-chart"></canvas>
                     </div>
                 </div>

                <!-- Detailed Breakdowns -->
                <div id="analytics-tables" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                        <h4 class="text-lg font-semibold mb-2">Top Profitable Shippers</h4>
                        <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Shipper</th><th>Total Profit</th></tr></thead>
                        <tbody>${data.profitByShipper.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div>
                    </div>
                    <div>
                        <h4 class="text-lg font-semibold mb-2">Top Profitable Consignees</h4>
                        <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Consignee</th><th>Total Profit</th></tr></thead>
                        <tbody>${data.profitByConsignee.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div>
                    </div>
                     <div>
                        <h4 class="text-lg font-semibold mb-2">Top Salesmen by Profit</h4>
                        <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Salesman</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead>
                        <tbody>${data.profitBySalesman.slice(0, 5).map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-salesman-jobs" data-salesman="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
                    </div>
                    <div class="lg:col-span-3">
                         <h4 class="text-lg font-semibold mb-2">${monthlyReportTitle}</h4>
                        <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Month</th><th>Total Jobs</th><th>Total Profit / Loss</th><th>Actions</th></tr></thead>
                        <tbody>${monthlyStats.map(([month, stats]) => `<tr><td>${month}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-monthly-jobs" data-month="${month}" data-datetype="${monthlyReportType}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
                    </div>
                     <div class="lg:col-span-3">
                        <h4 class="text-lg font-semibold mb-2">Top Users by Profit</h4>
                        <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>User</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead>
                        <tbody>${data.profitByUser.map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-user-jobs" data-user="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
                    </div>
                </div>

                <!-- Profit by Job File -->
                <div>
                    <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
                        <h4 class="text-lg font-semibold">Job File Details</h4>
                        <div class="flex items-center gap-2 flex-grow">
                            <input type="text" id="analytics-search-bar" class="input-field w-full sm:w-auto flex-grow" placeholder="Search files..." value="${searchTerm}">
                            <label for="sort-analytics" class="text-sm ml-4 mr-2">Sort by:</label>
                            <select id="sort-analytics" class="input-field w-auto inline-block text-sm">
                                <option value="profit-desc" ${sortBy === 'profit-desc' ? 'selected' : ''}>Profit (High to Low)</option>
                                <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                                <option value="status" ${sortBy === 'status' ? 'selected' : ''}>Status</option>
                                <option value="user" ${sortBy === 'user' ? 'selected' : ''}>User</option>
                            </select>
                            <button onclick="downloadAnalyticsCsv()" class="bg-gray-700 hover:bg-gray-800 text-white font-bold py-1 px-3 rounded text-sm">CSV</button>
                        </div>
                    </div>
                    <div class="max-h-96 overflow-y-auto">
                        <table class="analytics-table w-full text-sm">
                            <thead><tr><th>Job Details</th><th>Cost / Profit</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>${sortedFiles.length > 0 ? sortedFiles.map(file => `
                                <tr>
                                    <td>
                                        <p class="font-bold">${file.jfn || file.id}</p>
                                        <p class="text-xs">Shipper: ${file.shipper || 'N/A'}</p>
                                        <p class="text-xs">Consignee: ${file.consignee || 'N/A'}</p>
                                        <p class="text-xs text-gray-600">AWB/MAWB: ${file.mawb || 'N/A'}</p>
                                        <p class="text-xs text-gray-600">Desc: ${file.dsc || 'N/A'}</p>
                                        <p class="text-xs font-bold mt-1">Created by: ${file.createdBy || 'N/A'}</p>
                                    </td>
                                    <td>
                                        <p class="font-bold text-green-600">KD ${file.profit.toFixed(3)}</p>
                                        <p class="text-xs text-red-600">Cost: KD ${file.cost.toFixed(3)}</p>
                                    </td>
                                    <td>${file.status}</td>
                                    <td class="space-x-1">
                                        <button onclick="previewJobFileById('${file.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Preview</button>
                                        <button onclick="loadJobFileById('${file.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs">Load</button>
                                        ${currentUser.role === 'admin' ? `<button onclick="confirmDelete('${file.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>` : ''}
                                    </td>
                                </tr>`).join('') : `<tr><td colspan="4" class="text-center py-4">No files match your search.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            renderProfitChart(data, monthlyReportType);

            document.getElementById('analytics-search-bar').addEventListener('input', (e) => {
                displayAnalytics(analyticsDataCache, document.getElementById('sort-analytics').value, e.target.value, document.getElementById('analytics-date-type').value);
            });
            document.getElementById('sort-analytics').addEventListener('change', (e) => {
                 displayAnalytics(analyticsDataCache, e.target.value, document.getElementById('analytics-search-bar').value, document.getElementById('analytics-date-type').value);
            });
             document.getElementById('analytics-date-type').addEventListener('change', (e) => {
                 const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
                 filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, e.target.value);
            });

            document.querySelectorAll('.timeframe-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                     document.querySelectorAll('.timeframe-btn').forEach(b => {
                         b.classList.remove('bg-indigo-700', 'text-white');
                         if(!b.classList.contains('bg-gray-200')) {
                             b.classList.add('bg-indigo-500');
                         }
                     });
                     e.target.classList.remove('bg-indigo-500', 'bg-gray-200');
                     e.target.classList.add('bg-indigo-700', 'text-white');
                    const timeframe = e.target.dataset.timeframe;
                    const dateType = document.getElementById('analytics-date-type').value;
                    filterAnalyticsByTimeframe(timeframe, dateType);
                });
            });

            document.getElementById('analytics-tables').addEventListener('click', (e) => {
                const target = e.target;
                if (target.tagName === 'BUTTON' && target.dataset.action) {
                    const action = target.dataset.action;
                    if (action === 'view-user-jobs') {
                        showUserJobs(target.dataset.user);
                    } else if (action === 'view-monthly-jobs') {
                        showMonthlyJobs(target.dataset.month, target.dataset.datetype);
                    } else if (action === 'view-salesman-jobs') {
                        showSalesmanJobs(target.dataset.salesman);
                    }
                }
            });

        }
        
        function sortAnalyticsTable(sortBy) {
            const searchTerm = document.getElementById('analytics-search-bar').value;
            displayAnalytics(analyticsDataCache, sortBy, searchTerm, document.getElementById('analytics-date-type').value);
        }
        
        function downloadAnalyticsCsv() {
            let csvContent = "data:text/csv;charset=utf-8,Job File ID,Shipper,Consignee,Profit,Status,Cost,Description,AWB/MAWB,Created By\n";
            const sortedFiles = [...analyticsDataCache.profitByFile].sort((a,b) => (b.profit || 0) - (a.profit || 0));

            sortedFiles.forEach(job => {
                const rowData = [job.jfn, job.shipper || 'N/A', job.consignee || 'N/A', (job.profit || 0).toFixed(3), job.status, (job.cost || 0).toFixed(3), job.dsc || 'N/A', job.mawb || 'N/A', job.createdBy || 'N/A'];
                const row = rowData.map(d => `"${String(d).replace(/"/g, '""')}"`).join(",");
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "job_file_analytics.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

