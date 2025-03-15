import React from "react";

function Results({ data }) {
  const { restaurant_name, analysis } = data;

  return (
    <div className="results-container">
      <h2 className="restaurant-name">{restaurant_name}</h2>

      {/* Best Dish Card */}
      <div className="best-dish-card">
        <div className="dish-number">🌟 Best Overall Dish</div>
        <div className="dish-name">{analysis.best_dish.name}</div>
        <div className="dish-description">{analysis.best_dish.description}</div>
        {analysis.best_dish.recommended_with && (
          <div className="recommended-with">
            Best served with: {analysis.best_dish.recommended_with}
          </div>
        )}
        <div className="key-points">
          {analysis.best_dish.key_points.map((point, index) => (
            <div key={index} className="key-point">
              {point}
            </div>
          ))}
        </div>
      </div>

      {/* Other Dishes */}
      <div className="dish-cards">
        {analysis.top_dishes
          .filter((dish) => dish.name !== analysis.best_dish.name)
          .map((dish, index) => (
            <div key={index} className="dish-card">
              <div className="dish-number">#{index + 2}</div>
              <div className="dish-name">{dish.name}</div>
              <div className="dish-description">{dish.description}</div>
              {dish.recommended_with && (
                <div className="recommended-with">
                  Best served with: {dish.recommended_with}
                </div>
              )}
              <div className="key-points">
                {dish.key_points.map((point, idx) => (
                  <div key={idx} className="key-point">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Summary Section */}
      <div className="summary-section">
        <h3 className="summary-title">Summary</h3>
        <p className="summary-text">{analysis.summary}</p>
      </div>
    </div>
  );
}

export default Results;
