from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import praw
import re
import requests
from requests.auth import HTTPBasicAuth
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans
import hdbscan
import umap
import numpy as np
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import os
import google.generativeai as genai

# Fix tokenizers parallelism warning
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Configure logging
logging.basicConfig(level=logging.INFO)

# Configure Gemini AI
# Note: Set GEMINI_API_KEY environment variable with your API key
gemini_api_key = "AIzaSyAhm41ea-AB2vRC6mlBQzoLRvvqK2Vdx4s"
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    logging.info("Gemini AI configured successfully")
else:
    logging.warning("GEMINI_API_KEY not found. Topic extraction will not be available.")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = SentenceTransformer('all-MiniLM-L6-v2')

reddit = praw.Reddit(
    client_id="5rzQzUlLbtJlx2yZzQ84jQ",
    client_secret="JR14CdovObLA9eTF6oEZX_VHw9S5MQ", 
    user_agent="opinion-visualizer/1.0",
    check_for_async=False
)


class ProcessRequest(BaseModel):
    topic: str  # Input sentence or topic - will automatically extract key topic using AI
    reduction: Optional[str] = "tsne"  # "tsne", "umap", "pca"
    clustering_method: Optional[str] = "kmeans"  # "kmeans", "hdbscan"
    n_clusters: Optional[int] = 5  # Number of clusters for KMeans (ignored for HDBSCAN)
    max_posts: Optional[int] = 50

class TopicExtractionRequest(BaseModel):
    sentence: str

class Point(BaseModel):
    id: int
    x: float
    y: float
    text: str
    cluster: Optional[int] = None  
    score: Optional[int] = None
    subreddit: Optional[str] = None
    embedding: Optional[List[float]] = None
    is_user_stance: Optional[bool] = False  # Mark if this is a user-submitted stance
    similarity_to_user: Optional[float] = None  # Similarity to user stance if applicable

class UserStanceRequest(BaseModel):
    topic: str
    user_statement: str
    existing_points: List[Point]  # The existing visualization points
    reduction: Optional[str] = "umap"


async def extract_key_topic(sentence: str) -> str:
    """
    Extract the key topic from a sentence using Gemini AI.
    
    Args:
        sentence: The input sentence to extract topic from
        
    Returns:
        The extracted key topic as a string
    """
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
Extract the main topic or subject from this sentence in 1-3 words maximum. Focus on the central theme or issue being discussed.

Examples:
- "I think gun control laws should be stricter" → gun control
- "Abortion should be a woman's choice" → abortion
- "Climate change is a serious threat" → climate change
- "Healthcare costs are too high in America" → healthcare costs
- "Immigration policies need reform" → immigration
- "The death penalty should be abolished" → death penalty

Sentence: "{sentence}"

