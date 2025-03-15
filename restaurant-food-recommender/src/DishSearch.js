import React, { useState, useEffect } from "react";
import axios from "axios";
import forkIcon from "./assets/fork_icon.png";

const API_BASE_URL = "https://restaurant-foodrecommender.onrender.com";

function DishSearch() {
  const [dish, setDish] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState("initial");
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Get user's location when component mounts
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          console.log(
            "Got user location:",
            position.coords.latitude,
            position.coords.longitude
          );
          setLocationLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationLoading(false);
          // Show error message to user
          if (error.code === 1) {
            // Permission denied
            console.log("Location permission denied by user");
          } else if (error.code === 2) {
            // Position unavailable
            console.log("Location information unavailable");
          } else if (error.code === 3) {
            // Timeout
            console.log("Location request timed out");
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      console.log("Geolocation is not supported by this browser.");
    }
  }, []);

  const getLoadingMessage = () => {
    switch (loadingState) {
      case "fetching":
        return "Finding restaurants...";
      case "analyzing":
        return "Analyzing dish quality...";
      case "finalizing":
        return "Preparing your recommendations...";
      default:
        return "Processing...";
    }
  };

  const validateInputs = () => {
    if (!dish.trim()) {
      setError("Please enter a dish name");
      return false;
    }
    if (!location.trim() && !useCurrentLocation) {
      setError("Please enter a location or use your current location");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    setLoadingState("fetching");
    setError("");
    setResults(null);

    try {
      // Prepare request data with more explicit values and defaults
      const requestData = {
        dish: dish.trim(),
        location: location.trim() || "Current Location",
        radius: parseInt(radius) || 10,
      };

      // Add coordinates if user wants to use their current location
      if (useCurrentLocation) {
        // Always provide default values to prevent None/null comparisons in backend
        requestData.latitude = userLocation && userLocation.latitude ? parseFloat(userLocation.latitude) : 0;
        requestData.longitude = userLocation && userLocation.longitude ? parseFloat(userLocation.longitude) : 0;
        
        // Make sure we're sending valid numeric values
        if (isNaN(requestData.latitude) || isNaN(requestData.longitude)) {
          requestData.latitude = 0;
          requestData.longitude = 0;
        }
        
        // Add a flag to indicate we're using geolocation
        requestData.useGeolocation = true;
        
        // Ensure we're sending numeric values, not strings
        requestData.radius = Number(requestData.radius);
      } else {
        // When not using geolocation, send 0 instead of null to avoid type comparison issues
        requestData.latitude = 0;
        requestData.longitude = 0;
        requestData.useGeolocation = false;
        requestData.radius = Number(requestData.radius);
      }

      console.log("Sending request data:", JSON.stringify(requestData));

      // Initial request to start searching
      const response = await axios.post(
        `${API_BASE_URL}/api/find-restaurants`,
        requestData
      );

      setLoadingState("analyzing");

      // Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(
            `${API_BASE_URL}/api/status/${response.data.task_id}`
          );

          if (statusResponse.data.state === "ANALYZING") {
            setLoadingState("analyzing");
          } else if (statusResponse.data.state === "FINALIZING") {
            setLoadingState("finalizing");
          } else if (statusResponse.data.state === "COMPLETED") {
            clearInterval(pollInterval);
            setResults(statusResponse.data.result);
            setIsLoading(false);
            setLoadingState("initial");
          } else if (statusResponse.data.state === "FAILED") {
            clearInterval(pollInterval);
            setError(
              statusResponse.data.result.error ||
                "Failed to find restaurants. Please try again."
            );
            setIsLoading(false);
            setLoadingState("initial");
          }
        } catch (error) {
          console.error("Error polling status:", error);
          setError("Failed to get results. Please try again.");
          clearInterval(pollInterval);
          setIsLoading(false);
          setLoadingState("initial");
        }
      }, 2000);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to find restaurants. Please try again.");
      setIsLoading(false);
      setLoadingState("initial");
    }
  };

  return (
    <div className="dish-search-container">
      <h2 className="section-title">Find Best Restaurants for Dish</h2>
      <p className="section-subtitle">
        Discover the best places to enjoy your favorite dish
      </p>

      <form onSubmit={handleSubmit} className="dish-search-form">
        <div className="input-group">
          <label htmlFor="dish">Dish Name</label>
          <input
            id="dish"
            type="text"
            placeholder="e.g., Biriyani, Pizza, Sushi"
            value={dish}
            onChange={(e) => {
              setDish(e.target.value);
              setError("");
            }}
            className="dish-input"
          />
        </div>

        <div className="input-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            placeholder="e.g., New York, Kochi, London"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setError("");
            }}
            className="location-input"
            disabled={useCurrentLocation}
          />
        </div>

        <div className="input-group checkbox-group">
          <div className="location-checkbox-container">
            <input
              id="useCurrentLocation"
              type="checkbox"
              checked={useCurrentLocation}
              onChange={(e) => {
                setUseCurrentLocation(e.target.checked);
                if (e.target.checked) {
                  // Save the current location text before clearing it
                  setLocation("");
                }
              }}
              className="location-checkbox"
            />
            <label htmlFor="useCurrentLocation" className="checkbox-label">
              {locationLoading
                ? "Getting your location..."
                : "Use my precise location for better results"}
            </label>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="radius">Radius (km)</label>
          <input
            id="radius"
            type="number"
            min="1"
            max="50"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="radius-input"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button className="search-button" type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="loading-spinner"></div>
              {getLoadingMessage()}
            </>
          ) : (
            <>
              <img src={forkIcon} alt="Fork Icon" className="button-icon" />
              Find Best Restaurants
            </>
          )}
        </button>

        <p className="search-note">
          Please note: The search process may take 1-5 minutes to complete as we
          analyze restaurant data for the best recommendations.
        </p>
      </form>

      {results && (
        <div className="restaurant-results">
          <h3 className="results-title">
            Best Restaurants for {results.dish} in {results.location}
          </h3>

          <div className="restaurant-cards">
            {results.restaurants.map((restaurant, index) => (
              <div key={index} className="restaurant-card">
                <div className="restaurant-rank">#{index + 1}</div>
                <h4 className="restaurant-name">{restaurant.name}</h4>
                <div className="restaurant-rating">
                  ⭐ {restaurant.rating.toFixed(1)}
                </div>
                <div className="restaurant-address">{restaurant.address}</div>

                <div className="dish-analysis">
                  <div className="dish-quality">
                    {restaurant.analysis.dish_quality &&
                    restaurant.analysis.dish_quality !== "unknown" ? (
                      <span
                        className={`quality-badge ${restaurant.analysis.dish_quality}`}
                      >
                        {restaurant.analysis.dish_quality
                          .charAt(0)
                          .toUpperCase() +
                          restaurant.analysis.dish_quality.slice(1)}{" "}
                        {results.dish}
                      </span>
                    ) : (
                      <span className="quality-badge unknown">
                        May serve {results.dish}
                      </span>
                    )}
                  </div>

                  {restaurant.analysis.dish_description && (
                    <div className="dish-description">
                      {restaurant.analysis.dish_description}
                    </div>
                  )}

                  {restaurant.analysis.key_points &&
                    restaurant.analysis.key_points.length > 0 && (
                      <div className="key-points">
                        {restaurant.analysis.key_points.map((point, idx) => (
                          <div key={idx} className="key-point">
                            {point}
                          </div>
                        ))}
                      </div>
                    )}

                  {restaurant.analysis.recommendation && (
                    <div className="recommendation">
                      <strong>Recommendation:</strong>{" "}
                      {restaurant.analysis.recommendation}
                    </div>
                  )}
                </div>

                <a
                  href={restaurant.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-on-maps"
                >
                  View on Google Maps
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DishSearch;
