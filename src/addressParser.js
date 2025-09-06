const axios = require('axios');

class AddressParser {
    constructor() {
        // Common Canadian street suffixes and their abbreviations
        this.streetSuffixes = {
            'avenue': 'Ave', 'ave': 'Ave',
            'street': 'St', 'st': 'St',
            'road': 'Rd', 'rd': 'Rd',
            'drive': 'Dr', 'dr': 'Dr',
            'boulevard': 'Blvd', 'blvd': 'Blvd',
            'lane': 'Ln', 'ln': 'Ln',
            'court': 'Ct', 'ct': 'Ct',
            'circle': 'Cir', 'cir': 'Cir',
            'crescent': 'Cres', 'cres': 'Cres',
            'place': 'Pl', 'pl': 'Pl',
            'way': 'Way',
            'terrace': 'Terr', 'terr': 'Terr'
        };

        // Canadian provinces and common city patterns
        this.provinces = ['ontario', 'quebec', 'british columbia', 'alberta', 'manitoba', 'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland', 'prince edward island', 'northwest territories', 'nunavut', 'yukon'];
    }

    parseAddressFromUrl(urlSlug) {
        try {
            console.log(`Parsing address from URL slug: ${urlSlug}`);
            
            // Clean and split the URL slug
            const parts = urlSlug
                .toLowerCase()
                .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
                .split('-')
                .filter(part => part.length > 0);

            console.log('URL parts:', parts);

            if (parts.length < 3) {
                return { success: false, message: 'URL slug too short to parse address' };
            }

            // Parse the address components using intelligent logic
            const parsed = this.intelligentAddressParsing(parts);
            
            if (parsed.success) {
                return {
                    success: true,
                    address: parsed.address,
                    components: parsed.components
                };
            }

            return { success: false, message: 'Could not parse address from URL' };

        } catch (error) {
            console.error('Error parsing address:', error);
            return { success: false, message: 'Error parsing address' };
        }
    }

    intelligentAddressParsing(parts) {
        try {
            let streetNumber = '';
            let unitNumber = '';
            let streetName = [];
            let streetType = '';
            let city = '';
            let neighborhood = '';
            
            let i = 0;

            // Extract unit number if it exists (usually at the beginning)
            if (parts[i] && this.isNumeric(parts[i]) && parts[i+1] && this.isNumeric(parts[i+1])) {
                // Format: "908-15" = Unit 908, 15 Street
                unitNumber = parts[i];
                streetNumber = parts[i+1];
                i += 2;
            } else if (parts[i] && this.isNumeric(parts[i])) {
                // Simple street number
                streetNumber = parts[i];
                i += 1;
            }

            // Extract street name and type
            while (i < parts.length) {
                const part = parts[i];
                
                // Check if this part is a street suffix
                if (this.streetSuffixes[part]) {
                    streetType = this.streetSuffixes[part];
                    i += 1;
                    break;
                } else if (this.isLikelyCity(part, parts.slice(i))) {
                    // We've hit the city part
                    break;
                } else {
                    streetName.push(this.capitalizeWord(part));
                    i += 1;
                }
            }

            // Extract city (handle multi-word cities)
            if (i < parts.length) {
                const currentPart = parts[i].toLowerCase();
                const remainingParts = parts.slice(i + 1);
                
                // Handle multi-word cities
                if (currentPart === 'richmond' && remainingParts.length > 0 && remainingParts[0].toLowerCase() === 'hill') {
                    city = 'Richmond Hill';
                    i += 2;
                } else if (currentPart === 'north' && remainingParts.length > 0 && remainingParts[0].toLowerCase() === 'york') {
                    city = 'North York';
                    i += 2;
                } else if (currentPart === 'east' && remainingParts.length > 0 && remainingParts[0].toLowerCase() === 'york') {
                    city = 'East York';
                    i += 2;
                } else {
                    // Handle specific city corrections based on URL patterns
                    if (currentPart === 'oshawa') {
                        city = 'Oshawa';
                        i += 1;
                    } else if (currentPart === 'e' && parts.includes('oshawa')) {
                        // This is likely "STREET E, OSHAWA" pattern
                        streetName.push('E');
                        const oshawaIndex = parts.indexOf('oshawa');
                        city = 'Oshawa';
                        i = oshawaIndex + 1;
                    } else if (currentPart === 'vaughan') {
                        city = 'Vaughan';
                        i += 1;
                    } else if (currentPart === 'n' && parts.includes('vaughan')) {
                        // Handle "WAY N, VAUGHAN" pattern
                        streetName.push('N');
                        const vaughanIndex = parts.indexOf('vaughan');
                        city = 'Vaughan';
                        i = vaughanIndex + 1;
                    } else {
                        city = this.capitalizeWord(parts[i]);
                        i += 1;
                    }
                }
            }

            // The rest might be neighborhood/area information
            if (i < parts.length) {
                neighborhood = parts.slice(i)
                    .map(part => this.capitalizeWord(part))
                    .join(' ');
            }

            // Construct the formatted address
            const addressComponents = {
                unitNumber,
                streetNumber,
                streetName: streetName.join(' '),
                streetType,
                city,
                neighborhood
            };

            const formattedAddress = this.formatAddress(addressComponents);

            console.log('Parsed components:', addressComponents);
            console.log('Formatted address:', formattedAddress);

            return {
                success: true,
                address: formattedAddress,
                components: addressComponents
            };

        } catch (error) {
            console.error('Error in intelligent parsing:', error);
            return { success: false };
        }
    }

