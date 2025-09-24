/**
 * index.js
 * Node + Express backend for Map My Destination (DSA Capstone)
 *
 * - Serves static frontend files (no modification to your theme/video/images)
 * - POST /findRoutes  { places: ["From", "Mid1", ..., "To"], mode: "bfs"|"dfs" }
 * -> returns route options as JSON
 * - GET  /graph        -> returns adjacency list (for debugging)
 * - GET  /coords       -> returns city->pixel coordinates (for simulator)
 *
 */
/*Including all libraries required..*/
const express = require('express');//Easy to handle routes..
const bodyParser = require('body-parser');//This middleware helps server read the body of incoming requests
const cors = require('cors');//Helps to send request from one domain to another domain
const path = require('path');//This helps work with file and folder paths in a cross-platform safe way (Windows, Linux, etc.).

const app = express();// creating instance for getting routes and requests..
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files (index.html, css, videos, etc.)
app.use(express.static(path.join(__dirname, '/')));

// -----------------------------
// Graph data (weighted adjacency list)
// Based on real-world road connections and approximate distances in km
// -----------------------------

/*Variable graph that has several keys and each keys having adjacency lists as adjacent districs.. using list data structure*/
const GRAPH = {
  "chennai": { "vellore": 140, "trichy": 320, "pondicherry": 160, "salem": 340, "tirupati": 150 },
  "vellore": { "chennai": 140, "ooty": 390, "salem": 200, "hosur": 100, "kodaikanal": 360 },
  "pondicherry": { "chennai": 160, "cuddalore": 20, "villupuram": 40, "thanjavur": 170 },
  "cuddalore": { "pondicherry": 20, "thanjavur": 150, "trichy": 120 },
  "trichy": { "chennai": 320, "thanjavur": 60, "madurai": 160, "dindigul": 90, "salem": 140, "karur": 80 },
  "thanjavur": { "trichy": 60, "pudukottai": 55, "cuddalore": 150, "rameshwaram": 240 },
  "pudukottai": { "thanjavur": 55, "sivaganga": 50, "madurai": 95, "trichy": 90 },
  "sivaganga": { "pudukottai": 50, "madurai": 50, "rameshwaram": 100, "karaikudi": 25 },
  "madurai": { "trichy": 160, "sivaganga": 50, "coimbatore": 220, "kanyakumari": 240, "dindigul": 60, "tenkasi": 150 },
  "dindigul": { "trichy": 90, "madurai": 60, "palani": 60, "erode": 100 },
  "coimbatore": { "madurai": 220, "ooty": 90, "salem": 160, "erode": 100, "pollachi": 40 },
  "ooty": { "coimbatore": 90, "vellore": 390, "mysore": 130 },
  "pollachi": { "coimbatore": 40, "palani": 70, "kodaikanal": 130 },
  "palani": { "pollachi": 70, "dindigul": 60, "kodaikanal": 65 },
  "kanyakumari": { "madurai": 240, "thiruvananthapuram": 90 },
  "salem": { "chennai": 340, "trichy": 140, "coimbatore": 160, "dharmapuri": 60, "erode": 60 },
  "erode": { "coimbatore": 100, "salem": 60, "namakkal": 45, "dindigul": 100 },
  "rameshwaram": { "thanjavur": 240, "sivaganga": 100, "madurai": 170 },
  "kodaikanal": { "dindigul": 65, "madurai": 120, "palani": 65, "pollachi": 130, "vellore": 360 },
  "dharmapuri": { "salem": 60, "bangalore": 130, "hosur": 60 },
  "hosur": { "dharmapuri": 60, "bangalore": 40, "vellore": 100 },
  "karaikudi": { "sivaganga": 25, "pudukottai": 50, "rameshwaram": 120 },
  "tenkasi": { "madurai": 150, "tirunelveli": 55, "kanyakumari": 120 },
  "tirunelveli": { "tenkasi": 55, "madurai": 150, "kanyakumari": 85, "tuticorin": 55 },
  "tuticorin": { "tirunelveli": 55, "madurai": 130 }
};
/*Mapping of each cities and districts to particualr pixels based on the integration of google maps */
const COORDS = {
  "chennai": { x: 520, y: 80 },
  "vellore": { x: 420, y: 140 },
  "pondicherry": { x: 520, y: 170 },
  "cuddalore": { x: 500, y: 230 },
  "trichy": { x: 340, y: 220 },
  "thanjavur": { x: 310, y: 270 },
  "pudukottai": { x: 280, y: 320 },
  "sivaganga": { x: 240, y: 360 },
  "madurai": { x: 200, y: 420 },
  "dindigul": { x: 270, y: 300 },
  "coimbatore": { x: 90, y: 320 },
  "ooty": { x: 60, y: 260 },
  "pollachi": { x: 120, y: 360 },
  "palani": { x: 170, y: 290 },
  "kanyakumari": { x: 220, y: 520 },
  "salem": { x: 280, y: 220 },
  "erode": { x: 210, y: 270 },
  "rameshwaram": { x: 350, y: 450 },
  "kodaikanal": { x: 220, y: 350 },
  "dharmapuri": { x: 280, y: 180 },
  "hosur": { x: 280, y: 120 },
  "karaikudi": { x: 270, y: 370 },
  "tenkasi": { x: 180, y: 480 },
  "tirunelveli": { x: 220, y: 500 },
  "tuticorin": { x: 300, y: 500 }
};

