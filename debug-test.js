const puppeteer = require('puppeteer');

async function testListing() {
    const browser = await puppeteer.launch({
        headless: false, // Run in visible mode for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        const listingNumber = 'W12372194';
        
        // Try the direct listing URL format first
        const directUrl = `https://www.realtor.ca/real-estate/28794985/1103-4675-metcalfe-avenue-mississauga-central-erin-mills-central-erin-mills`;
        console.log(`Testing direct URL: ${directUrl}`);
        
        await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'direct-listing.png', fullPage: true });
        
        // Extract address from direct listing page
        const addressFromDirect = await page.evaluate(() => {
            const selectors = [
                '[data-testid="listing-address"]',
                '.listingAddress',
                '.listing-address',
                '.address',
                'h1',
                '.property-address',
                '[data-cy="address"]'
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    return { selector, text: element.textContent.trim() };
                }
            }
            
            // Look for text that looks like an address
            const bodyText = document.body.innerText;
            const addressMatch = bodyText.match(/\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Circle|Cir|Court|Ct|Place|Pl|Way|Crescent|Cres)[^\\n]*/i);
            if (addressMatch) {
                return { selector: 'pattern-match', text: addressMatch[0] };
            }
            
            return { selector: 'none', text: 'Not found' };
        });
        
        console.log('Address from direct URL:', addressFromDirect);
        
        // Now try the search URL
        const searchUrl = `https://www.realtor.ca/map#ZoomLevel=1&Center=45.508888%2C-73.561668&LatitudeMax=85&LongitudeMax=-50&LatitudeMin=-85&LongitudeMin=-141&view=list&Sort=6-D&PropertyTypeGroupID=1&PropertySearchTypeId=1&TransactionTypeId=2&PriceMin=0&PriceMax=0&BedRange=0-0&BathRange=0-0&BuildingTypeId=1&Currency=CAD&MLS=${listingNumber}`;
        console.log(`\\nTesting search URL: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(5000); // Wait longer for search results
        
        // Take a screenshot of search results
        await page.screenshot({ path: 'search-results.png', fullPage: true });
        
        // Check what elements exist on the page
        const pageInfo = await page.evaluate(() => {
            const listingCards = document.querySelectorAll('.listingCardContainer, .listing-card, [data-testid="listing-card"], .listing');
            const noResults = document.querySelector('.no-results, .noResults, .no-listings');
            const errorMessages = document.querySelector('.error-message, .errorMessage');
            
            return {
                listingCards: listingCards.length,
                noResults: noResults ? noResults.textContent.trim() : 'none',
                errorMessages: errorMessages ? errorMessages.textContent.trim() : 'none',
                title: document.title,
                bodyContent: document.body.innerText.substring(0, 500)
            };
        });
        
        console.log('Search page info:', pageInfo);
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    // Keep browser open for manual inspection
    console.log('\\nBrowser is open for inspection. Close it manually when done.');
    // await browser.close();
}

testListing();