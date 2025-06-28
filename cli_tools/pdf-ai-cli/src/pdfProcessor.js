import fs from 'fs';
import path from 'path';

class PDFProcessor {
    constructor(apiKey, cacheDbPath = './tmp/pdf_cache.db') {
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is required");
        }
        
        this.apiKey = apiKey;
        this.modelId = 'gemini-2.5-pro-preview-05-06';
    }

    async initialize() {
        // No initialization needed without cache
    }

    async extractTextFromPDF(pdfPath) {
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF file not found: ${pdfPath}`);
        }

        const pdfFilename = path.basename(pdfPath);
        console.log(`Processing: ${pdfFilename}`);
        console.log(`Extracting text from: ${pdfFilename}`);

        try {
            // Read and encode PDF as base64
            const pdfBuffer = fs.readFileSync(pdfPath);
            const base64Data = pdfBuffer.toString('base64');

            // Prepare request payload
            const requestPayload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                inlineData: {
                                    mimeType: "application/pdf",
                                    data: base64Data
                                }
                            },
                            {
                                text: "Extract ALL text content from this PDF. Return only the plain text content without any formatting, headers, footers, or additional commentary. Preserve the original text structure and line breaks. Do not add explanations, summaries, or any other text - just return the extracted content."
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "text/plain"
                }
            };

            // Make API request
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestPayload)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
                throw new Error(`No content returned from Gemini for: ${pdfFilename}`);
            }

            const extractedText = result.candidates[0].content.parts[0].text.trim();
            
            return extractedText;

        } catch (error) {
            console.error(`Error processing ${pdfFilename}:`, error.message);
            throw error;
        }
    }
}

export default PDFProcessor;