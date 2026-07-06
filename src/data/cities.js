// Indian cities with centroid coordinates — used for autocomplete and
// city-to-city distance scoring in discover (per spec §2.3.1: location is
// stored at city level; distance uses city centroids, never user GPS).
// Launch + tier-2 cities first; extend freely — shape: [name, state, lat, lng]

const CITIES = [
  ['Mumbai', 'Maharashtra', 19.0760, 72.8777],
  ['Delhi', 'Delhi', 28.7041, 77.1025],
  ['Bengaluru', 'Karnataka', 12.9716, 77.5946],
  ['Hyderabad', 'Telangana', 17.3850, 78.4867],
  ['Ahmedabad', 'Gujarat', 23.0225, 72.5714],
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707],
  ['Kolkata', 'West Bengal', 22.5726, 88.3639],
  ['Pune', 'Maharashtra', 18.5204, 73.8567],
  ['Jaipur', 'Rajasthan', 26.9124, 75.7873],
  ['Surat', 'Gujarat', 21.1702, 72.8311],
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462],
  ['Kanpur', 'Uttar Pradesh', 26.4499, 80.3319],
  ['Nagpur', 'Maharashtra', 21.1458, 79.0882],
  ['Indore', 'Madhya Pradesh', 22.7196, 75.8577],
  ['Thane', 'Maharashtra', 19.2183, 72.9781],
  ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126],
  ['Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185],
  ['Patna', 'Bihar', 25.5941, 85.1376],
  ['Vadodara', 'Gujarat', 22.3072, 73.1812],
  ['Ghaziabad', 'Uttar Pradesh', 28.6692, 77.4538],
  ['Ludhiana', 'Punjab', 30.9010, 75.8573],
  ['Agra', 'Uttar Pradesh', 27.1767, 78.0081],
  ['Nashik', 'Maharashtra', 19.9975, 73.7898],
  ['Faridabad', 'Haryana', 28.4089, 77.3178],
  ['Meerut', 'Uttar Pradesh', 28.9845, 77.7064],
  ['Rajkot', 'Gujarat', 22.3039, 70.8022],
  ['Varanasi', 'Uttar Pradesh', 25.3176, 82.9739],
  ['Srinagar', 'Jammu and Kashmir', 34.0837, 74.7973],
  ['Aurangabad', 'Maharashtra', 19.8762, 75.3433],
  ['Dhanbad', 'Jharkhand', 23.7957, 86.4304],
  ['Amritsar', 'Punjab', 31.6340, 74.8723],
  ['Navi Mumbai', 'Maharashtra', 19.0330, 73.0297],
  ['Prayagraj', 'Uttar Pradesh', 25.4358, 81.8463],
  ['Ranchi', 'Jharkhand', 23.3441, 85.3096],
  ['Howrah', 'West Bengal', 22.5958, 88.2636],
  ['Coimbatore', 'Tamil Nadu', 11.0168, 76.9558],
  ['Jabalpur', 'Madhya Pradesh', 23.1815, 79.9864],
  ['Gwalior', 'Madhya Pradesh', 26.2183, 78.1828],
  ['Vijayawada', 'Andhra Pradesh', 16.5062, 80.6480],
  ['Jodhpur', 'Rajasthan', 26.2389, 73.0243],
  ['Madurai', 'Tamil Nadu', 9.9252, 78.1198],
  ['Raipur', 'Chhattisgarh', 21.2514, 81.6296],
  ['Kota', 'Rajasthan', 25.2138, 75.8648],
  ['Guwahati', 'Assam', 26.1445, 91.7362],
  ['Chandigarh', 'Chandigarh', 30.7333, 76.7794],
  ['Solapur', 'Maharashtra', 17.6599, 75.9064],
  ['Hubli', 'Karnataka', 15.3647, 75.1240],
  ['Mysuru', 'Karnataka', 12.2958, 76.6394],
  ['Tiruchirappalli', 'Tamil Nadu', 10.7905, 78.7047],
  ['Bareilly', 'Uttar Pradesh', 28.3670, 79.4304],
  ['Aligarh', 'Uttar Pradesh', 27.8974, 78.0880],
  ['Tiruppur', 'Tamil Nadu', 11.1085, 77.3411],
  ['Moradabad', 'Uttar Pradesh', 28.8386, 78.7733],
  ['Jalandhar', 'Punjab', 31.3260, 75.5762],
  ['Bhubaneswar', 'Odisha', 20.2961, 85.8245],
  ['Salem', 'Tamil Nadu', 11.6643, 78.1460],
  ['Warangal', 'Telangana', 17.9689, 79.5941],
  ['Guntur', 'Andhra Pradesh', 16.3067, 80.4365],
  ['Bhiwandi', 'Maharashtra', 19.2813, 73.0483],
  ['Saharanpur', 'Uttar Pradesh', 29.9640, 77.5460],
  ['Gorakhpur', 'Uttar Pradesh', 26.7606, 83.3732],
  ['Bikaner', 'Rajasthan', 28.0229, 73.3119],
  ['Amravati', 'Maharashtra', 20.9374, 77.7796],
  ['Noida', 'Uttar Pradesh', 28.5355, 77.3910],
  ['Jamshedpur', 'Jharkhand', 22.8046, 86.2029],
  ['Bhilai', 'Chhattisgarh', 21.1938, 81.3509],
  ['Cuttack', 'Odisha', 20.4625, 85.8830],
  ['Firozabad', 'Uttar Pradesh', 27.1592, 78.3957],
  ['Kochi', 'Kerala', 9.9312, 76.2673],
  ['Nellore', 'Andhra Pradesh', 14.4426, 79.9865],
  ['Bhavnagar', 'Gujarat', 21.7645, 72.1519],
  ['Dehradun', 'Uttarakhand', 30.3165, 78.0322],
  ['Durgapur', 'West Bengal', 23.5204, 87.3119],
  ['Asansol', 'West Bengal', 23.6739, 86.9524],
  ['Rourkela', 'Odisha', 22.2604, 84.8536],
  ['Nanded', 'Maharashtra', 19.1383, 77.3210],
  ['Kolhapur', 'Maharashtra', 16.7050, 74.2433],
  ['Ajmer', 'Rajasthan', 26.4499, 74.6399],
  ['Akola', 'Maharashtra', 20.7002, 77.0082],
  ['Gulbarga', 'Karnataka', 17.3297, 76.8343],
  ['Jamnagar', 'Gujarat', 22.4707, 70.0577],
  ['Ujjain', 'Madhya Pradesh', 23.1765, 75.7885],
  ['Loni', 'Uttar Pradesh', 28.7514, 77.2905],
  ['Siliguri', 'West Bengal', 26.7271, 88.3953],
  ['Jhansi', 'Uttar Pradesh', 25.4484, 78.5685],
  ['Ulhasnagar', 'Maharashtra', 19.2215, 73.1645],
  ['Jammu', 'Jammu and Kashmir', 32.7266, 74.8570],
  ['Sangli', 'Maharashtra', 16.8524, 74.5815],
  ['Mangaluru', 'Karnataka', 12.9141, 74.8560],
  ['Erode', 'Tamil Nadu', 11.3410, 77.7172],
  ['Belagavi', 'Karnataka', 15.8497, 74.4977],
  ['Ambattur', 'Tamil Nadu', 13.1143, 80.1548],
  ['Tirunelveli', 'Tamil Nadu', 8.7139, 77.7567],
  ['Malegaon', 'Maharashtra', 20.5579, 74.5287],
  ['Gaya', 'Bihar', 24.7914, 85.0002],
  ['Thiruvananthapuram', 'Kerala', 8.5241, 76.9366],
  ['Udaipur', 'Rajasthan', 24.5854, 73.7125],
  ['Kozhikode', 'Kerala', 11.2588, 75.7804],
  ['Shillong', 'Meghalaya', 25.5788, 91.8933],
  ['Imphal', 'Manipur', 24.8170, 93.9368],
  ['Aizawl', 'Mizoram', 23.7307, 92.7173],
  ['Agartala', 'Tripura', 23.8315, 91.2868],
  ['Kohima', 'Nagaland', 25.6751, 94.1086],
  ['Itanagar', 'Arunachal Pradesh', 27.0844, 93.6053],
  ['Gangtok', 'Sikkim', 27.3389, 88.6065],
  ['Dibrugarh', 'Assam', 27.4728, 94.9120],
  ['Silchar', 'Assam', 24.8333, 92.7789],
  ['Jorhat', 'Assam', 26.7509, 94.2037],
  ['Tezpur', 'Assam', 26.6528, 92.7926],
  ['Panaji', 'Goa', 15.4909, 73.8278],
  ['Shimla', 'Himachal Pradesh', 31.1048, 77.1734],
  ['Puducherry', 'Puducherry', 11.9416, 79.8083]
];

const cityMap = new Map(CITIES.map(([name, state, lat, lng]) =>
  [name.toLowerCase(), { name, state, lat, lng }]));

function findCity(name) {
  return name ? cityMap.get(String(name).trim().toLowerCase()) || null : null;
}

// Haversine distance in km between two city centroids
function cityDistanceKm(cityA, cityB) {
  const a = findCity(cityA), b = findCity(cityB);
  if (!a || !b) return null;
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

module.exports = { CITIES, findCity, cityDistanceKm };