    formatAddress(components) {
        let address = '';

        // Add unit number if exists
        if (components.unitNumber) {
            address += `${components.unitNumber} - `;
        }

        // Add street number
        if (components.streetNumber) {
            address += `${components.streetNumber} `;
        }

        // Add street name
        if (components.streetName) {
            address += `${components.streetName.toUpperCase()} `;
        }

        // Add street type
        if (components.streetType) {
            address += `${components.streetType.toUpperCase()}`;
        }

        // Add city and province with comma separation (skip neighborhood/region)
        if (components.city) {
            address += `, ${components.city}, Ontario`; // Default to Ontario for now
        }

        return address.trim();
    }

    isNumeric(str) {
        return /^\d+$/.test(str);
    }

    isLikelyCity(part, remainingParts) {
        // Canadian major cities (including multi-word cities)
        const majorCities = [
            'toronto', 'montreal', 'vancouver', 'calgary', 'edmonton', 'ottawa', 'winnipeg',
            'quebec', 'hamilton', 'kitchener', 'london', 'victoria', 'halifax', 'oshawa',
            'windsor', 'saskatoon', 'regina', 'sherbrooke', 'barrie', 'kelowna', 'abbotsford',
            'kingston', 'sudbury', 'saguenay', 'trois-rivieres', 'guelph', 'cambridge',
            'whitby', 'ajax', 'langley', 'saanich', 'terrebonne', 'milton', 'st-catharines',
            'new-westminster', 'coquitlam', 'richmond', 'burlington', 'burnaby', 'laval',
            'longueuil', 'mississauga', 'brampton', 'markham', 'vaughan', 'richmond-hill'
        ];

        // Check for multi-word city names
        const lowerPart = part.toLowerCase();
        
        // Handle "richmond hill" specifically
        if (lowerPart === 'richmond' && remainingParts.length > 0 && remainingParts[0].toLowerCase() === 'hill') {
            return true;
        }
        
        // Handle other specific cases
        if (lowerPart === 'north' && remainingParts.length > 0 && remainingParts[0].toLowerCase() === 'york') {
            return true;
        }
        
        return majorCities.includes(lowerPart) || 
               (remainingParts.length <= 3); // If we're near the end, it's probably city/neighborhood
    }

    capitalizeWord(word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    // Future: Add Google Maps validation
    async validateAddressWithMaps(address) {
        // This would integrate with Google Maps Geocoding API
        // For now, return the address as-is
        return {
            success: true,
            address: address,
            confidence: 'medium'
        };
    }
}

module.exports = AddressParser;