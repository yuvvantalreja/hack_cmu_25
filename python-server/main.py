from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import praw
import re
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity
import umap
import numpy as np
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence transformer model
logger.info("Loading sentence transformer model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
logger.info("Model loaded successfully")

# Reddit instance (using read-only mode, no credentials needed)
reddit = praw.Reddit(
    client_id="5rzQzUlLbtJlx2yZzQ84jQ",
    client_secret="JR14CdovObLA9eTF6oEZX_VHw9S5MQ", 
    user_agent="opinion-visualizer/1.0",
    check_for_async=False
)

class ProcessRequest(BaseModel):
    topic: str
    reduction: Optional[str] = "umap"
    similarity_threshold: Optional[float] = 0.7  # Threshold for similarity grouping
    max_posts: Optional[int] = 50

class Point(BaseModel):
    id: int
    x: float
    y: float
    text: str
    similarity_group: Optional[int] = None  # Group based on similarity
    score: Optional[int] = None
    subreddit: Optional[str] = None
    embedding: Optional[List[float]] = None  # Store embedding for similarity search

def clean_text(text: str) -> str:
    """Clean and preprocess Reddit text."""
    # Remove URLs
    text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
    # Remove Reddit formatting
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    # Remove very short or very long texts
    if len(text.strip()) < 20 or len(text.strip()) > 500:
        return None
    return text.strip()

def scrape_single_subreddit(subreddit_name: str, topic: str, posts_per_subreddit: int) -> List[dict]:
    """Scrape a single subreddit for opinions on a topic."""
    opinions = []
    
    try:
        logger.info(f"Scraping r/{subreddit_name} for '{topic}'")
        subreddit = reddit.subreddit(subreddit_name)
        
        # Search for posts related to the topic
        for submission in subreddit.search(topic, limit=posts_per_subreddit, sort='relevance'):
            # Add the submission title and body
            if submission.selftext:
                text = f"{submission.selftext}"
            else:
                text = submission.title
            
            cleaned_text = clean_text(text)
            if cleaned_text:
                opinions.append({
                    'text': cleaned_text,
                    'score': submission.score,
                    'subreddit': subreddit_name,
                    'type': 'post'
                })
            
            # Add top comments (limit to avoid too much data)
            try:
                submission.comments.replace_more(limit=0)
                for comment in submission.comments[:2]:  # Reduced to 2 comments per post for speed
                    cleaned_comment = clean_text(comment.body)
                    if cleaned_comment:
                        opinions.append({
                            'text': cleaned_comment,
                            'score': comment.score,
                            'subreddit': subreddit_name,
                            'type': 'comment'
                        })
            except Exception:
                # Skip comments if there's an error
                pass
                        
    except Exception as e:
        logger.warning(f"Error scraping r/{subreddit_name}: {e}")
    
    logger.info(f"Collected {len(opinions)} opinions from r/{subreddit_name}")
    return opinions

def scrape_reddit_opinions_parallel(topic: str, max_posts: int = 50) -> List[dict]:
    """Scrape Reddit for opinions using parallel processing."""
    start_time = time.time()
    logger.info(f"Starting parallel scraping for topic: {topic}")
    
    # Subreddits to search, ordered by relevance/activity
    subreddits = [
        'NeutralPolitics', 'unpopularopinion', 'changemyview', 
        'Ask_Politics', 'AskReddit'
    ]
    
    posts_per_subreddit = max(3, max_posts // len(subreddits))
    all_opinions = []
    

    with ThreadPoolExecutor(max_workers=6) as executor:

        future_to_subreddit = {
            executor.submit(scrape_single_subreddit, subreddit, topic, posts_per_subreddit): subreddit 
            for subreddit in subreddits
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_subreddit):
            subreddit_name = future_to_subreddit[future]
            try:
                opinions = future.result(timeout=30)  # 30 second timeout per subreddit
                all_opinions.extend(opinions)
            except Exception as e:
                logger.error(f"Error getting results from r/{subreddit_name}: {e}")
    

    seen_texts = set()
    unique_opinions = []
    for opinion in all_opinions:
        text_key = opinion['text'][:100]  # Use first 100 chars as key
        if text_key not in seen_texts:
            seen_texts.add(text_key)
            unique_opinions.append(opinion)
    
    end_time = time.time()
    logger.info(f"Parallel scraping completed in {end_time - start_time:.2f} seconds")
    logger.info(f"Collected {len(unique_opinions)} unique opinions from {len(all_opinions)} total")
    
    return unique_opinions[:max_posts]

def create_similarity_groups(embeddings: np.ndarray, threshold: float = 0.7) -> List[int]:
    """Create similarity groups based on cosine similarity."""
    similarity_matrix = cosine_similarity(embeddings)
    n_points = len(embeddings)
    groups = [-1] * n_points  
    current_group = 0
    
    for i in range(n_points):
        if groups[i] == -1:
            groups[i] = current_group
            
            # Find all points similar to this one
            similar_indices = np.where(similarity_matrix[i] >= threshold)[0]
            for j in similar_indices:
                if groups[j] == -1:  # Only assign if not already assigned
                    groups[j] = current_group
            
            current_group += 1
    
    return groups

@app.get("/")
async def root():
    return {"message": "Opinion Visualization API"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/process", response_model=dict)
async def process_topic(request: ProcessRequest):
    try:
        logger.info(f"Processing request for topic: {request.topic}")
        
        # Scrape Reddit opinions using parallel processing
        opinions = scrape_reddit_opinions_parallel(request.topic, request.max_posts or 50)
        
        if not opinions:
            raise HTTPException(status_code=404, detail="No opinions found for this topic")
        
        # Extract texts for embedding
        texts = [opinion['text'] for opinion in opinions]
        
        # Generate embeddings with progress logging
        logger.info(f"Generating embeddings for {len(texts)} texts...")
        start_time = time.time()
        embeddings = model.encode(texts, show_progress_bar=False, batch_size=32)
        embed_time = time.time() - start_time
        logger.info(f"Embeddings generated in {embed_time:.2f} seconds")
        
        # Create similarity groups
        logger.info(f"Creating similarity groups with threshold {request.similarity_threshold}")
        similarity_groups = create_similarity_groups(embeddings, request.similarity_threshold or 0.7)
        
        # Dimensionality reduction
        logger.info(f"Applying {request.reduction} dimensionality reduction...")
        if request.reduction == "umap":
            reducer = umap.UMAP(n_components=2, random_state=42, min_dist=0.1, n_neighbors=min(15, len(embeddings)-1))
        else:  # PCA
            reducer = PCA(n_components=2, random_state=42)
        
        coords_2d = reducer.fit_transform(embeddings)
        
        points = []
        for i, (opinion, coords, embedding) in enumerate(zip(opinions, coords_2d, embeddings)):
            point_dict = {
                "id": i,
                "x": float(coords[0]),
                "y": float(coords[1]),
                "text": opinion['text'],
                "similarity_group": int(similarity_groups[i]),
                "score": opinion.get('score', 0),
                "subreddit": opinion.get('subreddit', 'unknown'),
                "embedding": embedding.tolist()[:50] 
            }
            points.append(point_dict)
        
        logger.info(f"Successfully processed {len(points)} points with {len(set(similarity_groups))} similarity groups")
        
        return {
            "points": points,
            "topic": request.topic,
            "reduction": request.reduction,
            "similarity_threshold": request.similarity_threshold,
            "total_opinions": len(opinions),
            "similarity_groups": len(set(similarity_groups))
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
