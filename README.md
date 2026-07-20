# ✨ Job Card & Purchase Order OCR Excel Extractor

A high-performance Node.js & Express web application powered by **Apple Native Vision OCR (`VNRecognizeTextRequest`)** and **PDFKit** to extract structured production data from printed and handwritten Job Cards and Purchase Orders, writing directly into Excel reports (`Daily Production Report - 2026.xlsx`) with zero corruption guarantee.

---

## 🌟 Key Features

- 👁️ **Apple Native Vision OCR Engine**: High-precision text recognition for printed and handwritten industrial Job Cards and Purchase Orders.
- 📁 **3 Flexible Input Options**:
  1. **Browse Images**: Upload `.jpg`, `.jpeg`, `.png`, `.webp`.
  2. **Live Camera Access**: WebRTC webcam feed to snap physical Job Cards directly from laptop/phone camera.
  3. **Native PDF Import**: Multi-page PDF document rendering and OCR extraction via Apple `PDFKit`.
- 📊 **Browse Excel File Picker**: Select target `.xlsx` report files via Finder file picker or local disk paths.
- 🏢 **Authentic Multi-Customer & Part Number Extractor**:
  - Automatically identifies customers (*Tata Motors, Exide Industries, Thermax, Sany Heavy Industry, Godrej & Boyce, Fiat India, Electropneumatics, Ukay Metal, Bharat Engg*).
  - Extracts exact item codes (`SSY...`, `B0...`, `D11...`, `55121606SD...`, `00934194500E`, `6740...`), descriptions, quantities, Sq.Ft, and PO numbers.
- 🛡️ **Zero Excel Corruption & Auto Backups**:
  - XML Namespace & Shared String Table preservation.
  - Automatic timestamped backups generated in `~/Downloads/Excel_Backups/`.
  - Duplicate Job Card guard to prevent duplicate entries.
- ☁️ **Dual Free Deployment (Netlify & Render)**: Includes `netlify.toml` and `render.yaml` for 1-click cloud deployment.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- macOS (for Apple Vision OCR)
- Node.js (v16+)
- Swift compiler (`swiftc`)

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/excel-extractor-app.git
cd excel-extractor-app
npm install
```

### 2. Compile OCR Engine
```bash
swiftc -module-cache-path .module_cache ocr.swift -o ocr_engine
```

### 3. Run Web Application
```bash
npm start
```
Open your browser at **[http://localhost:3000](http://localhost:3000)**.

### 🖥️ macOS 1-Click Launcher
Double-click **`start.command`** in Finder to launch the server and automatically open the app in your browser.

---

## ☁️ Free Cloud Deployment Guides

### Option A: Deploy on Netlify
1. Push your repository to GitHub:
   ```bash
   git add . && git commit -m "Update Netlify config" && git push origin main
   ```
2. Go to **[Netlify.com Dashboard](https://app.netlify.com)** → Click **Add new site** → **Import an existing project**.
3. Select GitHub and pick `excel-extractor-app`.
4. Netlify will automatically build and deploy using `netlify.toml`.

### Option B: Deploy on Render.com
1. Push your repository to GitHub.
2. Go to **[Render.com Dashboard](https://dashboard.render.com)** → Click **New +** → **Blueprint**.
3. Connect your `excel-extractor-app` GitHub repository.
4. Render will deploy automatically using `render.yaml`.

---

## 📂 Project Structure

```
excel-extractor-app/
├── public/
│   ├── index.html        # Modern glassmorphic Web Interface
│   ├── style.css         # Responsive CSS Stylesheet
│   └── app.js            # Client-side JavaScript & Camera Handlers
├── functions/
│   └── api.js            # Netlify Functions Serverless Endpoint
├── excel_helper.py       # Python OpenXML Excel Manipulation Engine
├── ocr_parser.py         # Structured Regex & Positional Text Extractor
├── ocr.swift             # Native Apple Vision + PDFKit Swift Source
├── ocr_engine            # Compiled Native Swift Binary
├── server.js             # Express.js Server API
├── netlify.toml          # Netlify Deployment Configuration
├── render.yaml           # Render.com Deployment Blueprint
├── start.command         # macOS Desktop Launcher
└── README.md             # Project Documentation
```

---

## 📄 License
MIT License - Free for industrial and personal production report automation.
