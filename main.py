from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from apify_client import ApifyClient
import os
from dotenv import load_dotenv
import google.generativeai as genai
import json
import urllib.parse
import re
from typing import Dict, Optional
import uuid
import asyncio
import requests
from bs4 import BeautifulSoup

# Load environment variables
load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash')

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RestaurantURL(BaseModel):
    url: str

class TaskStatus(BaseModel):
    state: str
    result: Optional[dict] = None

# Store for task states
tasks: Dict[str, TaskStatus] = {}

def extract_restaurant_name_from_url(url: str) -> str:
    try:
        parsed_url = urllib.parse.urlparse(url)
        path_parts = parsed_url.path.split('/')
        
        # Find the part that comes after 'place' in the URL
        if 'place' in path_parts:
            place_index = path_parts.index('place')
            if len(path_parts) > place_index + 1:
                # Get the next part after 'place' and replace '+' with spaces
                restaurant_name = path_parts[place_index + 1].replace('+', ' ')
                # Remove any location coordinates or other data after '@'
                restaurant_name = restaurant_name.split('@')[0]
                return restaurant_name
        
        return "Unknown Restaurant"
    except Exception:
        return "Unknown Restaurant"

def analyze_reviews_with_gemini(reviews, restaurant_name):
    # Prepare the reviews text
    reviews_text = "\n".join([
        f"Review {i+1} ({review['stars']} stars): {review['text']}"
        for i, review in enumerate(reviews)
    ])
    
    # Create a detailed prompt for Gemini
    prompt = f"""You are a food critic and restaurant analyst. Analyze these reviews for {restaurant_name} and provide a focused analysis of the top 5 best dishes mentioned.

Reviews:
{reviews_text}

Please provide your analysis in the following JSON format:
{{
    "top_dishes": [
        {{
            "name": "dish name",
            "description": "brief description of the dish",
            "recommended_with": "any specific dish or item it's recommended to be served with (if mentioned)",
            "key_points": ["2-3 key positive points about this dish"]
        }}
    ],
    "best_dish": {{
        "name": "name of the best overall dish",
        "description": "brief description of why this is considered the best",
        "recommended_with": "any specific dish or item it's recommended to be served with",
        "key_points": ["2-3 key positive points about this dish"]
    }},
    "summary": "a brief 2-3 sentence summary of the restaurant's strengths and most praised dishes"
}}

Focus on:
1. Most frequently praised dishes
2. Dishes with specific positive mentions
3. Dishes that are recommended to be served together
4. Dishes that stand out in the reviews

Please be concise and focus on the most important information. Return only the JSON object without any markdown formatting or code block markers."""

    try:
        response = model.generate_content(prompt)
        # Clean up the response text by removing markdown code block markers
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        # Try to parse the response as JSON
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, return a structured error response
            return {
                "error": "Failed to parse Gemini response as JSON",
                "raw_response": response.text
            }
    except Exception as e:
        return {"error": f"Failed to analyze reviews: {str(e)}"}

