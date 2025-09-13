import { useState } from 'react'
// @ts-expect-error: No types for react-plotly.js
import Plot from 'react-plotly.js'
import './App.css'

type Point = { 
  id: number; 
  x: number; 
  y: number; 
  text: string; 
  similarity_group: number | null;
  score?: number;
  subreddit?: string;
  embedding?: number[];
}

function App() {
  const [topic, setTopic] = useState('gun control')
  const [reduction, setReduction] = useState<'pca' | 'umap'>('umap')
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7)
  const [maxPosts, setMaxPosts] = useState(50)
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [totalOpinions, setTotalOpinions] = useState<number | null>(null)
  const [similarityGroups, setSimilarityGroups] = useState<number | null>(null)

  async function handleProcess() {
    if (!topic.trim()) {
      alert('Please enter a topic')
      return
    }
    
    setLoading(true)
    setPoints([])
    setTotalOpinions(null)
    setSimilarityGroups(null)
    setLoadingStatus('Scraping Reddit...')
    
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic.trim(), 
          reduction, 
          similarity_threshold: similarityThreshold,
          max_posts: maxPosts
        }),
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Server error:', res.status, errorText)
        alert(`Server error: ${res.status} - ${errorText}`)
        return
      }
      
      const data = await res.json()
      setPoints(data.points as Point[])
      setTotalOpinions(data.total_opinions)
      setSimilarityGroups(data.similarity_groups)
    } catch (err) {
      console.error('Request failed:', err)
      alert(`Request failed: ${err}`)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1>Visualization</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Topic to analyze:
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., climate change, artificial intelligence, gun control"
              style={{ 
                width: '100%', 
                padding: 8, 
                marginTop: 4,
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: 16
              }}
            />
          </label>
          <p style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            Enter any topic and we'll analyze Reddit discussions about it
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            Dimensionality reduction:
            <select 
              value={reduction} 
              onChange={(e) => setReduction(e.target.value as 'pca' | 'umap')}
              style={{ marginLeft: 8, padding: 4 }}
            >
              <option value="umap">UMAP (recommended)</option>
              <option value="pca">PCA</option>
            </select>
          </label>
          
          <label>
            Similarity threshold:
            <input
              type="number"
              min={0.1}
              max={0.9}
              step={0.1}
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              style={{ width: 60, marginLeft: 8, padding: 4 }}
            />
          </label>
          
          <label>
            Max posts:
            <input
              type="number"
              min={10}
              max={200}
              value={maxPosts}
              onChange={(e) => setMaxPosts(Number(e.target.value))}
              style={{ width: 60, marginLeft: 8, padding: 4 }}
            />
          </label>
          
          <button 
            onClick={handleProcess} 
            disabled={loading || !topic.trim()} 
            style={{ 
              padding: '12px 24px', 
              fontSize: 16, 
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (loadingStatus || 'Processing...') : 'Analyze Topic'}
          </button>
          
          {totalOpinions && (
            <p style={{ fontSize: 12, color: '#666' }}>
              Found {totalOpinions} opinions in {similarityGroups} similarity groups
            </p>
          )}
        </div>
      </div>

      {points.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Plot
            data={[{
              x: points.map(p => p.x),
              y: points.map(p => p.y),
              text: points.map(p => `${p.text}<br><br>Subreddit: r/${p.subreddit}<br>Score: ${p.score}`),
              type: 'scatter',
              mode: 'markers',
              marker: { 
                color: points.map(p => (p.similarity_group ?? 0)), 
                colorscale: 'Viridis', 
                size: points.map(p => Math.max(6, Math.min(20, (p.score || 0) + 10))),
                opacity: 0.7,
                line: { width: 1, color: 'white' }
              },
              hovertemplate: '%{text}<extra></extra>'
            }]}
            layout={{
              title: `Opinion Map: ${topic}`,
              hovermode: 'closest',
              xaxis: { 
                zeroline: false, 
                title: reduction === 'umap' ? 'UMAP 1' : 'PC 1' 
              },
              yaxis: { 
                zeroline: false, 
                title: reduction === 'umap' ? 'UMAP 2' : 'PC 2' 
              },
              autosize: true,
              showlegend: false,
              plot_bgcolor: '#f8f9fa'
            }}
            style={{ width: '100%', height: 700 }}
            useResizeHandler
          />
          
          <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
            <p>
              • Each point represents a Reddit post or comment about "{topic}"
              <br />
              • Point size indicates Reddit score (upvotes - downvotes)
              <br />
              • Colors represent similarity groups based on semantic similarity (threshold: {similarityThreshold})
              <br />
              • Hover over points to read the full text
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
