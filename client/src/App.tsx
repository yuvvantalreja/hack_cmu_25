import { useState, useCallback } from 'react'
import { 
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/24/solid'
import WelcomeScreen from './components/WelcomeScreen'
import ResultsDisplay from './components/ResultsDisplay'
import StanceModal from './components/StanceModal'
import ThemeToggle from './components/ThemeToggle'

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

type AppState = 'welcome' | 'results' | 'settings'

function App() {
  // App state
  const [appState, setAppState] = useState<AppState>('welcome')
  const [topic, setTopic] = useState('')
  
  // Analysis settings
  const [reduction, setReduction] = useState<'pca' | 'umap' | 'tsne'>('umap')
  const [maxPosts, setMaxPosts] = useState(50)
  
  // Results data
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
  
  // Settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  const handleAnalyze = useCallback(async (analyzeTopic: string) => {
    if (!analyzeTopic.trim()) {
      alert('Please enter a topic')
      return
    }
    
    setTopic(analyzeTopic)
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
          topic: analyzeTopic.trim(), 
          reduction, 
          clustering_method: 'kmeans',
          n_clusters: 5,
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
      setAppState('results')
    } catch (err) {
      console.error('Request failed:', err)
      alert(`Request failed: ${err}`)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }, [reduction, maxPosts])

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

  const handleBackToSearch = () => {
    setAppState('welcome')
    setPoints([])
    setTotalOpinions(null)
    setTotalClusters(null)
    setStanceSubmitted(false)
    setStanceResult(null)
    setUserStance('')
  }

  // Render welcome screen or results
  if (appState === 'welcome' || loading) {
    return (
      <>
        <WelcomeScreen 
          onAnalyze={handleAnalyze}
          isLoading={loading}
          loadingStatus={loadingStatus}
        />
        
        {/* Settings Panel (floating) */}
        {showAdvancedSettings && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 transition-opacity bg-gray-500/75 dark:bg-black/75 backdrop-blur-sm"
                onClick={() => setShowAdvancedSettings(false)}
              />
              
              <div className="inline-block w-full max-w-sm my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-dark-bg-elevated shadow-2xl rounded-3xl">
                <div className="px-6 py-6 border-b border-gray-150 dark:border-dark-separator">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                      Settings
                    </h3>
                    <button
                      onClick={() => setShowAdvancedSettings(false)}
                      className="btn-minimal p-1"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="px-6 py-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Method
                    </label>
                    <select 
                      value={reduction} 
                      onChange={(e) => setReduction(e.target.value as 'pca' | 'umap' | 'tsne')}
                      className="input"
                    >
                      <option value="umap">UMAP</option>
                      <option value="tsne">t-SNE</option>
                      <option value="pca">PCA</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
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
              </div>
            </div>
          </div>
        )}

        {/* Floating Controls (only on welcome screen) */}
        {appState === 'welcome' && !loading && (
          <div className="fixed top-6 right-6 z-30 flex items-center space-x-3">
            <button
              onClick={() => setShowAdvancedSettings(true)}
              className="p-3 rounded-2xl bg-gray-100 dark:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-bg-quaternary transition-colors duration-200"
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        )}
      </>
    )
  }

  // Render results screen
  return (
    <>
      <ResultsDisplay
        points={points}
        topic={topic}
        totalOpinions={totalOpinions}
        totalClusters={totalClusters}
        reduction={reduction}
        stanceResult={stanceResult}
        stanceSubmitted={stanceSubmitted}
        userStance={userStance}
        onAddStance={() => setShowStanceModal(true)}
        onResetStance={resetStance}
        onBackToSearch={handleBackToSearch}
      />
      
      {/* Stance Modal */}
      <StanceModal
        isOpen={showStanceModal}
        onClose={() => setShowStanceModal(false)}
        userStance={userStance}
        setUserStance={setUserStance}
        topic={topic}
        isLoading={stanceLoading}
        onSubmit={handleSubmitStance}
      />
    </>
  )
}

export default App