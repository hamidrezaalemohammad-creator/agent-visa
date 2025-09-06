const puppeteer = require('puppeteer');
const AddressParser = require('./addressParser');
const DDFApiService = require('./ddfApiService');

class RealtorScraper {
    constructor() {
        this.browser = null;
        this.addressParser = new AddressParser();
        this.ddfApi = new DDFApiService();
        
        console.log('RealtorScraper initialized with DDF API integration');
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    async searchListing(listingNumber) {
        console.log(`Searching for listing: ${listingNumber}`);
        
        // Try DDF API first (official REALTOR.ca API)
        try {
            console.log('Attempting DDF API lookup...');
            const ddfResult = await this.ddfApi.searchPropertyByMLS(listingNumber);
            
            if (ddfResult.success) {
                console.log(`DDF API success: ${ddfResult.address}`);
                return ddfResult;
            } else {
                console.log('DDF API: Property not found, falling back to web scraping');
            }
        } catch (error) {
            console.log('DDF API failed, falling back to web scraping:', error.message);
        }
        
        // Fallback to web scraping if DDF API fails
        console.log('Falling back to web scraping approach...');
        return await this.searchListingWithScraping(listingNumber);
    }

    async searchListingWithScraping(listingNumber) {
        if (!this.browser) {
            await this.init();
        }

        const page = await this.browser.newPage();
        
        try {
            // Set user agent to avoid bot detection
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            console.log(`Searching for listing: ${listingNumber}`);
            
            // Try direct MLS search URL approach first
            const directSearchUrl = `https://www.realtor.ca/map#ZoomLevel=13&Center=43.653226%2C-79.383184&LatitudeMax=43.73552&LongitudeMax=-79.19717&LatitudeMin=43.57093&LongitudeMin=-79.56919&Sort=6-D&PropertyTypeGroupID=1&PropertySearchTypeId=1&TransactionTypeId=2&Reference=${encodeURIComponent(listingNumber)}`;
            
            console.log(`Trying direct search URL approach for: ${listingNumber}`);
            await page.goto(directSearchUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait for search results to load
            await page.waitForTimeout(5000);
            
            // Check if we found a listing
            const foundListing = await this.checkForListing(page, listingNumber);
            if (foundListing) {
                return foundListing;
            }
            
            // If direct approach doesn't work, try the traditional search
            console.log('Direct search failed, trying traditional search approach');
            await page.goto('https://www.realtor.ca/', { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait for page to load
            await page.waitForTimeout(3000);
            
            // Find and use the search box to search for the MLS number
            try {
                // Updated search selectors for current realtor.ca website
                const searchSelectors = [
                    'input[data-testid="search-input"]',
                    'input[aria-label*="search"]',
                    'input[placeholder*="Enter a city"]',
                    'input[placeholder*="Enter an address"]',
                    'input[placeholder*="MLS"]',
                    'input[id*="search"]',
                    'input[class*="search"]',
                    '.autocomplete-input input',
                    '[data-cy="search-input"]',
                    'input[name="search"]',
                    '#searchInput',
                    '.search-input',
                    'input[type="text"]'
                ];
                
                let searchInput = null;
                for (const selector of searchSelectors) {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        // Get the first visible search input
                        for (const element of elements) {
                            const isVisible = await element.boundingBox();
                            if (isVisible) {
                                searchInput = element;
                                break;
                            }
                        }
                        if (searchInput) break;
                    }
                }
                
                if (!searchInput) {
                    console.log('Could not find search input, trying alternative approach');
                    // Try to find listings on current page
                    const currentPageListing = await this.checkForListing(page, listingNumber);
                    if (currentPageListing) {
                        return currentPageListing;
                    }
                    return { success: false, message: "Could not access search functionality. Please try again." };
                }
                
                // Clear any existing text and type the MLS number
                await searchInput.click({ clickCount: 3 }); // Triple click to select all
                await searchInput.type(listingNumber);
                
                // Submit the search
                await page.keyboard.press('Enter');
                
                // Wait for search results to load
                await page.waitForTimeout(5000);
                
                // Get the final URL after search and any redirects
                const finalUrl = page.url();
                console.log(`Final URL after search: ${finalUrl}`);
                
                // Check if we ended up on a listing page or search results
                if (finalUrl.includes('real-estate')) {
                    // We're on a specific listing page, parse the address from URL
                    const urlSlug = this.extractUrlSlug(finalUrl);
                    if (urlSlug) {
                        const parsedAddress = this.addressParser.parseAddressFromUrl(urlSlug);
                        if (parsedAddress.success) {
                            return { success: true, address: parsedAddress.address };
                        } else {
                            // Fallback to showing URL if parsing fails
                            return { success: true, address: `URL: ${finalUrl}` };
                        }
                    }
                }
                
                // If URL extraction didn't work, try to find and click on the listing result
                const listingFound = await page.evaluate((mlsNumber) => {
                    // Look for listing cards or links that contain the MLS number
                    const selectors = [
                        'a[href*="real-estate"]',
                        '.listing-card a',
                        '.listingCardContainer a',
                        '.search-result a',
                        'a[href*="/real-estate/"]'
                    ];
                    
                    for (const selector of selectors) {
                        const links = document.querySelectorAll(selector);
                        for (const link of links) {
                            if (link.href.toLowerCase().includes(mlsNumber.toLowerCase()) ||
                                link.textContent.includes(mlsNumber)) {
                                return link.href;
                            }
                        }
                    }
                    return null;
                }, listingNumber);
                
                if (listingFound) {
                    // Navigate to the listing page
                    await page.goto(listingFound, { waitUntil: 'networkidle2', timeout: 30000 });
                    await page.waitForTimeout(2000);
                    
                    const listingUrl = page.url();
                    console.log(`Listing page URL: ${listingUrl}`);
                    
                    const urlSlug = this.extractUrlSlug(listingUrl);
                    if (urlSlug) {
                        const parsedAddress = this.addressParser.parseAddressFromUrl(urlSlug);
                        if (parsedAddress.success) {
                            return { success: true, address: parsedAddress.address };
                        }
                    }
                }
                
                // If still no success, check if we're on a "no results" type page
                const pageContent = await page.evaluate(() => {
                    const bodyText = document.body.innerText.toLowerCase();
                    return {
                        hasNoResults: bodyText.includes('no properties found') || 
                                     bodyText.includes('no results') || 
                                     bodyText.includes('no listings'),
                        title: document.title
                    };
                });
                
                if (pageContent.hasNoResults) {
                    return { success: false, message: "Listing Does not Exist." };
                }
                
                return { success: false, message: "Listing found but address could not be extracted." };
                
            } catch (searchError) {
                console.error('Search error:', searchError);
                return { success: false, message: "An error occurred while searching for the listing." };
            }

        } catch (error) {
            console.error('Error scraping listing:', error);
            return { success: false, message: "An error occurred while searching for the listing." };
        } finally {
            await page.close();
        }
    }
    
    extractUrlSlug(url) {
        try {
            // Extract the URL slug containing address information
            // Expected format: https://www.realtor.ca/real-estate/[id]/[address-slug]
            const urlParts = url.split('/');
            
            if (urlParts.length >= 5 && urlParts[3] === 'real-estate') {
                // Get the address part (everything after the property ID)
                const addressSlug = urlParts.slice(5).join('/');
                return addressSlug;
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting URL slug:', error);
            return null;
        }
    }

    async checkForListing(page, listingNumber) {
        try {
            console.log(`Checking page for listing: ${listingNumber}`);
            
            // Wait a bit for dynamic content to load
            await page.waitForTimeout(3000);
            
            // Get current URL to check if we're on a listing page
            const currentUrl = page.url();
            console.log(`Current URL: ${currentUrl}`);
            
            // Check if URL contains 'real-estate' indicating a listing page
            if (currentUrl.includes('real-estate')) {
                const urlSlug = this.extractUrlSlug(currentUrl);
                if (urlSlug) {
                    const parsedAddress = this.addressParser.parseAddressFromUrl(urlSlug);
                    if (parsedAddress.success) {
                        console.log(`Found listing via URL: ${parsedAddress.address}`);
                        return { success: true, address: parsedAddress.address };
                    }
                }
            }
            
            // Look for MLS number on the page to confirm we found the right listing
            const pageContent = await page.evaluate((mls) => {
                const bodyText = document.body.innerText;
                const mlsPattern = new RegExp(mls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                return {
                    containsMLS: mlsPattern.test(bodyText),
                    hasListingContent: bodyText.includes('MLS') || 
                                     bodyText.includes('$') || 
                                     bodyText.includes('bedroom') ||
                                     bodyText.includes('bathroom'),
                    title: document.title,
                    url: window.location.href
                };
            }, listingNumber);
            
            if (pageContent.containsMLS && pageContent.hasListingContent) {
                console.log(`Found listing content for ${listingNumber}`);
                
                // Try to extract address from page content or URL
                const urlSlug = this.extractUrlSlug(pageContent.url);
                if (urlSlug) {
                    const parsedAddress = this.addressParser.parseAddressFromUrl(urlSlug);
                    if (parsedAddress.success) {
                        return { success: true, address: parsedAddress.address };
                    }
                }
            }
            
            // Check for "no results" or "not found" indicators
            const noResults = await page.evaluate(() => {
                const bodyText = document.body.innerText.toLowerCase();
                return bodyText.includes('no properties found') || 
                       bodyText.includes('no results') || 
                       bodyText.includes('no listings') ||
                       bodyText.includes('0 results');
            });
            
            if (noResults) {
                console.log(`No results found for ${listingNumber}`);
                return { success: false, message: "Listing Does not Exist." };
            }
            
            console.log(`Could not find listing ${listingNumber} on current page`);
            return null;
            
        } catch (error) {
            console.error('Error checking for listing:', error);
            return null;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = RealtorScraper;