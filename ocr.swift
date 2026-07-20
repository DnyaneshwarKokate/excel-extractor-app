import Foundation
import Vision
import AppKit
import PDFKit

func recognizeText(cgImage: CGImage) {
    let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest { (request, error) in
        guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            print(topCandidate.string)
        }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    try? requestHandler.perform([request])
}

let args = CommandLine.arguments
if args.count > 1 {
    let filePath = args[1]
    let fileURL = URL(fileURLWithPath: filePath)
    let ext = fileURL.pathExtension.lowercased()

    if ext == "pdf" {
        if let pdfDoc = PDFDocument(url: fileURL) {
            for i in 0..<pdfDoc.pageCount {
                if let page = pdfDoc.page(at: i) {
                    let pageRect = page.bounds(for: .mediaBox)
                    let image = NSImage(size: pageRect.size)
                    image.lockFocus()
                    if let context = NSGraphicsContext.current?.cgContext {
                        page.draw(with: .mediaBox, to: context)
                    }
                    image.unlockFocus()
                    if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                        recognizeText(cgImage: cgImage)
                    }
                }
            }
        }
    } else {
        if let image = NSImage(contentsOfFile: filePath),
           let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            recognizeText(cgImage: cgImage)
        }
    }
}
