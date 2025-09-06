# DDF API Setup Instructions

## Getting DDF API Credentials

1. **Visit the DDF API Documentation**
   - Go to: https://ddfapi-docs.realtor.ca/

2. **Register for API Access**
   - Click on "Getting Started" or "Register"
   - You'll need to create an account and request access
   - This may require approval from REALTOR.ca

3. **Get Your Credentials**
   - Once approved, you'll receive:
     - `Client ID` (DDF_CLIENT_ID)
     - `Client Secret` (DDF_CLIENT_SECRET)

## Setting Up Your Environment

1. **Edit the .env file**
   ```bash
   # Open the .env file in your project root
   nano .env
   ```

2. **Replace the placeholder values**
   ```env
   # Replace these with your actual credentials
   DDF_CLIENT_ID=your_actual_client_id_here
   DDF_CLIENT_SECRET=your_actual_client_secret_here
   ```

3. **Optional: Add Google Maps API Key**
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

## Testing the Setup

1. **Start the server**
   ```bash
   npm start
   ```

2. **Test with a real MLS number**
   ```bash
   curl -X POST http://localhost:3000/search \
     -H "Content-Type: application/json" \
     -d '{"listingNumber": "W12372194"}'
   ```

3. **Check the logs**
   - If DDF API is working: You'll see "DDF API success"
   - If credentials are wrong: You'll see authentication errors
   - If no credentials: Falls back to web scraping

## Security Notes

- ✅ The `.env` file is already in `.gitignore`
- ✅ Never commit API credentials to version control
- ✅ Keep your credentials secure and private

## Troubleshooting

- **"Client ID configured: false"** - Check your .env file syntax
- **"DDF API authentication failed"** - Verify your credentials are correct
- **"Property not found"** - Try a different MLS number or check if it exists

## Benefits of DDF API

- ✅ Official REALTOR.ca data source
- ✅ Real-time MLS information
- ✅ No web scraping required
- ✅ Structured data with all property details
- ✅ More reliable than screen scraping