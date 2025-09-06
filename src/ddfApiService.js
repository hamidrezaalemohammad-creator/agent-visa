const axios = require('axios');

class DDFApiService {
    constructor() {
        // DDF API endpoints
        this.authUrl = 'https://identity.crea.ca/connect/token';
        this.apiBaseUrl = 'https://api.crea.ca/odata/v1';
        
        // Credentials - these should be provided by the user or environment variables
        this.clientId = process.env.DDF_CLIENT_ID || null;
        this.clientSecret = process.env.DDF_CLIENT_SECRET || null;
        
        // Token management
        this.accessToken = null;
        this.tokenExpiry = null;
        
        console.log('DDF API Service initialized');
        console.log(`Auth URL: ${this.authUrl}`);
        console.log(`API Base URL: ${this.apiBaseUrl}`);
        console.log(`Client ID configured: ${!!this.clientId}`);
    }

    // Authenticate and get access token
    async authenticate() {
        try {
            if (!this.clientId || !this.clientSecret) {
                throw new Error('DDF API credentials not configured. Please set DDF_CLIENT_ID and DDF_CLIENT_SECRET environment variables.');
            }

            console.log('Authenticating with DDF API...');

            const response = await axios.post(this.authUrl, {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'DDFApi_Read'
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
            });

            if (response.data.access_token) {
                this.accessToken = response.data.access_token;
                // Token expires in 60 minutes, set expiry time
                this.tokenExpiry = Date.now() + (59 * 60 * 1000); // 59 minutes to be safe
                
                console.log('DDF API authentication successful');
                console.log(`Token expires in: ${Math.floor((this.tokenExpiry - Date.now()) / 60000)} minutes`);
                
                return true;
            } else {
                throw new Error('No access token received from DDF API');
            }

        } catch (error) {
            console.error('DDF API authentication failed:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }

    // Check if token is valid and refresh if needed
    async ensureValidToken() {
        if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
            console.log('Token expired or missing, authenticating...');
            await this.authenticate();
        }
        return this.accessToken;
    }

    // Search for property by MLS number
    async searchPropertyByMLS(mlsNumber) {
        try {
            console.log(`Searching for property with MLS: ${mlsNumber}`);
            
            await this.ensureValidToken();

            // Clean MLS number (remove spaces, convert to uppercase)
            const cleanMLS = mlsNumber.toString().replace(/\s+/g, '').toUpperCase();
            
            // Query the Property endpoint with OData filter
            const url = `${this.apiBaseUrl}/Property`;
            const params = {
                '$filter': `ListingKey eq '${cleanMLS}' or MlsNumber eq '${cleanMLS}'`,
                '$select': 'ListingKey,MlsNumber,UnparsedAddress,City,StateOrProvince,PostalCode,Country,PropertyType,ListPrice,BedroomsTotal,BathroomsTotal',
                '$top': 1
            };

            console.log('DDF API Request URL:', url);
            console.log('DDF API Query params:', params);

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'AgentVista/1.0'
                },
                params: params,
                timeout: 30000
            });

            if (response.data && response.data.value && response.data.value.length > 0) {
                const property = response.data.value[0];
                
                console.log('Property found via DDF API:', {
                    MlsNumber: property.MlsNumber,
                    Address: property.UnparsedAddress,
                    City: property.City,
                    Province: property.StateOrProvince
                });

                // Format the address in Canadian format
                const formattedAddress = this.formatCanadianAddress(property);
                
                return {
                    success: true,
                    address: formattedAddress,
                    property: {
                        mlsNumber: property.MlsNumber || property.ListingKey,
                        address: formattedAddress,
                        city: property.City,
                        province: property.StateOrProvince,
                        postalCode: property.PostalCode,
                        propertyType: property.PropertyType,
                        price: property.ListPrice,
                        bedrooms: property.BedroomsTotal,
                        bathrooms: property.BathroomsTotal
                    }
                };

            } else {
                console.log(`No property found for MLS: ${mlsNumber}`);
                return {
                    success: false,
                    message: "Listing Does not Exist."
                };
            }

        } catch (error) {
            console.error('Error searching property via DDF API:', error.message);
            
            if (error.response) {
                console.error('DDF API Response status:', error.response.status);
                console.error('DDF API Response data:', error.response.data);
                
                // Handle specific error cases
                if (error.response.status === 401) {
                    // Token expired, try to re-authenticate
                    console.log('Authentication failed, clearing token...');
                    this.accessToken = null;
                    this.tokenExpiry = null;
                    throw new Error('DDF API authentication failed. Please check credentials.');
                }
            }
            
            throw new Error(`DDF API search failed: ${error.message}`);
        }
    }

    // Format address in Canadian format
    formatCanadianAddress(property) {
        try {
            let address = '';
            
            // Use UnparsedAddress if available, otherwise build from components
            if (property.UnparsedAddress) {
                address = property.UnparsedAddress.trim();
            }
            
            // Add city and province
            if (property.City) {
                address += address ? `, ${property.City}` : property.City;
            }
            
            if (property.StateOrProvince) {
                address += address ? `, ${property.StateOrProvince}` : property.StateOrProvince;
            }
            
            return address || 'Address not available';
            
        } catch (error) {
            console.error('Error formatting address:', error);
            return property.UnparsedAddress || 'Address formatting error';
        }
    }

    // Get property details (extended information)
    async getPropertyDetails(mlsNumber) {
        try {
            await this.ensureValidToken();

            const cleanMLS = mlsNumber.toString().replace(/\s+/g, '').toUpperCase();
            
            const url = `${this.apiBaseUrl}/Property`;
            const params = {
                '$filter': `ListingKey eq '${cleanMLS}' or MlsNumber eq '${cleanMLS}'`,
                '$select': '*', // Get all fields for detailed view
                '$top': 1
            };

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                },
                params: params,
                timeout: 30000
            });

            if (response.data && response.data.value && response.data.value.length > 0) {
                return {
                    success: true,
                    property: response.data.value[0]
                };
            } else {
                return {
                    success: false,
                    message: "Property not found"
                };
            }

        } catch (error) {
            console.error('Error getting property details:', error);
            throw error;
        }
    }

    // Test API connection
    async testConnection() {
        try {
            console.log('Testing DDF API connection...');
            
            if (!this.clientId || !this.clientSecret) {
                return {
                    success: false,
                    message: 'DDF API credentials not configured'
                };
            }

            await this.authenticate();
            
            // Try a simple query to test the connection
            const url = `${this.apiBaseUrl}/Property`;
            const params = {
                '$top': 1,
                '$select': 'ListingKey,MlsNumber'
            };

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                },
                params: params,
                timeout: 10000
            });

            if (response.data) {
                return {
                    success: true,
                    message: 'DDF API connection successful',
                    sampleData: response.data.value ? response.data.value[0] : null
                };
            }

        } catch (error) {
            console.error('DDF API connection test failed:', error.message);
            return {
                success: false,
                message: `Connection failed: ${error.message}`
            };
        }
    }
}

module.exports = DDFApiService;