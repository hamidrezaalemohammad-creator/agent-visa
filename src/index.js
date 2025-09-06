require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const RealtorScraper = require('./scraper');
const RouteOptimizer = require('./routeOptimizer');
const DocumentProcessor = require('./documentProcessor');

const app = express();
const port = process.env.PORT || 3000;
const scraper = new RealtorScraper();
const routeOptimizer = new RouteOptimizer();
const documentProcessor = new DocumentProcessor();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/bmp',
            'image/tiff',
            'image/webp'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload PDF, JPG, PNG, BMP, TIFF, or WebP files.'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Document upload and processing endpoint
app.post('/upload-document', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.json({ success: false, message: 'No document uploaded.' });
    }

    try {
        console.log(`Processing uploaded document: ${req.file.originalname}`);
        console.log(`File type: ${req.file.mimetype}, Size: ${req.file.size} bytes`);

        // Process the document with original filename context
        const result = await documentProcessor.processDocument(req.file.path, req.file.originalname);

        // Clean up uploaded file
        documentProcessor.cleanupTempFile(req.file.path);

        if (result.success) {
            console.log(`Document processed successfully:`);
            console.log(`- MLS Numbers: ${result.mlsNumbers.length}`);
            console.log(`- Addresses: ${result.addresses.length}`);

            // If we found MLS numbers, try to get full property info for the first one
            if (result.mlsNumbers.length > 0) {
                console.log(`Attempting to get full property info for MLS: ${result.mlsNumbers[0]}`);
                try {
                    const propertyResult = await scraper.searchListing(result.mlsNumbers[0]);
                    if (propertyResult.success) {
                        result.primaryProperty = {
                            mlsNumber: result.mlsNumbers[0],
                            address: propertyResult.address,
                            fullData: propertyResult.property || {}
                        };
                    }
                } catch (searchError) {
                    console.log('Could not fetch full property data:', searchError.message);
                }
            }
        }

        res.json(result);

    } catch (error) {
        console.error('Document processing error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            documentProcessor.cleanupTempFile(req.file.path);
        }
        res.json({ 
            success: false, 
            message: 'An error occurred while processing the document.' 
        });
    }
});

app.post('/search', async (req, res) => {
    const { listingNumber } = req.body;
    
    if (!listingNumber) {
        return res.json({ success: false, message: 'Listing number is required.' });
    }
    
    try {
        console.log(`Received search request for listing: ${listingNumber}`);
        const result = await scraper.searchListing(listingNumber);
        res.json(result);
    } catch (error) {
        console.error('Error processing search request:', error);
        res.json({ success: false, message: 'An error occurred while processing your request.' });
    }
});

app.post('/optimize-route', async (req, res) => {
    const { officeAddress, properties } = req.body;
    
    if (!officeAddress) {
        return res.json({ success: false, message: 'Office address is required.' });
    }
    
    if (!properties || !Array.isArray(properties) || properties.length === 0) {
        return res.json({ success: false, message: 'At least one property is required.' });
    }
    
    if (properties.length > 5) {
        return res.json({ success: false, message: 'Maximum of 5 properties allowed.' });
    }
    
    try {
        console.log(`Received route optimization request for ${properties.length} properties`);
        console.log('Office:', officeAddress);
        console.log('Properties:', properties.map(p => ({ mls: p.mlsNumber, address: p.address })));
        
        const result = await routeOptimizer.optimizeRoute(officeAddress, properties);
        res.json(result);
    } catch (error) {
        console.error('Error processing route optimization:', error);
        res.json({ success: false, message: 'An error occurred while optimizing the route. Please try again.' });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing browser...');
    await scraper.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing browser...');
    await scraper.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Agent Vista server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server');
});