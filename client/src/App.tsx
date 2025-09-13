import { useState, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { 
  ChartBarIcon, 
  ChatBubbleBottomCenterTextIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  UserIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'
import './App.css'

type Point = { 
  id: number; 
  x: number; 
  y: number; 
  text: string; 
  cluster: number | null;
  score?: number;
  subreddit?: string;
  embedding?: number[];
  is_user_stance?: boolean;
  similarity_to_user?: number;
}

interface StanceResult {
  points: Point[];
  user_stance_similarity: number;
  most_similar_opinion: string;
  similar_points_count: number;
  topic: string;
}

function App() {
  const [topic, setTopic] = useState('gun control')
  const [reduction, setReduction] = useState<'pca' | 'umap' | 'tsne'>('umap')
  const [clusteringMethod, setClusteringMethod] = useState<'kmeans' | 'hdbscan'>('kmeans')
  const [nClusters, setNClusters] = useState(5)
  const [maxPosts, setMaxPosts] = useState(50)
  const [points, setPoints] = useState<Point[]>([])  
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [totalOpinions, setTotalOpinions] = useState<number | null>(null)
  const [totalClusters, setTotalClusters] = useState<number | null>(null)
  
  // User stance state
  const [userStance, setUserStance] = useState('')
  const [stanceSubmitted, setStanceSubmitted] = useState(false)
  const [stanceLoading, setStanceLoading] = useState(false)
  const [stanceResult, setStanceResult] = useState<StanceResult | null>(null)
  const [showStanceModal, setShowStanceModal] = useState(false)

  const handleProcess = useCallback(async () => {
    if (!topic.trim()) {
      alert('Please enter a topic')
      return
    }
    
    setLoading(true)
    setPoints([])
    setTotalOpinions(null)
    setTotalClusters(null)
    setStanceSubmitted(false)
    setStanceResult(null)
    setLoadingStatus('Analyzing Reddit discussions...')
    
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic.trim(), 
          reduction, 
          clustering_method: clusteringMethod,
          n_clusters: nClusters,
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
      setTotalClusters(data.total_clusters)
    } catch (err) {
      console.error('Request failed:', err)
      alert(`Request failed: ${err}`)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }, [topic, reduction, clusteringMethod, nClusters, maxPosts])

  const handleSubmitStance = useCallback(async () => {
    if (!userStance.trim() || points.length === 0) {
      return
    }

    setStanceLoading(true)
    
    try {
      const res = await fetch('/api/add_user_stance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          user_statement: userStance.trim(),
          existing_points: points,
          reduction
        }),
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Server error:', res.status, errorText)
        alert(`Server error: ${res.status} - ${errorText}`)
        return
      }
      
      const data: StanceResult = await res.json()
      setStanceResult(data)
      setPoints(data.points as Point[])
      setStanceSubmitted(true)
      setShowStanceModal(false)
    } catch (err) {
      console.error('Request failed:', err)
      alert(`Request failed: ${err}`)
    } finally {
      setStanceLoading(false)
    }
  }, [userStance, points, topic, reduction])

  const resetStance = () => {
    setUserStance('')
    setStanceSubmitted(false)
    setStanceResult(null)
    setShowStanceModal(false)
    // Remove user stance from points
    setPoints(prev => prev.filter(p => !p.is_user_stance))
  }

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return '#22c55e' // green
    if (similarity >= 0.6) return '#eab308' // yellow  
    if (similarity >= 0.4) return '#f97316' // orange
    return '#ef4444' // red
  }

  const plotData = points.length > 0 ? [
    // Regular points
    {
      x: points.filter(p => !p.is_user_stance).map(p => p.x),
      y: points.filter(p => !p.is_user_stance).map(p => p.y),
      text: points.filter(p => !p.is_user_stance).map(p => 
        `${p.text}<br><br>Subreddit: r/${p.subreddit}<br>Score: ${p.score}${
          stanceResult ? `<br>Similarity to your stance: ${(p.similarity_to_user! * 100).toFixed(1)}%` : ''
        }`
      ),
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Reddit Opinions',
      marker: { 
        color: stanceResult 
          ? points.filter(p => !p.is_user_stance).map(p => getSimilarityColor(p.similarity_to_user || 0))
          : points.filter(p => !p.is_user_stance).map(p => (p.cluster ?? 0)), 
        colorscale: stanceResult ? undefined : 'Viridis', 
        size: points.filter(p => !p.is_user_stance).map(p => 
          Math.max(8, Math.min(25, Math.log((p.score || 0) + 10) * 4))
        ),
        opacity: 0.7,
        line: { width: 1, color: 'rgba(255,255,255,0.8)' },
        showscale: !stanceResult,
        colorbar: !stanceResult ? {
          title: "Cluster",
          titleside: "right"
        } : undefined
      },
      hovertemplate: '%{text}<extra></extra>'
    },
    // User stance point (if exists)
    ...(points.some(p => p.is_user_stance) ? [{
      x: points.filter(p => p.is_user_stance).map(p => p.x),
      y: points.filter(p => p.is_user_stance).map(p => p.y),
      text: points.filter(p => p.is_user_stance).map(p => 
        `<b>Your Stance:</b><br>${p.text}<br><br>Positioned based on similarity to Reddit opinions`
      ),
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Your Stance',
      marker: { 
        color: '#3b82f6',
        size: 20,
        symbol: 'star',
        line: { width: 3, color: 'white' }
      },
      hovertemplate: '%{text}<extra></extra>'
    }] : [])
  ] : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="w-10 h-10 text-primary-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">OpinionScope</h1>
                  <p className="text-sm text-gray-500 mt-1">Visualize and explore public opinion landscapes</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {points.length > 0 && !stanceSubmitted && (
                  <button
                    onClick={() => setShowStanceModal(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Add Your Stance</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Cog6ToothIcon className="w-5 h-5 mr-2" />
                  Analysis Settings
                </h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Topic to analyze
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., climate change, artificial intelligence"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter any social or political topic
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visualization Method
                    </label>
                    <select 
                      value={reduction} 
                      onChange={(e) => setReduction(e.target.value as 'pca' | 'umap' | 'tsne')}
                      className="input"
                    >
                      <option value="umap">UMAP (Recommended)</option>
                      <option value="tsne">t-SNE</option>
                      <option value="pca">PCA</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clustering Method
                    </label>
                    <select 
                      value={clusteringMethod} 
                      onChange={(e) => setClusteringMethod(e.target.value as 'kmeans' | 'hdbscan')}
                      className="input"
                    >
                      <option value="kmeans">K-Means</option>
                      <option value="hdbscan">HDBSCAN</option>
                    </select>
                  </div>
                  
                  {clusteringMethod === 'kmeans' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Clusters
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={15}
                        value={nClusters}
                        onChange={(e) => setNClusters(Number(e.target.value))}
                        className="input"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sample Size
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={maxPosts}
                      onChange={(e) => setMaxPosts(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>
                
                <button 
                  onClick={handleProcess} 
                  disabled={loading || !topic.trim()} 
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{loadingStatus || 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5" />
                      <span>Analyze Topic</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Stance Status Card */}
            {points.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <UserIcon className="w-5 h-5 mr-2" />
                    Your Stance
                  </h3>
                </div>
                
                {stanceSubmitted && stanceResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center text-green-600">
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      <span className="font-medium">Stance Added</span>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-800 font-medium mb-2">Your statement:</p>
                      <p className="text-sm text-blue-700">"{userStance}"</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Similarity Score:</span>
                        <span className="ml-2 text-lg font-bold text-primary-600">
                          {(stanceResult.user_stance_similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Similar Opinions Found:</span>
                        <span className="ml-2 text-gray-900">{stanceResult.similar_points_count}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={resetStance}
                      className="btn-secondary w-full flex items-center justify-center space-x-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      <span>Change Stance</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <ChatBubbleBottomCenterTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">
                      Share your perspective on "{topic}" to see where you stand
                    </p>
                    <button
                      onClick={() => setShowStanceModal(true)}
                      className="btn-primary w-full"
                    >
                      Add Your Stance
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stats Card */}
            {totalOpinions && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <InformationCircleIcon className="w-5 h-5 mr-2" />
                    Analysis Results
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Opinions Analyzed:</span>
                    <span className="font-semibold text-gray-900">{totalOpinions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Clusters Found:</span>
                    <span className="font-semibold text-gray-900">{totalClusters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Method:</span>
                    <span className="font-semibold text-gray-900 capitalize">{reduction}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visualization */}
          <div className="lg:col-span-3">
            <div className="card">
              {points.length > 0 ? (
                <div>
                  <div className="card-header">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Opinion Landscape: {topic}
                    </h2>
                    {stanceResult && (
                      <p className="text-sm text-gray-600 mt-1">
                        Colors now show similarity to your stance (green = high similarity, red = low similarity)
                      </p>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Plot
                      data={plotData}
                      layout={{
                        hovermode: 'closest',
                        xaxis: { 
                          zeroline: false, 
                          title: reduction === 'umap' ? 'UMAP 1' : reduction === 'tsne' ? 't-SNE 1' : 'PC 1',
                          showgrid: true,
                          gridwidth: 1,
                          gridcolor: 'rgba(156,163,175,0.2)'
                        },
                        yaxis: { 
                          zeroline: false, 
                          title: reduction === 'umap' ? 'UMAP 2' : reduction === 'tsne' ? 't-SNE 2' : 'PC 2',
                          showgrid: true,
                          gridwidth: 1,
                          gridcolor: 'rgba(156,163,175,0.2)'
                        },
                        autosize: true,
                        showlegend: stanceSubmitted,
                        plot_bgcolor: '#f9fafb',
                        paper_bgcolor: 'white',
                        font: { family: 'Inter, system-ui, sans-serif' },
                        margin: { l: 60, r: 60, t: 60, b: 60 }
                      }}
                      style={{ width: '100%', height: '600px' }}
                      useResizeHandler
                      config={{
                        displayModeBar: true,
                        displaylogo: false,
                        modeBarButtonsToRemove: ['pan2d', 'lasso2d']
                      }}
                    />
                  </div>
                  
                  <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">How to Read This Visualization</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>• Each point represents a Reddit post or comment about "{topic}"</p>
                      <p>• Point size indicates Reddit engagement (upvotes - downvotes)</p>
                      <p>• {stanceResult ? 'Colors show similarity to your stance' : `Colors represent ${totalClusters} distinct opinion clusters`}</p>
                      <p>• {stanceSubmitted ? 'Your stance appears as a blue star' : 'Hover over points to read full text'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Ready to Explore Opinions
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Enter a topic above and click "Analyze Topic" to visualize the opinion landscape
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stance Modal */}
      {showStanceModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Share Your Stance</h3>
                <button
                  onClick={() => setShowStanceModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's your perspective on "{topic}"?
                </label>
                <textarea
                  value={userStance}
                  onChange={(e) => setUserStance(e.target.value)}
                  placeholder="Share your thoughts, opinion, or stance on this topic. Be as detailed or brief as you'd like."
                  rows={4}
                  className="input resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll position your stance on the visualization based on similarity to existing opinions
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start">
                  <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">How it works:</p>
                    <p>Your statement will be analyzed using AI to understand its meaning, then positioned among similar opinions in the visualization. You'll see how closely your views align with different opinion clusters.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowStanceModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitStance}
                disabled={!userStance.trim() || stanceLoading}
                className="btn-primary flex items-center space-x-2"
              >
                {stanceLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Positioning...</span>
                  </>
                ) : (
                  <span>Add to Visualization</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App