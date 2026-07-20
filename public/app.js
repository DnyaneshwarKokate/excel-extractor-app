document.addEventListener('DOMContentLoaded', () => {
    const excelPathInput = document.getElementById('excelPathInput');
    const browseExcelBtn = document.getElementById('browseExcelBtn');
    const excelFilePicker = document.getElementById('excelFilePicker');
    const sheetSelect = document.getElementById('sheetSelect');
    const dropzone = document.getElementById('dropzone');
    const imageFileInput = document.getElementById('imageFileInput');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const resultsSection = document.getElementById('resultsSection');
    const previewTableBody = document.getElementById('previewTableBody');
    const insertExcelBtn = document.getElementById('insertExcelBtn');
    
    // Camera elements
    const openCameraBtn = document.getElementById('openCameraBtn');
    const cameraModal = document.getElementById('cameraModal');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const closeCameraFooterBtn = document.getElementById('closeCameraFooterBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');

    let extractedRecords = [];
    let mediaStream = null;
    let selectedExcelFile = null;

    const monthNames = [
        "January", "Feburary", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Auto-detect Month Sheet from Date string (DD.MM.YYYY)
    function getMonthSheetFromDate(dateStr) {
        if (!dateStr) return "June - 2026";
        const parts = dateStr.replace('/', '.').replace('-', '.').split('.');
        if (parts.length === 3) {
            const monthIdx = parseInt(parts[1], 10) - 1;
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            if (monthIdx >= 0 && monthIdx < 12) {
                return `${monthNames[monthIdx]} - ${year}`;
            }
        }
        return "June - 2026";
    }

    function autoSelectMonthSheet(records) {
        if (!records || records.length === 0) return;
        const firstDate = records[0].date;
        const detectedSheet = getMonthSheetFromDate(firstDate);

        // Check if option exists in dropdown
        let optionExists = false;
        for (let i = 0; i < sheetSelect.options.length; i++) {
            if (sheetSelect.options[i].value === detectedSheet) {
                optionExists = true;
                break;
            }
        }

        // Add option dynamically if missing
        if (!optionExists) {
            const newOpt = document.createElement('option');
            newOpt.value = detectedSheet;
            newOpt.textContent = detectedSheet;
            sheetSelect.appendChild(newOpt);
        }

        sheetSelect.value = detectedSheet;
    }

    // Excel File Browse Handler
    browseExcelBtn.addEventListener('click', () => {
        excelFilePicker.click();
    });

    excelFilePicker.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedExcelFile = e.target.files[0];
            excelPathInput.value = selectedExcelFile.name;
        }
    });

    // Chips click handler
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            selectedExcelFile = null;
            excelPathInput.value = chip.dataset.path;
        });
    });

    // 1. Browse Images Handler
    imageFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUploads(Array.from(e.target.files));
        }
    });

    // 2. PDF Import Handler
    pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUploads(Array.from(e.target.files));
        }
    });

    // Drag and drop handler
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-over'));
    });

    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileUploads(files);
        }
    });

    // 3. Camera Access Handler
    openCameraBtn.addEventListener('click', async () => {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraVideo.srcObject = mediaStream;
            cameraModal.classList.remove('hidden');
        } catch (err) {
            alert('Camera access error: ' + err.message);
        }
    });

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        cameraModal.classList.add('hidden');
    }

    closeCameraBtn.addEventListener('click', stopCamera);
    closeCameraFooterBtn.addEventListener('click', stopCamera);

    snapPhotoBtn.addEventListener('click', () => {
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraVideo.videoWidth;
        cameraCanvas.height = cameraVideo.videoHeight;
        context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
        
        cameraCanvas.toBlob(blob => {
            const file = new File([blob], `Camera_Capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera();
            handleFileUploads([file]);
        }, 'image/jpeg');
    });

    // Process Uploaded Files (Images or PDFs)
    async function handleFileUploads(files) {
        loadingOverlay.classList.remove('hidden');
        loadingText.textContent = `Running Apple Vision OCR on ${files.length} file(s)...`;

        const formData = new FormData();
        files.forEach(f => formData.append('images', f));

        try {
            const res = await fetch('/api/extract-image', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            loadingOverlay.classList.add('hidden');

            if (data.success) {
                extractedRecords = extractedRecords.concat(data.records);
                autoSelectMonthSheet(extractedRecords);
                renderPreviewTable();
                resultsSection.classList.remove('hidden');
            } else {
                alert('OCR Extraction Error: ' + data.error);
            }
        } catch (err) {
            loadingOverlay.classList.add('hidden');
            alert('Server Communication Error: ' + err.message);
        }
    }

    // Render Data Preview Table
    function renderPreviewTable() {
        previewTableBody.innerHTML = '';
        extractedRecords.forEach((rec, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${rec.imageName}</strong></td>
                <td><input type="text" value="${rec.date}" onchange="updateRecord(${idx}, 'date', this.value)"></td>
                <td><input type="text" value="${rec.customerName}" onchange="updateRecord(${idx}, 'customerName', this.value)"></td>
                <td><input type="text" value="${rec.partNumber}" onchange="updateRecord(${idx}, 'partNumber', this.value)"></td>
                <td><input type="text" value="${rec.partName}" onchange="updateRecord(${idx}, 'partName', this.value)"></td>
                <td><input type="number" style="width:70px" value="${rec.qty}" onchange="updateRecord(${idx}, 'qty', this.value)"></td>
                <td><input type="number" step="0.01" style="width:80px" value="${rec.sqft}" onchange="updateRecord(${idx}, 'sqft', this.value)"></td>
                <td><input type="number" style="width:80px" value="${rec.jobCardNo}" onchange="updateRecord(${idx}, 'jobCardNo', this.value)"></td>
                <td><input type="text" value="${rec.poNo}" onchange="updateRecord(${idx}, 'poNo', this.value)"></td>
                <td><button class="btn secondary" style="padding:4px 8px;" onclick="deleteRecord(${idx})">🗑️</button></td>
            `;
            previewTableBody.appendChild(tr);
        });
    }

    window.updateRecord = (idx, field, val) => {
        extractedRecords[idx][field] = val;
        if (field === 'date') {
            autoSelectMonthSheet(extractedRecords);
        }
    };

    window.deleteRecord = (idx) => {
        extractedRecords.splice(idx, 1);
        renderPreviewTable();
        if (extractedRecords.length === 0) {
            resultsSection.classList.add('hidden');
        } else {
            autoSelectMonthSheet(extractedRecords);
        }
    };

    // Insert all entries into Excel
    insertExcelBtn.addEventListener('click', async () => {
        if (extractedRecords.length === 0) {
            alert('No records to insert');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        loadingText.textContent = 'Inserting entries into Excel Report...';

        const formData = new FormData();
        formData.append('sheetName', sheetSelect.value);
        formData.append('records', JSON.stringify(extractedRecords));

        if (selectedExcelFile) {
            formData.append('excelFile', selectedExcelFile);
        } else {
            formData.append('filePath', excelPathInput.value);
        }

        try {
            const res = await fetch('/api/insert-excel', {
                method: 'POST',
                body: formData
            });

            if (selectedExcelFile) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = selectedExcelFile.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                loadingOverlay.classList.add('hidden');
                alert('🎉 SUCCESS! Updated Excel file downloaded!');
            } else {
                const data = await res.json();
                loadingOverlay.classList.add('hidden');

                if (data.success) {
                    alert(`🎉 SUCCESS! Successfully inserted ${data.addedRows.length} entries into Excel sheet "${sheetSelect.value}" starting at Row ${data.addedRows[0]}!`);
                    extractedRecords = [];
                    resultsSection.classList.add('hidden');
                } else {
                    alert('Excel Insertion Error: ' + data.error);
                }
            }
        } catch (err) {
            loadingOverlay.classList.add('hidden');
            alert('Error communicating with server: ' + err.message);
        }
    });
});
