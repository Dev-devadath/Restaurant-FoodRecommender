import React, { useState } from "react";
import InputForm from "./InputForm";
import Results from "./Results";
import DishSearch from "./DishSearch";
import diningRoomIcon from "./assets/dining-room.png";
import "./App.css";

function App() {
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("restaurant");

  const handleResults = (data) => {
    setResults(data);
  };

  return (
    <div className="App">
      <div className="header">
        <div className="logo">
          <img src={diningRoomIcon} alt="Dining Room Icon" />
        </div>
        <h1>Restaurant Food Recommender</h1>
        <p className="subtitle">
          Find the best dishes to order at any restaurant or discover
          restaurants serving your favorite dishes
        </p>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "restaurant" ? "active" : ""}`}
            onClick={() => setActiveTab("restaurant")}
          >
            What to Order?
          </button>
          <button
            className={`tab ${activeTab === "dish" ? "active" : ""}`}
            onClick={() => setActiveTab("dish")}
          >
            Where to Order?
          </button>
        </div>
      </div>

      {activeTab === "restaurant" ? (
        <>
          <InputForm onResults={handleResults} />
          {results && <Results data={results} />}
        </>
      ) : (
        <DishSearch />
      )}

      <div className="footer">
        <p>
          Made with ❤️ by{" "}
          <a
            href="https://devadath.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            Devadath
          </a>
          <br></br>© 2025 All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default App;