/*Helps to get user input where the operations like converting all the inputs to string ,trimming the unwanted spaces and 
Converting everything to lower case..*/
function normalize(city) {
  if (!city) return "";
  return String(city).trim().toLowerCase();
}
/*This passes each city given as a input to normalize it and pass it to the graph.If key is found n is the city and neighbours are stored 
in the array else n is undefined.. */
function neighbors(city) {
  const n = GRAPH[normalize(city)];
  return n ? Object.keys(n) : [];
}

function bfsPath(start, end){
  start = normalize(start);
  end = normalize(end);
  if (start === "" || end === "") return null;
  if (start === end) return { path: [start], distance: 0 };
  if (!GRAPH[start] || !GRAPH[end]) return null; //Starting or ending of the inputs are not in the map return null..

  const distances = {};//Stores shortest distance from the start..

  const previous = {};//Stores previous for traversing based on the selection of algorithm...

  const priorityQueue = []; //Holds city and its shortest distance from the node..
  
  //Initially assuming the all the distances of the cities are infinity and first destination city is at 0 distance
  for (const city in GRAPH)
     {
    distances[city] = Infinity;
    previous[city] = null;
  }

  distances[start] = 0;
  //Pushing one by one in to the queue..

  priorityQueue.push([0, start]);

//Untill the queue becomes empty the loop executes
  while (priorityQueue.length > 0) {
    //sorting of places based on the distance so that the shortest city is in first place 

    //Before entry into the array or queue 
    priorityQueue.sort((a, b) => a[0] - b[0]);

    const [currentDistance, currentCity] = priorityQueue.shift();//Removing the first element and storing the current (tentative) distance and current city 
    if (currentCity === end) 
      break;
    //If the distance traversed is greater than the best known shortest distance then skip it
    if (currentDistance > distances[currentCity]) {
      continue;
    }

//Loop through all the neighbours of the current city:
//Also checks with the intermediate cities

    for (const neighbor in GRAPH[currentCity]) {
      const distance = currentDistance + GRAPH[currentCity][neighbor];
      //Updating the total distance with the new tentative distance 
      if (distance < distances[neighbor]) {
  
        distances[neighbor] = distance;// update best known total distance
  previous[neighbor] = currentCity; // record path pointer
  priorityQueue.push([distance, neighbor]); // push candidate

      }
    }
  }
/*Traversing backward the current array adding those elemnts in the path array */
  const path = [];
  let current = end;
  while (current) {
    path.push(current);
    current = previous[current];
  }

  //Reversing the path array gives the traversal
  path.reverse();
  
  if (path[0] !== start) return null;
  return { path, distance: distances[end] };
}

/**
 * dfsPaths(start, end, limit)
 * Enumerate up to `limit` distinct simple paths (no repeated node within a path)
 * Returns array of { path: [...], distance: number }
 * 
 */

function dfsPaths(start, end, limit = 6) {
  start = normalize(start);
  end = normalize(end);
  if (!start || !end) return [];
  if (!GRAPH[start] || !GRAPH[end]) return [];
  const results = [];//For storing the traversing places
  const seenPaths = new Set();//Check for the duplicates..
  //Recursively going till the targeted node..
  
  function dfs(curr, path, dist, visited) {
    /*If already found enough places like if it is traversed to the target then stop..*/
    if (results.length >= limit) 
      return;
    visited.add(curr);/*Add the current city to the visited array*/ 
    path.push(curr);//Add the it to the path array..


    if (curr === end) {
      const key = path.join('->');
      if (!seenPaths.has(key)) {
        results.push({ path: path.slice(), distance: dist });
        seenPaths.add(key);
      }
    } else {
      const neighs = neighbors(curr);
      for (const nb of neighs) {
        const nn = normalize(nb);
        if (!visited.has(nn)) {
    const w = (GRAPH[curr] && GRAPH[curr][nn] !== undefined) ? GRAPH[curr][nn] : ((GRAPH[nn] && GRAPH[nn][curr] !== undefined) ? GRAPH[nn][curr] : null);
          if (w === null) continue;
          dfs(nn, path, dist + w, visited);
          if (results.length >= limit) break;
        }
      }
    }
    path.pop();
    visited.delete(curr);
  }
  dfs(start, [], 0, new Set());
  return results;
}

