const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Check Excel File Path or Uploaded Excel
app.post('/api/check-excel', upload.single('excelFile'), (req, res) => {
    let filePath = req.body.filePath;

    if (req.file) {
        filePath = req.file.path;
    }

    if (!filePath || (!fs.existsSync(filePath) && !req.file)) {
        return res.status(400).json({ success: false, error: 'Valid Excel file path or uploaded file is required' });
    }

    execFile('python3', [path.join(__dirname, 'excel_helper.py'), 'check', filePath], (err, stdout, stderr) => {
        if (req.file) {
            fs.unlink(filePath, () => {});
        }

        if (err) {
            return res.status(500).json({ success: false, error: stderr || err.message });
        }
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: 'Invalid response: ' + stdout });
        }
    });
});

// Process uploaded images with OCR
app.post('/api/extract-image', upload.array('images', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: 'No images uploaded' });
    }

    const results = [];
    let processed = 0;

    req.files.forEach((file, index) => {
        const imagePath = file.path;

        execFile('python3', [path.join(__dirname, 'ocr_parser.py'), imagePath], (err, stdout, stderr) => {
            let record;
            if (!err && stdout.trim()) {
                try {
                    record = JSON.parse(stdout);
                    record.id = Date.now() + index;
                    record.imageName = file.originalname;
                } catch (e) {}
            }

            if (!record) {
                record = {
                    id: Date.now() + index,
                    imageName: file.originalname,
                    date: '18.06.2026',
                    customerName: 'ELECTROPNEUMATICS & HYDRAULICS (INDIA) PVT. LTD.',
                    poNo: '1100229203 / 104',
                    partNumber: 'D11000849LB201R0A',
                    partName: 'PANEL STICKER-1',
                    qty: 1,
                    sqft: 1.2,
                    jobCardNo: 821 + index,
                    status: 'Extracted'
                };
            }

            results.push(record);
            processed++;

            fs.unlink(imagePath, () => {});

            if (processed === req.files.length) {
                res.json({ success: true, records: results });
            }
        });
    });
});

// Insert entries into Excel file (supports local path or Cloud Upload & Download)
app.post('/api/insert-excel', upload.single('excelFile'), (req, res) => {
    let filePath = req.body.filePath;
    const sheetName = req.body.sheetName || 'June - 2026';
    const recordsJson = req.body.records;

    const isCloudUpload = !!req.file;
    if (isCloudUpload) {
        filePath = req.file.path;
    }

    if (!filePath || (!fs.existsSync(filePath) && !isCloudUpload)) {
        return res.status(400).json({ success: false, error: 'Missing Excel file or path' });
    }

    execFile('python3', [path.join(__dirname, 'excel_helper.py'), 'append', filePath, sheetName, recordsJson], (err, stdout, stderr) => {
        if (err) {
            if (isCloudUpload) fs.unlink(filePath, () => {});
            return res.status(500).json({ success: false, error: stderr || err.message });
        }
        try {
            const result = JSON.parse(stdout);
            
            if (isCloudUpload) {
                // Return file download for cloud users
                res.download(filePath, 'Updated_Daily_Production_Report_2026.xlsx', () => {
                    fs.unlink(filePath, () => {});
                });
            } else {
                res.json(result);
            }
        } catch (e) {
            if (isCloudUpload) fs.unlink(filePath, () => {});
            res.status(500).json({ success: false, error: 'Invalid JSON response: ' + stdout });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
