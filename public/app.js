document.addEventListener('DOMContentLoaded', () => {
    const excelPathInput = document.getElementById('excelPathInput');
    const verifyPathBtn = document.getElementById('verifyPathBtn');
    const sheetSelect = document.getElementById('sheetSelect');
    const dropzone = document.getElementById('dropzone');
    const imageFileInput = document.getElementById('imageFileInput');
    const thumbnailsContainer = document.getElementById('thumbnailsContainer');
    const tableBody = document.getElementById('tableBody');
    const emptyRowState = document.getElementById('emptyRowState');
    const recordCount = document.getElementById('recordCount');
    const insertExcelBtn = document.getElementById('insertExcelBtn');
    const addManualRowBtn = document.getElementById('addManualRowBtn');
    const alertBox = document.getElementById('alertBox');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    let extractedRecords = [];

    // Path Chips Click Handler
    document.querySelectorAll('.path-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            excelPathInput.value = chip.dataset.path;
            verifyExcelFile();
        });
    });

    verifyPathBtn.addEventListener('click', verifyExcelFile);

    async function verifyExcelFile() {
        const filePath = excelPathInput.value.trim();
        if (!filePath) return;

        showAlert('Checking file path...', 'success');
        try {
            const res = await fetch('/api/check-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath })
            });
            const data = await res.json();
            if (data.success) {
                sheetSelect.innerHTML = '';
                data.sheets.forEach(sheet => {
                    const opt = document.createElement('option');
                    opt.value = sheet;
                    opt.textContent = sheet;
                    if (sheet.includes('June')) opt.selected = true;
                    sheetSelect.appendChild(opt);
                });
                showAlert(`File verified! Found ${data.sheets.length} sheets.`, 'success');
            } else {
                showAlert(`Error: ${data.error}`, 'error');
            }
        } catch (e) {
            showAlert(`Network error: ${e.message}`, 'error');
        }
    }

    // Drag & Drop Handlers
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    });

    imageFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files);
        }
    });

    async function handleFileUpload(files) {
        showLoading('Performing Apple Vision OCR & date extraction...');
        thumbnailsContainer.innerHTML = '';

        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append('images', file);

            // Thumbnail preview
            const reader = new FileReader();
            reader.onload = (ev) => {
                const thumb = document.createElement('div');
                thumb.className = 'thumb-card';
                thumb.innerHTML = `<img src="${ev.target.result}" alt="${file.name}">`;
                thumbnailsContainer.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        });

        try {
            const res = await fetch('/api/extract-image', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            hideLoading();

            if (data.success && data.records.length > 0) {
                data.records.forEach(rec => extractedRecords.push(rec));
                renderTable();
                showAlert(`Successfully scanned ${data.records.length} images with Apple Vision OCR!`, 'success');
            } else {
                showAlert(`Extraction failed: ${data.error || 'No readable text'}`, 'error');
            }
        } catch (e) {
            hideLoading();
            showAlert(`Failed to process images: ${e.message}`, 'error');
        }
    }

    // Render Table
    function renderTable() {
        if (extractedRecords.length === 0) {
            tableBody.innerHTML = '';
            tableBody.appendChild(emptyRowState);
            recordCount.textContent = '0';
            insertExcelBtn.disabled = true;
            return;
        }

        tableBody.innerHTML = '';
        extractedRecords.forEach((rec, idx) => {
            const tr = document.createElement('tr');

            // Date options dropdown if multiple dates detected
            let dateHtml = '';
            if (rec.dateOptions && rec.dateOptions.length > 1) {
                const options = rec.dateOptions.map(d => `<option value="${d}" ${d === rec.date ? 'selected' : ''}>${d}</option>`).join('');
                dateHtml = `<select class="table-input" onchange="updateRecord(${idx}, 'date', this.value)">${options}</select>`;
            } else {
                dateHtml = `<input type="text" class="table-input" value="${rec.date}" onchange="updateRecord(${idx}, 'date', this.value)">`;
            }

            tr.innerHTML = `
                <td>${dateHtml}</td>
                <td><input type="text" class="table-input" value="${rec.customerName}" onchange="updateRecord(${idx}, 'customerName', this.value)"></td>
                <td><input type="text" class="table-input" value="${rec.partNumber}" onchange="updateRecord(${idx}, 'partNumber', this.value)"></td>
                <td><input type="text" class="table-input" value="${rec.partName}" onchange="updateRecord(${idx}, 'partName', this.value)"></td>
                <td><input type="number" class="table-input" value="${rec.qty}" onchange="updateRecord(${idx}, 'qty', this.value)"></td>
                <td><input type="number" step="0.1" class="table-input" value="${rec.sqft}" onchange="updateRecord(${idx}, 'sqft', this.value)"></td>
                <td><input type="text" class="table-input" value="${rec.jobCardNo}" onchange="updateRecord(${idx}, 'jobCardNo', this.value)"></td>
                <td><input type="text" class="table-input" value="${rec.poNo}" onchange="updateRecord(${idx}, 'poNo', this.value)"></td>
                <td><button class="btn btn-danger" onclick="deleteRecord(${idx})">Delete</button></td>
            `;
            tableBody.appendChild(tr);
        });

        recordCount.textContent = extractedRecords.length;
        insertExcelBtn.disabled = false;
    }

    window.updateRecord = (index, field, value) => {
        if (extractedRecords[index]) {
            extractedRecords[index][field] = value;
        }
    };

    window.deleteRecord = (index) => {
        extractedRecords.splice(index, 1);
        renderTable();
    };

    addManualRowBtn.addEventListener('click', () => {
        extractedRecords.push({
            id: Date.now(),
            date: '18.06.2026',
            customerName: 'ELECTROPNEUMATICS & HYDRAULICS (INDIA) PVT. LTD.',
            poNo: '1100229203 / 104',
            partNumber: 'D11000849LB201R0A',
            partName: 'PANEL STICKER-1',
            qty: 1,
            sqft: 1.2,
            jobCardNo: 825,
            status: 'Manual'
        });
        renderTable();
    });

    // Insert into Excel Handler
    insertExcelBtn.addEventListener('click', async () => {
        const filePath = excelPathInput.value.trim();
        const sheetName = sheetSelect.value;

        if (!filePath) {
            showAlert('Please select or input a valid Excel file path', 'error');
            return;
        }

        showLoading('Inserting entries into Excel file...');

        try {
            const res = await fetch('/api/insert-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath,
                    sheetName,
                    records: extractedRecords
                })
            });

            const data = await res.json();
            hideLoading();

            if (data.success) {
                showAlert(`Success! Inserted ${data.addedRows.length} rows (Rows: ${data.addedRows.join(', ')}) into "${sheetName}" sheet!`, 'success');
                extractedRecords = [];
                renderTable();
            } else {
                showAlert(`Insertion error: ${data.error}`, 'error');
            }
        } catch (e) {
            hideLoading();
            showAlert(`Failed to insert into Excel: ${e.message}`, 'error');
        }
    });

    function showAlert(msg, type) {
        alertBox.textContent = msg;
        alertBox.className = `alert-box ${type}`;
        setTimeout(() => {
            if (type === 'success') alertBox.classList.add('hidden');
        }, 5000);
    }

    function showLoading(msg) {
        loadingText.textContent = msg;
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // Auto verify default path on load
    verifyExcelFile();
});