/**
 * concatSegments(segments)
 * Concatenates and cleans multiple path segments.
 * This is the final and correct version to prevent repeated places.
 */
function concatSegments(segments) {
    if (!segments || segments.length === 0) return [];
    
    const result = [];
    const visitedInResult = new Set();
    
    for (const seg of segments) {
        if (!seg || seg.length === 0) continue;
        
        for (const city of seg) {
            const normalizedCity = String(city).trim().toLowerCase();
            if (!visitedInResult.has(normalizedCity)) {
                result.push(normalizedCity);
                visitedInResult.add(normalizedCity);
            }
        }
    }
    return result;
}

// -----------------------------
// API Endpoints
// -----------------------------
app.get('/graph', (req, res) => {
  res.json({ graph: GRAPH });
});

app.get('/coords', (req, res) => {
  res.json({ coords: COORDS });
});

/**
 * POST /findRoutes
 */
app.post('/findRoutes', (req, res) => {
  try {
    const body = req.body || {};
    const rawPlaces = Array.isArray(body.places) ? body.places : [];
    const mode = body.mode === 'dfs' ? 'dfs' : 'bfs';
    const dfsLimitPerSegment = Math.max(1, Number(body.dfsLimitPerSegment) || 4);

    if (rawPlaces.length < 2) {
      return res.status(400).json({ success: false, error: 'places must be an array with at least [from, to]' });
    }

    const places = rawPlaces.map(p => normalize(p)).filter(p => GRAPH[p]);
    if (places.length < 2) {
      const invalidPlaces = rawPlaces.filter(p => !GRAPH[normalize(p)]);
      return res.status(400).json({ success: false, error: 'One or more input cities are not in the database.', invalidCities: invalidPlaces });
    }

    const segmentDetails = [];
    const segmentPaths = [];
    let combinedDistance = 0;
    let unreachableSegments = [];
    let combinedRoute = [];
    let dfsAlternatives = [];

    // --- Main loop to find path segments and combine them ---
    for (let i = 0; i < places.length - 1; i++) {
        const start = places[i];
        const end = places[i + 1];

        if (mode === 'bfs') {
            const result = bfsPath(start, end);
            if (!result) {
                unreachableSegments.push({ from: start, to: end });
                break;
            }
            segmentDetails.push({ from: start, to: end, path: result.path, distance: result.distance, method: 'bfs' });
            segmentPaths.push(result.path);
            combinedDistance += result.distance;
        } else { // DFS mode
            const dfsRoutes = dfsPaths(start, end, dfsLimitPerSegment + 2);
            if (dfsRoutes.length === 0) {
                unreachableSegments.push({ from: start, to: end });
                break;
            }
            const result = dfsRoutes[0];
            segmentDetails.push({ from: start, to: end, path: result.path, distance: result.distance, method: 'dfs' });
            combinedDistance += result.distance;
            segmentPaths.push(result.path);
        }
    }

    if (unreachableSegments.length > 0) {
      return res.json({
        success: false,
        error: 'One or more segments are unreachable.',
        unreachableSegments
      });
    }
    
    // --- Build the final combined route ---
    combinedRoute = concatSegments(segmentPaths);

    // --- Generate alternatives (optional) ---
    const perSegmentOptions = [];
    for (let i = 0; i < places.length - 1; i++) {
      const a = places[i], b = places[i + 1];
      const paths = dfsPaths(a, b, dfsLimitPerSegment + 2);
      const options = paths.length > 0 ? paths : [bfsPath(a, b)].filter(Boolean);
      perSegmentOptions.push(options);
    }

    const maxCombined = 8;
    function backtrackCombine(idx, chosenSegments) {
      if (dfsAlternatives.length >= maxCombined) return;
      if (idx === perSegmentOptions.length) {
        const combined = concatSegments(chosenSegments.map(s => s.path));
        const totalDistance = chosenSegments.reduce((sum, s) => sum + s.distance, 0);
        dfsAlternatives.push({
          segments: chosenSegments.map(s => ({ from: s.path[0], to: s.path[s.path.length - 1], path: s.path, distance: s.distance })),
          combinedPath: combined,
          combinedDistance: totalDistance
        });
        return;
      }
      const options = perSegmentOptions[idx] || [];
      for (let k = 0; k < options.length; k++) {
        backtrackCombine(idx + 1, chosenSegments.concat([options[k]]));
        if (dfsAlternatives.length >= maxCombined) break;
      }
    }
    backtrackCombine(0, []);

    const response = {
      success: true,
      mode,
      inputPlaces: places,
      combinedRoute,
      combinedDistance,
      segmentDetails,
      unreachableSegments,
      dfsAlternatives
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'server error', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Map-Backend running on http://localhost:${PORT}`);
  console.log('Endpoints: POST /findRoutes  GET /graph  GET /coords');
});