def expand_short_url(url: str) -> str:
    try:
        # Check if it's a shortened URL
        if not ("maps.app.goo.gl" in url or "goo.gl/maps" in url or "g.co/kgs/" in url):
            return url

        # Make a request to the shortened URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, allow_redirects=True, headers=headers)
        
        # Try to get the final URL from the response
        final_url = response.url
        
        # If we got a valid Google Maps URL, return it
        if "google.com/maps" in final_url:
            return final_url
            
        # If we got redirected to a Google Search page
        if "google.com/search" in final_url:
            # Extract the restaurant name from the search query
            parsed_url = urllib.parse.urlparse(final_url)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # Try to get the restaurant name from different possible parameters
            restaurant_name = None
            if 'q' in query_params:
                restaurant_name = query_params['q'][0]
            elif 'kgs' in query_params:
                # If we have a kgs parameter, try to get the name from the HTML
                soup = BeautifulSoup(response.text, 'html.parser')
                title_elem = soup.find('title')
                if title_elem:
                    # Usually the title is in format "Restaurant Name - Google Search"
                    restaurant_name = title_elem.text.split(' - ')[0]
            
            if restaurant_name:
                # Create a Google Maps search URL
                search_url = f"https://www.google.com/maps/search/{urllib.parse.quote(restaurant_name)}"
                print(f"Created Maps search URL: {search_url}")
                return search_url
        
        # If not a search page, try to extract from the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for various patterns in the HTML
        patterns = [
            r'https://www\.google\.com/maps/place/[^"\'<>]+',
            r'https://maps\.google\.com/maps/place/[^"\'<>]+',
            r'data-url="([^"]*maps\.google\.com[^"]*)"',
            r'href="([^"]*maps\.google\.com[^"]*)"',
            r'window\.location\.href\s*=\s*[\'"]([^\'"]+)[\'"]',
            r'data-href="([^"]*maps\.google\.com[^"]*)"',
            r'data-google-maps-url="([^"]*maps\.google\.com[^"]*)"',
            r'data-place-url="([^"]*maps\.google\.com[^"]*)"'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, response.text)
            if matches:
                # If it's a capture group, use the first match
                found_url = matches[0] if isinstance(matches[0], str) else matches[0][0]
                if "google.com/maps" in found_url:
                    return found_url
        
        # If we still haven't found a valid URL, try to find it in meta tags
        meta_tags = soup.find_all('meta', property=['og:url', 'twitter:url'])
        for tag in meta_tags:
            content = tag.get('content', '')
            if "google.com/maps" in content:
                return content
                
        # Try to find the URL in script tags
        script_tags = soup.find_all('script')
        for script in script_tags:
            if script.string and "google.com/maps" in script.string:
                matches = re.findall(r'https://www\.google\.com/maps/place/[^"\'<>]+', script.string)
                if matches:
                    return matches[0]
                
        raise ValueError("Could not extract full Google Maps URL from shortened link")
    except Exception as e:
        print(f"Error expanding URL: {str(e)}")
        raise ValueError(f"Failed to process shortened URL: {str(e)}")

async def process_restaurant_data(task_id: str, url: str):
    try:
        # Update task status to fetching
        tasks[task_id].state = "FETCHING"
        
        # Expand shortened URL if necessary
        try:
            expanded_url = expand_short_url(url)
        except Exception as e:
            tasks[task_id].state = "FAILED"
            tasks[task_id].result = {"error": str(e)}
            return

        # Initialize the ApifyClient with your API token
        client = ApifyClient(os.getenv("APIFY_API_TOKEN"))

        # Try to get restaurant name from URL first
        restaurant_name = extract_restaurant_name_from_url(expanded_url)
        if not restaurant_name:
            restaurant_name = "Unknown Restaurant"

        # Prepare the Actor input
        run_input = {
            "startUrls": [{"url": expanded_url}],
            "maxReviews": 25,
            "reviewsSort": "highestRanking",
            "scrapeReviewsPersonalData": False,
            "language": "en"
        }

        # Run the Actor and wait for it to finish
        run = client.actor("compass/crawler-google-places").call(run_input=run_input)

        # Update task status to analyzing
        tasks[task_id].state = "ANALYZING"

        # Fetch results from the run's dataset
        reviews = []
        
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            if "reviews" in item:
                # Process each review to extract only text and stars
                processed_reviews = []
                for review in item["reviews"]:
                    processed_review = {
                        "text": review.get("text", ""),
                        "stars": review.get("stars", 0)
                    }
                    processed_reviews.append(processed_review)
                reviews.extend(processed_reviews)
            
            # Update restaurant name if available from the API response
            if "name" in item and item["name"]:
                restaurant_name = item["name"]

        # Get the top 10 reviews
        top_reviews = reviews[:10]
        
        # Update task status to finalizing
        tasks[task_id].state = "FINALIZING"
        
        # Analyze reviews with Gemini
        analysis = analyze_reviews_with_gemini(top_reviews, restaurant_name)

        # Store the final result
        result = {
            "success": True,
            "restaurant_name": restaurant_name,
            "reviews": top_reviews,
            "analysis": analysis
        }
        
        tasks[task_id].state = "COMPLETED"
        tasks[task_id].result = result

    except Exception as e:
        tasks[task_id].state = "FAILED"
        tasks[task_id].result = {"error": str(e)}

@app.post("/api/scrape-reviews")
async def scrape_reviews(restaurant: RestaurantURL):
    try:
        # Generate a unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        tasks[task_id] = TaskStatus(state="INITIALIZED")
        
        # Start processing in the background
        asyncio.create_task(process_restaurant_data(task_id, restaurant.url))
        
        return {"task_id": task_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return tasks[task_id]

