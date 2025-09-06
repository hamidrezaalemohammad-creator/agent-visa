const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class DocumentProcessor {
    constructor() {
        this.supportedFormats = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'];
        
        // Canadian MLS patterns - covers different formats
        this.mlsPatterns = [
            /MLS[#\s:]*([A-Z]\d{7,8})/gi,           // MLS# W12372194
            /MLS[#\s:]*([A-Z]\d{6,7}-[A-Z]?)/gi,    // MLS# W123456-A
            /\b([A-Z]\d{7,8})\b/g,                   // Standalone W12372194
            /Listing[#\s:]*([A-Z]\d{7,8})/gi,       // Listing# W12372194
            /Property[#\s:]*([A-Z]\d{7,8})/gi,      // Property# W12372194
            /Reference[#\s:]*([A-Z]\d{7,8})/gi      // Reference# W12372194
        ];

        // Common address patterns for Canadian real estate
        this.addressPatterns = [
            // Full address with unit: 123-456 Main Street, Toronto, ON
            /(\d+[-\s]?\d*)\s+([A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Cir|Circle|Cres|Crescent|Pl|Place|Way|Terr|Terrace)\.?)\s*,?\s*([A-Za-z\s]+),?\s*(ON|Ontario|BC|British Columbia|AB|Alberta|QC|Quebec|MB|Manitoba|SK|Saskatchewan|NS|Nova Scotia|NB|New Brunswick|NL|Newfoundland|PE|Prince Edward Island)/gi,
            
            // Address without province: 123 Main Street, Toronto
            /(\d+[-\s]?\d*)\s+([A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Cir|Circle|Cres|Crescent|Pl|Place|Way|Terr|Terrace)\.?)\s*,\s*([A-Za-z\s]+)/gi,
            
            // Simple street address: 123 Main Street
            /(\d+[-\s]?\d*)\s+([A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Cir|Circle|Cres|Crescent|Pl|Place|Way|Terr|Terrace)\.?)/gi
        ];

        console.log('Document Processor initialized');
        console.log('Supported formats:', this.supportedFormats);
    }

    async processDocument(filePath, originalFileName = null) {
        try {
            console.log(`Processing document: ${filePath}`);
            console.log(`Original filename: ${originalFileName}`);
            
            // Try to get extension from original filename first, then from file path
            let fileExtension = '';
            if (originalFileName) {
                fileExtension = path.extname(originalFileName).toLowerCase();
                console.log(`Extension from original filename: "${fileExtension}"`);
            }
            
            if (!fileExtension) {
                fileExtension = path.extname(filePath).toLowerCase();
                console.log(`Extension from file path: "${fileExtension}"`);
            }
            
            if (!fileExtension) {
                // Try to detect file type from file content or default to image processing
                console.log('No file extension detected, attempting image processing...');
                const extractedText = await this.extractTextFromImage(filePath);
                const results = this.parsePropertyInfo(extractedText);
                return {
                    success: true,
                    extractedText: extractedText,
                    ...results
                };
            }
            
            if (!this.supportedFormats.includes(fileExtension)) {
                throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: ${this.supportedFormats.join(', ')}`);
            }

            let extractedText = '';

            if (fileExtension === '.pdf') {
                extractedText = await this.extractTextFromPDF(filePath);
            } else {
                // Image files (jpg, png, etc.)
                extractedText = await this.extractTextFromImage(filePath);
            }

            console.log(`Extracted text length: ${extractedText.length} characters`);
            console.log('Text preview:', extractedText.substring(0, 200) + '...');

            // Parse MLS numbers and addresses from the text
            const results = this.parsePropertyInfo(extractedText);
            
            return {
                success: true,
                extractedText: extractedText,
                ...results
            };

        } catch (error) {
            console.error('Document processing error:', error);
            return {
                success: false,
                message: `Error processing document: ${error.message}`
            };
        }
    }

    async extractTextFromPDF(filePath) {
        try {
            console.log('Extracting text from PDF...');
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            console.log(`PDF processed: ${data.numpages} pages`);
            return data.text;
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    async extractTextFromImage(filePath) {
        try {
            console.log('Extracting text from image using OCR...');
            console.log(`Image file path: ${filePath}`);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`Image file not found: ${filePath}`);
            }

            // Optimize image for OCR
            const processedImagePath = await this.preprocessImage(filePath);
            console.log(`Using image path for OCR: ${processedImagePath}`);
            
            // Use Tesseract.js for OCR with more options
            const { data: { text } } = await Tesseract.recognize(processedImagePath, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-#:$',
                tessedit_pageseg_mode: Tesseract.PSM.AUTO
            });

            // Clean up processed image if it's different from original
            if (processedImagePath !== filePath) {
                try {
                    fs.unlinkSync(processedImagePath);
                } catch (cleanupError) {
                    console.log('Warning: Could not clean up processed image:', cleanupError.message);
                }
            }

            console.log('OCR completed successfully');
            console.log(`Extracted ${text.length} characters from image`);
            return text;
        } catch (error) {
            console.error('OCR extraction error:', error);
            throw new Error(`Failed to extract text from image: ${error.message}`);
        }
    }

    async preprocessImage(filePath) {
        try {
            // Create a proper temporary filename
            const tempDir = path.dirname(filePath);
            const baseName = path.basename(filePath, path.extname(filePath));
            const processedPath = path.join(tempDir, `${baseName}_processed.png`);
            
            console.log(`Preprocessing image from ${filePath} to ${processedPath}`);
            
            // Enhance image for better OCR results
            await sharp(filePath)
                .grayscale() // Convert to grayscale for better OCR
                .normalize() // Normalize contrast
                .sharpen({ sigma: 1 }) // Sharpen text moderately
                .modulate({ 
                    brightness: 1.1, // Slightly brighter
                    contrast: 1.2,   // More contrast
                    saturation: 0     // Remove color (already grayscale)
                })
                .resize({ 
                    width: 1600, 
                    height: 1600, 
                    fit: 'inside', 
                    withoutEnlargement: false // Allow upscaling for small images
                })
                .png({ quality: 95 }) // High quality PNG
                .toFile(processedPath);
                
            console.log('Image preprocessed successfully for OCR');
            return processedPath;
        } catch (error) {
            console.log('Image preprocessing failed, using original:', error.message);
            return filePath; // Return original if preprocessing fails
        }
    }

    parsePropertyInfo(text) {
        const results = {
            mlsNumbers: [],
            addresses: [],
            propertyDetails: {}
        };

        try {
            // Extract MLS numbers
            console.log('Searching for MLS numbers...');
            for (const pattern of this.mlsPatterns) {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                    const mlsNumber = match[1].toUpperCase().trim();
                    if (mlsNumber && !results.mlsNumbers.includes(mlsNumber)) {
                        results.mlsNumbers.push(mlsNumber);
                        console.log(`Found MLS: ${mlsNumber}`);
                    }
                });
            }

            // Extract addresses
            console.log('Searching for addresses...');
            for (const pattern of this.addressPatterns) {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                    let address = '';
                    
                    if (match.length >= 4) {
                        // Full address with province
                        const unit = match[1];
                        const street = match[2].trim();
                        const city = match[3].trim();
                        const province = match[4];
                        address = `${unit} ${street}, ${city}, ${province}`;
                    } else if (match.length >= 3) {
                        // Address without province
                        const unit = match[1];
                        const street = match[2].trim();
                        const city = match[3].trim();
                        address = `${unit} ${street}, ${city}`;
                    } else if (match.length >= 2) {
                        // Simple street address
                        const unit = match[1];
                        const street = match[2].trim();
                        address = `${unit} ${street}`;
                    }
                    
                    if (address && !results.addresses.some(addr => 
                        addr.toLowerCase().includes(address.toLowerCase()) || 
                        address.toLowerCase().includes(addr.toLowerCase())
                    )) {
                        results.addresses.push(address);
                        console.log(`Found address: ${address}`);
                    }
                });
            }

            // Extract additional property details
            results.propertyDetails = this.extractPropertyDetails(text);

            console.log(`Parsing complete: ${results.mlsNumbers.length} MLS numbers, ${results.addresses.length} addresses`);

        } catch (error) {
            console.error('Error parsing property info:', error);
        }

        return results;
    }

    extractPropertyDetails(text) {
        const details = {};

        try {
            // Extract price
            const priceMatch = text.match(/\$[\d,]+/g);
            if (priceMatch) {
                details.prices = priceMatch.map(p => p.replace(/,/g, ''));
            }

            // Extract bedrooms
            const bedroomMatch = text.match(/(\d+)\s*bed(?:room)?s?/gi);
            if (bedroomMatch) {
                details.bedrooms = bedroomMatch[0].match(/\d+/)[0];
            }

            // Extract bathrooms
            const bathroomMatch = text.match(/(\d+(?:\.\d+)?)\s*bath(?:room)?s?/gi);
            if (bathroomMatch) {
                details.bathrooms = bathroomMatch[0].match(/\d+(?:\.\d+)?/)[0];
            }

            // Extract square footage
            const sqftMatch = text.match(/(\d+,?\d*)\s*sq\.?\s*ft\.?/gi);
            if (sqftMatch) {
                details.squareFootage = sqftMatch[0].match(/\d+,?\d*/)[0].replace(/,/g, '');
            }

            // Extract property type
            const typePatterns = [
                /\b(detached|semi-detached|townhouse|condo|condominium|apartment|duplex|triplex|bungalow|ranch|colonial)\b/gi
            ];
            
            for (const pattern of typePatterns) {
                const typeMatch = text.match(pattern);
                if (typeMatch) {
                    details.propertyType = typeMatch[0].toLowerCase();
                    break;
                }
            }

        } catch (error) {
            console.error('Error extracting property details:', error);
        }

        return details;
    }

    cleanupTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up temporary file: ${filePath}`);
            }
        } catch (error) {
            console.error('Error cleaning up temp file:', error);
        }
    }

    // Validate if extracted MLS looks legitimate
    isValidMLS(mlsNumber) {
        // Canadian MLS numbers typically follow patterns like:
        // W12372194, N5678901, C1234567, etc.
        const validPatterns = [
            /^[A-Z]\d{7,8}$/,           // Single letter + 7-8 digits
            /^[A-Z]\d{6,7}-[A-Z]?$/     // Letter + digits + dash + optional letter
        ];

        return validPatterns.some(pattern => pattern.test(mlsNumber));
    }
}

module.exports = DocumentProcessor;