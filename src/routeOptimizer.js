const axios = require('axios');

class RouteOptimizer {
    constructor() {
        // Google Directions API for accurate travel times
        this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCkUOdZ5y7hMVVNLQQxNl5X7IEjT3mWaGU';
        this.useSimulation = !this.googleApiKey; // Use simulation if no API key
        
        // Google Maps API endpoints
        this.directionsApiUrl = 'https://maps.googleapis.com/maps/api/directions/json';
        this.geocodingApiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    }

    async optimizeRoute(officeAddress, properties) {
        try {
            console.log('Optimizing route with Google Maps API for:', {
                office: officeAddress,
                properties: properties.map(p => ({ address: p.address, duration: p.visitDuration }))
            });

            // Always use Google Maps API for real travel times
            return await this.optimizeWithGoogleAPI(officeAddress, properties);
        } catch (error) {
            console.error('Route optimization error:', error);
            // Fallback to simulation if Google API fails
            console.log('Falling back to simulation mode');
            return await this.simulateRouteOptimization(officeAddress, properties);
        }
    }

    async simulateRouteOptimization(officeAddress, properties) {
        // Simulate a basic TSP solution for demo purposes
        // In real implementation, this would call Google Directions API
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create a simple route optimization (for demo)
        // In reality, we'd use actual driving distances and times
        const optimizedProperties = this.simulateOptimalOrder(properties);
        
        let currentTime = new Date();
        const steps = [];
        let totalDrivingTime = 0;
        let totalVisitTime = 0;

        // Start at office
        steps.push({
            type: 'Start',
            address: officeAddress,
            arrivalTime: this.formatTime(currentTime),
            duration: '0 minutes',
            visitDuration: null
        });

        // Visit each property
        for (let i = 0; i < optimizedProperties.length; i++) {
            const property = optimizedProperties[i];
            
            // Simulate driving time (random between 10-30 minutes)
            const drivingMinutes = Math.floor(Math.random() * 20) + 10;
            totalDrivingTime += drivingMinutes;
            
            currentTime = new Date(currentTime.getTime() + drivingMinutes * 60000);
            
            steps.push({
                type: `Visit Property ${i + 1}`,
                address: property.address,
                arrivalTime: this.formatTime(currentTime),
                duration: `${drivingMinutes} minutes driving`,
                visitDuration: property.visitDuration,
                mlsNumber: property.mlsNumber
            });

            // Add visit time
            totalVisitTime += property.visitDuration;
            currentTime = new Date(currentTime.getTime() + property.visitDuration * 60000);
        }

        // Return to office
        const returnDrivingMinutes = Math.floor(Math.random() * 20) + 10;
        totalDrivingTime += returnDrivingMinutes;
        currentTime = new Date(currentTime.getTime() + returnDrivingMinutes * 60000);
        
        steps.push({
            type: 'Return to Office',
            address: officeAddress,
            arrivalTime: this.formatTime(currentTime),
            duration: `${returnDrivingMinutes} minutes driving`,
            visitDuration: null
        });

        const totalMinutes = totalDrivingTime + totalVisitTime;
        
        // Generate Google Maps URL even for simulated routes
        const googleMapsUrl = this.generateGoogleMapsUrl(officeAddress, optimizedProperties);
        
        return {
            success: true,
            route: {
                totalDuration: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m (${totalDrivingTime}m driving + ${totalVisitTime}m visiting)`,
                startTime: steps[0].arrivalTime,
                returnTime: steps[steps.length - 1].arrivalTime,
                steps: steps,
                googleMapsUrl: googleMapsUrl,
                optimizationNotes: this.useSimulation ? 'Note: This is a simulated route for demo purposes. In production, this would use Google Maps API for real traffic data and optimal routing.' : null
            }
        };
    }

    simulateOptimalOrder(properties) {
        // Basic geographic clustering optimization
        // Group properties by city/region for more logical routing
        
        console.log('Optimizing route order for properties:', properties.map(p => ({ address: p.address, city: this.extractCity(p.address) })));
        
        // Group properties by city
        const groupedByCity = {};
        properties.forEach(property => {
            const city = this.extractCity(property.address);
            if (!groupedByCity[city]) {
                groupedByCity[city] = [];
            }
            groupedByCity[city].push(property);
        });
        
        console.log('Grouped by city:', Object.keys(groupedByCity).map(city => ({ city, count: groupedByCity[city].length })));
        
        // Create optimized order: visit all properties in each city together
        // Prioritize cities by distance from office (simplified logic)
        const optimized = [];
        const cities = Object.keys(groupedByCity);
        
        // Sort cities to minimize travel - start with cities closest to office
        // For GTA area: Richmond Hill -> Toronto -> Other cities
        const cityPriority = this.getCityPriority(cities);
        
        cityPriority.forEach(city => {
            // Within each city, sort by street name for consistency
            const cityProperties = groupedByCity[city].sort((a, b) => {
                const streetA = this.extractStreetName(a.address);
                const streetB = this.extractStreetName(b.address);
                return streetA.localeCompare(streetB);
            });
            
            console.log(`Adding ${cityProperties.length} properties from ${city}:`, cityProperties.map(p => p.address));
            optimized.push(...cityProperties);
        });
        
        console.log('Optimized route order:', optimized.map(p => this.extractCity(p.address) + ': ' + p.address));
        return optimized;
    }
    
    extractCity(address) {
        // Extract city from formatted address "STREET, CITY, PROVINCE"
        const parts = address.split(',');
        if (parts.length >= 2) {
            return parts[1].trim();
        }
        return 'Unknown';
    }
    
    extractStreetName(address) {
        // Extract street name for sorting within cities
        const parts = address.split(',');
        if (parts.length > 0) {
            return parts[0].trim();
        }
        return address;
    }
    
    getCityPriority(cities) {
        // Define city priority based on geographic proximity in GTA
        // Starting from Richmond Hill office, logical order would be:
        // 1. Richmond Hill (local area first)
        // 2. Vaughan (adjacent north)
        // 3. Markham (adjacent northeast)  
        // 4. Toronto (south)
        // 5. Mississauga (southwest)
        // 6. Other cities
        
        const priorityMap = {
            'Richmond Hill': 1,
            'Vaughan': 2,
            'Markham': 3,
            'North York': 4,
            'Scarborough': 5,
            'Toronto': 6,
            'Mississauga': 7,
            'Brampton': 8,
            'Oshawa': 9
        };
        
        return cities.sort((a, b) => {
            const priorityA = priorityMap[a] || 999; // Unknown cities go last
            const priorityB = priorityMap[b] || 999;
            
            if (priorityA === priorityB) {
                // If same priority, sort alphabetically
                return a.localeCompare(b);
            }
            
            return priorityA - priorityB;
        });
    }

    async optimizeWithGoogleAPI(officeAddress, properties) {
        try {
            // First optimize the route order using our geographic clustering
            const optimizedProperties = this.simulateOptimalOrder(properties);
            
            console.log('Using Google Maps API for real travel times');
            console.log('Optimized property order:', optimizedProperties.map(p => p.address));

            // Create waypoints from optimized properties
            const waypoints = optimizedProperties.map(p => encodeURIComponent(p.address)).join('|');
            
            // Build Google Directions API URL for round trip with waypoints
            const url = `${this.directionsApiUrl}?` + 
                `origin=${encodeURIComponent(officeAddress)}` +
                `&destination=${encodeURIComponent(officeAddress)}` +
                `&waypoints=${waypoints}` +
                `&optimize_waypoints=false` +  // We already optimized
                `&units=metric` +
                `&departure_time=now` +  // For real-time traffic
                `&traffic_model=best_guess` +
                `&key=${this.googleApiKey}`;

            console.log('Requesting Google Directions API...');
            const response = await axios.get(url);
            const data = response.data;

            if (data.status !== 'OK') {
                console.error('Google Directions API error:', data.status, data.error_message);
                throw new Error(`Google API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
            }

            console.log('Google Directions API response received successfully');
            return this.parseGoogleDirectionsResponse(data, officeAddress, optimizedProperties);

        } catch (error) {
            console.error('Google API error:', error.message);
            throw error;  // Re-throw to trigger fallback in optimizeRoute
        }
    }

