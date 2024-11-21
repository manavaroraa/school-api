const http = require('http');
const { parse } = require('querystring');
const mysql = require('mysql2');

// Create a connection to the MySQL database
const connection = mysql.createConnection({
    host: 'sql12.freesqldatabase.com', // or remote server IP
    user: 'sql12746357', 
    password: 'jgekCgeSDu',
    database: 'sql12746357',
    // port: 3306,  // Ensure the port is correct (default MySQL port is 3306)
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ' + err.stack);
        return;
    }
    console.log('Connected to the database');
});

// Haversine function to calculate distance between two lat/lon points
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
}

// Create HTTP server to handle requests
http.createServer((req, res) => {
    // POST: Add School
    if (req.method === 'POST' && req.url === '/addSchool') {
        let body = '';

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', () => {
            try {
                const { name, address, latitude, longitude } = JSON.parse(body);

                // Validation
                if (!name || !address) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Name and Address are required' }));
                }
                if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid latitude' }));
                }
                if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid longitude' }));
                }

                // Insert school data into MySQL database
                const query = 'INSERT INTO school (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
                connection.query(query, [name, address, latitude, longitude], (err, result) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Failed to insert school', details: err.message }));
                    }

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        message: 'School added successfully',
                        school: { name, address, latitude, longitude }
                    }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Failed to process request', details: error.message }));
            }
        });
    } 

    // GET: List Schools
    else if (req.method === 'GET' && req.url.startsWith('/listSchool')) {
        const query = parse(req.url.split('?')[1]);
        const { latitude, longitude } = query;

        if (!latitude || !longitude) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Latitude and Longitude are required' }));
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        if (isNaN(userLat) || isNaN(userLon)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid latitude or longitude' }));
        }

        // Query to get school data from the database
        connection.query('SELECT * FROM school', (err, results) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Failed to retrieve schools', details: err.message }));
            }

            // Calculate the distance from the user's location for each school
            const schoolsWithDistance = results.map(school => {
                const distance = haversine(userLat, userLon, school.latitude, school.longitude);
                return {
                    name: school.name,
                    address: school.address,
                    distance: distance
                };
            });

            // Sort schools by distance
            schoolsWithDistance.sort((a, b) => a.distance - b.distance);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(schoolsWithDistance));
        });
    } 

    // 404 Not Found
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Not Found' }));
    }

}).listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});