Main topic:"""
        
        response = model.generate_content(prompt)
        extracted_topic = response.text.strip().lower()
        
        # Clean up the response
        extracted_topic = re.sub(r'^(topic:|main topic:|the topic is:|answer:)', '', extracted_topic).strip()
        extracted_topic = extracted_topic.replace('"', '').replace("'", "")
        
        logging.info(f"Extracted topic '{extracted_topic}' from sentence: {sentence[:50]}...")
        return extracted_topic
        
    except Exception as e:
        logging.error(f"Error extracting topic with Gemini: {e}")
        # Fallback: try to extract topic using simple keyword matching
        return extract_topic_fallback(sentence)

def extract_topic_fallback(sentence: str) -> str:
    """
    Fallback topic extraction using simple keyword matching.
    """
    sentence_lower = sentence.lower()
    
    # Common political/social topics
    topic_keywords = {
        'gun control': ['gun', 'firearm', 'weapon', 'shooting', 'nra'],
        'abortion': ['abortion', 'pro-choice', 'pro-life', 'roe', 'reproductive'],
        'climate change': ['climate', 'global warming', 'carbon', 'emissions'],
        'healthcare': ['healthcare', 'health care', 'medical', 'insurance'],
        'immigration': ['immigration', 'immigrant', 'border', 'visa'],
        'death penalty': ['death penalty', 'capital punishment', 'execution'],
        'education': ['education', 'school', 'teacher', 'student'],
        'taxes': ['tax', 'taxes', 'taxation', 'irs'],
        'economy': ['economy', 'economic', 'recession', 'inflation'],
        'police': ['police', 'law enforcement', 'cop'],
    }
    
    for topic, keywords in topic_keywords.items():
        if any(keyword in sentence_lower for keyword in keywords):
            return topic
    
    # If no specific topic found, extract the first meaningful noun phrase
    words = sentence_lower.split()
    if len(words) > 2:
        return ' '.join(words[:2])
    return sentence_lower[:20]

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

def scrape(subreddit_name: str, topic: str, posts_per_subreddit: int) -> List[dict]:
    """Scrape a single subreddit for opinions on a topic."""
    opinions = []
    
    try:
        logging.info(f"Scraping r/{subreddit_name} for '{topic}'")
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
        logging.warning(f"Error scraping r/{subreddit_name}: {e}")
    
    logging.info(f"Collected {len(opinions)} opinions from r/{subreddit_name}")
    return opinions

def scrape_parallel(topic: str, max_posts: int = 50) -> List[dict]:
    """Scrape Reddit for opinions using parallel processing."""
    start_time = time.time()
    logging.info(f"Starting parallel scraping for topic: {topic}")
    
    # Subreddits to search, ordered by relevance/activity
    subreddits = [
        'NeutralPolitics', 'unpopularopinion', 
        'Ask_Politics', 'AskReddit'
    ]
    
    posts_per_subreddit = max(3, max_posts // len(subreddits))
    all_opinions = []
    

    with ThreadPoolExecutor(max_workers=6) as executor:

        future_to_subreddit = {
            executor.submit(scrape, subreddit, topic, posts_per_subreddit): subreddit 
            for subreddit in subreddits
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_subreddit):
            subreddit_name = future_to_subreddit[future]
            try:
                opinions = future.result(timeout=30)  # 30 second timeout per subreddit
                all_opinions.extend(opinions)
            except Exception as e:
                logging.error(f"Error getting results from r/{subreddit_name}: {e}")
    

    seen_texts = set()
    unique_opinions = []
    for opinion in all_opinions:
        text_key = opinion['text'][:100]  # Use first 100 chars as key
        if text_key not in seen_texts:
            seen_texts.add(text_key)
            unique_opinions.append(opinion)
    
    end_time = time.time()
    logging.info(f"Parallel scraping completed in {end_time - start_time:.2f} seconds")
    logging.info(f"Collected {len(unique_opinions)} unique opinions from {len(all_opinions)} total")
    
    return unique_opinions[:max_posts]

def create_clusters(embeddings: np.ndarray, method: str = "kmeans", n_clusters: int = 5) -> List[int]:
    """
    Create clusters using various clustering methods.
    
    Args:
        embeddings: The embedding vectors
        method: Clustering method - "kmeans", "hdbscan"
        n_clusters: Number of clusters for KMeans (ignored for HDBSCAN)
    
    Returns:
        List of cluster labels for each embedding
    """
    n_points = len(embeddings)
    
    if method.lower() == "kmeans":
        # Use KMeans clustering with improved parameters for text
        # Adjust n_clusters if we have fewer points than clusters
        actual_clusters = min(n_clusters, n_points)
        if actual_clusters < 2:
            return [0] * n_points  # All points in one cluster if too few points
        
        kmeans = KMeans(
            n_clusters=actual_clusters, 
            random_state=42, 
            n_init=20,  # More initializations for better results
            max_iter=500,  # More iterations
            algorithm='lloyd'  # More stable for text embeddings
        )
        cluster_labels = kmeans.fit_predict(embeddings)
        return cluster_labels.tolist()
    
    elif method.lower() == "hdbscan":
        # Use HDBSCAN clustering with improved parameters for text
        # HDBSCAN automatically determines the number of clusters
        min_cluster_size = max(5, min(25, n_points // 15))  # Scale better with data size
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=3,  # More robust cluster formation
            metric='euclidean',  # Better for text embeddings
            cluster_selection_epsilon=0.0,  # Let HDBSCAN decide naturally
            alpha=1.0,  # Better cluster stability
            cluster_selection_method='eom',  # Excess of mass for better text clusters
            allow_single_cluster=True  # Allow single cluster if data is very similar
        )
        cluster_labels = clusterer.fit_predict(embeddings)
        
        # If HDBSCAN assigns too many points as noise (-1), fall back to KMeans
        noise_ratio = (cluster_labels == -1).sum() / len(cluster_labels)
        unique_clusters = len(set(cluster_labels))
        
        logging.info(f"HDBSCAN results: {unique_clusters} clusters, {noise_ratio:.2%} noise")
        
        if noise_ratio > 0.5 or unique_clusters < 2:  # If >50% noise or too few clusters
            logging.info("HDBSCAN produced too much noise, falling back to KMeans")
            return create_clusters(embeddings, "kmeans", min(8, max(3, n_points // 20)))
        
        # Convert noise points (-1) to a separate cluster for visualization
        cluster_labels_fixed = []
        max_cluster = max([c for c in cluster_labels if c >= 0], default=0)
        noise_cluster_id = max_cluster + 1
        
        for label in cluster_labels:
            if label == -1:  # Noise point
                cluster_labels_fixed.append(noise_cluster_id)
            else:
                cluster_labels_fixed.append(label)
                
        return cluster_labels_fixed
    
    
    else:
        # Default to kmeans if unknown method
        logging.warning(f"Unknown clustering method '{method}', defaulting to kmeans")
        return create_clusters(embeddings, "kmeans", n_clusters)

@app.get("/")
async def root():
    return {"message": "Opinion Visualization API"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/extract-topic")
async def extract_topic(request: TopicExtractionRequest):
    """
    Extract the key topic from a sentence using Gemini AI.
    """
    try:
        topic = await extract_key_topic(request.sentence)
        return {
            "original_sentence": request.sentence,
            "extracted_topic": topic
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error in topic extraction endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process", response_model=dict)
async def process_topic(request: ProcessRequest):
    try:
        original_input = request.topic
        
        # Always try to extract topic using AI first
        logging.info(f"Extracting key topic from input: {request.topic}")
        try:
            extracted_topic = await extract_key_topic(request.topic)
            logging.info(f"Successfully extracted topic: {extracted_topic}")
            topic_to_use = extracted_topic
        except Exception as e:
            logging.warning(f"Topic extraction failed: {e}. Using original input as topic.")
            extracted_topic = request.topic  # Fallback to original input
            topic_to_use = request.topic
        
        all_opinions = scrape_parallel(topic_to_use, request.max_posts or 50)
        
        if len(all_opinions) < (request.max_posts or 50) // 2:
            logging.info("Supplementing with standard praw search")
            standard_opinions = scrape_parallel(topic_to_use, request.max_posts or 50)
            all_opinions.extend(standard_opinions)
        
        # Remove duplicates based on text similarity (first 100 characters)
        seen_texts = set()
        unique_opinions = []
        for opinion in all_opinions:
            text_key = opinion['text'][:100]
            if text_key not in seen_texts:
                seen_texts.add(text_key)
                unique_opinions.append(opinion)
        
        # Limit to max_posts
        opinions = unique_opinions[:request.max_posts or 50]
        
        if not opinions:
            raise HTTPException(status_code=404, detail=f"No opinions found for topic: {extracted_topic}")
        
        # Extract texts for embedding
        texts = [opinion['text'] for opinion in opinions]
        
        # Generate embeddings with progress logging
        logging.info(f"Generating embeddings for {len(texts)} texts...")
        start_time = time.time()
        embeddings = model.encode(texts, show_progress_bar=False, batch_size=32)
        embed_time = time.time() - start_time
        logging.info(f"Embeddings generated in {embed_time:.2f} seconds")
        
        # Create clusters
        logging.info(f"Creating clusters using {request.clustering_method} method")
        cluster_labels = create_clusters(
            embeddings, 
            method=request.clustering_method or "kmeans",
            n_clusters=request.n_clusters or 5,
        )
        
        # Dimensionality reduction
        logging.info(f"Applying {request.reduction} dimensionality reduction...")
        if request.reduction == "tsne":
            # t-SNE is excellent for text visualization and cluster separation
            reducer = TSNE(
                n_components=2, 
                random_state=42, 
                perplexity=min(30, len(embeddings)-1), 
                learning_rate='auto',
                max_iter=1000,
                early_exaggeration=12,
                metric='euclidean',  # t-SNE works well with euclidean on normalized embeddings
                init='pca'  # Better initialization for text embeddings
            )
        elif request.reduction == "umap":
            # Improved UMAP parameters for text clustering
            reducer = umap.UMAP(
                n_components=2, 
                random_state=42, 
                min_dist=0.3,  # Increased for better separation
                n_neighbors=min(15, len(embeddings)-1),
                spread=1.5,  # Better spread of clusters
                metric='euclidean'  # Better for text embeddings
            )
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
                "cluster": int(cluster_labels[i]),  
                "score": opinion.get('score', 0),
                "subreddit": opinion.get('subreddit', 'unknown'),
                "embedding": embedding.tolist()[:50] 
            }
            points.append(point_dict)
        
        # Log cluster distribution for debugging
        from collections import Counter
        cluster_counts = Counter(cluster_labels)
        logging.info(f"Successfully processed {len(points)} points with {len(set(cluster_labels))} clusters")
        logging.info(f"Cluster distribution: {dict(cluster_counts)}")
        
        return {
            "points": points,
            "original_input": original_input,
            "extracted_topic": extracted_topic,
            "topic": extracted_topic,  # For backward compatibility
            "reduction": request.reduction,
            "clustering_method": request.clustering_method,
            "n_clusters": request.n_clusters,
            "total_opinions": len(opinions),
            "total_clusters": len(set(cluster_labels))
        }
        
    except Exception as e:
        logging.error(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/add_user_stance", response_model=dict)
async def add_user_stance(request: UserStanceRequest):
    """
    Add user's personal stance to existing visualization and position it based on embedding similarity.
    """
    try:
        logging.info(f"Adding user stance: {request.user_statement[:50]}...")
        
        if not request.user_statement.strip():
            raise HTTPException(status_code=400, detail="User statement cannot be empty")
        
        if not request.existing_points:
            raise HTTPException(status_code=400, detail="No existing points provided for positioning")
        
        # Generate embedding for user statement
        user_embedding = model.encode([request.user_statement.strip()])[0]
        
        # Extract embeddings from existing points
        existing_embeddings = []
        for point in request.existing_points:
            if point.embedding:
                existing_embeddings.append(point.embedding)
            else:
                # If no embedding stored, regenerate it
                existing_embeddings.append(model.encode([point.text])[0])
        
        existing_embeddings = np.array(existing_embeddings)
        
        # Calculate similarities
        similarities = cosine_similarity([user_embedding], existing_embeddings)[0]
        
        # Find the most similar point for positioning reference
        most_similar_idx = np.argmax(similarities)
        max_similarity = similarities[most_similar_idx]
        
        # Position user stance based on similarity-weighted average of nearby points
        # Use points with similarity > 0.5 for positioning
        similar_points_mask = similarities > 0.5
        
        if np.sum(similar_points_mask) > 0:
            # Weighted average position based on similarity
            weights = similarities[similar_points_mask]
            weighted_x = np.average([request.existing_points[i].x for i in range(len(request.existing_points)) if similar_points_mask[i]], weights=weights)
            weighted_y = np.average([request.existing_points[i].y for i in range(len(request.existing_points)) if similar_points_mask[i]], weights=weights)
        else:
            # If no similar points, use the most similar one as reference
            weighted_x = request.existing_points[most_similar_idx].x
            weighted_y = request.existing_points[most_similar_idx].y
        
        # Add some jitter to avoid exact overlap
        jitter_x = np.random.normal(0, 0.05)  # Small random offset
        jitter_y = np.random.normal(0, 0.05)
        
        # Create user stance point
        user_point = Point(
            id=len(request.existing_points),
            x=float(weighted_x + jitter_x),
            y=float(weighted_y + jitter_y),
            text=request.user_statement.strip(),
            cluster=request.existing_points[most_similar_idx].cluster,  # Assign to most similar cluster
            score=None,  # User stances don't have Reddit scores
            subreddit="Your Stance",
            embedding=user_embedding.tolist(),
            is_user_stance=True,
            similarity_to_user=1.0  # Self-similarity is 1.0
        )
        
        # Update similarities for existing points
        updated_points = []
        for i, point in enumerate(request.existing_points):
            updated_point = point.model_copy()
            updated_point.similarity_to_user = float(similarities[i])
            updated_points.append(updated_point)
        
        # Add user point to the list
        updated_points.append(user_point)
        
        logging.info(f"User stance positioned at ({weighted_x:.3f}, {weighted_y:.3f}) with max similarity {max_similarity:.3f}")
        
        return {
            "points": [point.model_dump() for point in updated_points],
            "user_stance_similarity": float(max_similarity),
            "most_similar_opinion": request.existing_points[most_similar_idx].text[:100] + "...",
            "similar_points_count": int(np.sum(similar_points_mask)),
            "topic": request.topic
        }
        
    except Exception as e:
        logging.error(f"Error adding user stance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