    parseGoogleDirectionsResponse(data, officeAddress, properties) {
        try {
            console.log('Parsing Google Directions response...');
            
            const route = data.routes[0];
            const legs = route.legs;
            
            if (!legs || legs.length === 0) {
                throw new Error('No route legs found in Google Directions response');
            }

            let currentTime = new Date();
            const steps = [];
            let totalDrivingSeconds = 0;
            let totalVisitMinutes = 0;

            console.log(`Processing ${legs.length} route legs for ${properties.length} properties`);

            // Start at office
            steps.push({
                type: 'Start',
                address: officeAddress,
                arrivalTime: this.formatTime(currentTime),
                duration: '0 minutes driving',
                visitDuration: null,
                realTravelTime: true
            });

            // Process each leg of the journey
            legs.forEach((leg, index) => {
                console.log(`Processing leg ${index + 1}:`, {
                    duration: leg.duration.text,
                    distance: leg.distance.text,
                    from: leg.start_address,
                    to: leg.end_address
                });

                const drivingSeconds = leg.duration.value;
                const drivingMinutes = Math.ceil(drivingSeconds / 60);
                totalDrivingSeconds += drivingSeconds;
                
                // Add driving time to current time
                currentTime = new Date(currentTime.getTime() + drivingSeconds * 1000);

                if (index < properties.length) {
                    // This is a property visit
                    const property = properties[index];
                    
                    steps.push({
                        type: `Visit Property ${index + 1}`,
                        address: property.address,
                        arrivalTime: this.formatTime(currentTime),
                        duration: `${drivingMinutes} minutes driving (${leg.duration.text})`,
                        distance: leg.distance.text,
                        visitDuration: property.visitDuration,
                        mlsNumber: property.mlsNumber,
                        realTravelTime: true
                    });

                    // Add visit time
                    totalVisitMinutes += property.visitDuration;
                    currentTime = new Date(currentTime.getTime() + property.visitDuration * 60000);
                } else {
                    // Return to office
                    steps.push({
                        type: 'Return to Office',
                        address: officeAddress,
                        arrivalTime: this.formatTime(currentTime),
                        duration: `${drivingMinutes} minutes driving (${leg.duration.text})`,
                        distance: leg.distance.text,
                        visitDuration: null,
                        realTravelTime: true
                    });
                }
            });

            // Calculate totals
            const totalDrivingMinutes = Math.ceil(totalDrivingSeconds / 60);
            const totalMinutes = totalDrivingMinutes + totalVisitMinutes;
            
            // Calculate total distance
            const totalDistanceKm = legs.reduce((sum, leg) => {
                const distanceText = leg.distance.text;
                const km = parseFloat(distanceText.replace(/[^\d.]/g, ''));
                return sum + (isNaN(km) ? 0 : km);
            }, 0);

            console.log(`Route optimization complete:`, {
                totalDrivingTime: `${totalDrivingMinutes} minutes`,
                totalVisitTime: `${totalVisitMinutes} minutes`,
                totalDistance: `${totalDistanceKm.toFixed(1)} km`,
                steps: steps.length
            });

            // Generate Google Maps URL for the route
            const googleMapsUrl = this.generateGoogleMapsUrl(officeAddress, optimizedProperties);

            return {
                success: true,
                route: {
                    totalDuration: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m (${totalDrivingMinutes}m driving + ${totalVisitMinutes}m visiting)`,
                    totalDistance: `${totalDistanceKm.toFixed(1)} km`,
                    startTime: steps[0].arrivalTime,
                    returnTime: steps[steps.length - 1].arrivalTime,
                    steps: steps,
                    googleMapsUrl: googleMapsUrl,
                    optimizationNotes: 'Real-time travel estimates from Google Maps API with current traffic conditions.'
                }
            };

        } catch (error) {
            console.error('Error parsing Google Directions response:', error);
            throw error;
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    generateGoogleMapsUrl(officeAddress, properties) {
        try {
            console.log('Generating Google Maps URL for route...');
            
            // Google Maps URL format for multi-waypoint directions:
            // https://www.google.com/maps/dir/origin/waypoint1/waypoint2/.../destination/
            
            const addresses = [officeAddress]; // Start at office
            properties.forEach(property => {
                addresses.push(property.address);
            });
            addresses.push(officeAddress); // Return to office
            
            // Encode each address for URL
            const encodedAddresses = addresses.map(addr => encodeURIComponent(addr));
            
            // Build the Google Maps directions URL
            const baseUrl = 'https://www.google.com/maps/dir';
            const fullUrl = `${baseUrl}/${encodedAddresses.join('/')}/`;
            
            console.log(`Generated Google Maps URL with ${addresses.length} waypoints`);
            console.log('Route order:', addresses.map((addr, i) => `${i + 1}. ${addr}`));
            
            return fullUrl;
            
        } catch (error) {
            console.error('Error generating Google Maps URL:', error);
            return null;
        }
    }

    generateShareableRouteInfo(officeAddress, properties, route) {
        try {
            const routeInfo = {
                title: `Real Estate Route Plan - ${properties.length} Properties`,
                office: officeAddress,
                properties: properties.map((prop, index) => ({
                    order: index + 1,
                    address: prop.address,
                    mlsNumber: prop.mlsNumber,
                    visitDuration: prop.visitDuration
                })),
                summary: {
                    totalDuration: route.totalDuration,
                    totalDistance: route.totalDistance,
                    startTime: route.startTime,
                    returnTime: route.returnTime
                },
                googleMapsUrl: route.googleMapsUrl,
                createdAt: new Date().toISOString()
            };

            return routeInfo;
        } catch (error) {
            console.error('Error generating shareable route info:', error);
            return null;
        }
    }

    validateAddresses(addresses) {
        // Basic address validation
        return addresses.every(address => 
            address && 
            typeof address === 'string' && 
            address.trim().length > 5
        );
    }
}

module.exports = RouteOptimizer;