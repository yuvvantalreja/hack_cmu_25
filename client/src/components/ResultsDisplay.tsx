import React from 'react'
import Plot from 'react-plotly.js'
import { 
  ChartBarIcon, 
  UserIcon
} from '@heroicons/react/24/outline'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'


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

interface ResultsDisplayProps {
  points: Point[]
  topic: string
  totalOpinions: number | null
  totalClusters: number | null
  reduction: string
  stanceResult: StanceResult | null
  stanceSubmitted: boolean
  userStance: string
  onAddStance: () => void
  onResetStance: () => void
  onBackToSearch: () => void
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  points,
  topic,
  totalOpinions,
  totalClusters,
  reduction,
  stanceResult,
  stanceSubmitted,
  userStance,
  onAddStance,
  onResetStance,
  onBackToSearch
}) => {
  const { isDark } = useTheme()

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
        line: { width: 1, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.2)' },
        showscale: !stanceResult,
        colorbar: !stanceResult ? {
          title: { text: "Cluster" },
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
        line: { width: 3, color: isDark ? 'white' : 'white' }
      },
      hovertemplate: '%{text}<extra></extra>'
    }] : [])
  ] : []

  return (
    <div className="min-h-screen bg-gray-25 dark:bg-dark-bg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-dark-separator bg-white/80 dark:bg-dark-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <button
                onClick={onBackToSearch}
                className="flex items-center space-x-3 text-gray-900 dark:text-dark-text hover:text-gray-600 dark:hover:text-dark-text-secondary transition-colors"
              >
                <ChartBarIcon className="w-6 h-6" />
                <span className="font-medium text-lg">OpinionScope</span>
              </button>
              <div className="h-6 w-px bg-gray-300 dark:bg-dark-separator"></div>
              <h2 className="font-medium text-gray-700 dark:text-dark-text-secondary">
                {topic}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {points.length > 0 && !stanceSubmitted && (
                <button
                  onClick={onAddStance}
                  className="btn-primary flex items-center space-x-2"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Add Your Stance</span>
                </button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Stats Card */}
            {totalOpinions && (
              <div className="card-minimal">
                <h3 className="text-base font-semibold text-gray-900 dark:text-dark-text mb-4">
                  Analysis
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Opinions</span>
                    <span className="font-medium text-gray-900 dark:text-dark-text">{totalOpinions}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Clusters</span>
                    <span className="font-medium text-gray-900 dark:text-dark-text">{totalClusters}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Method</span>
                    <span className="font-medium text-gray-900 dark:text-dark-text capitalize">{reduction}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stance Status Card */}
            {points.length > 0 && (
              <div className="card-minimal">
                <h3 className="text-base font-semibold text-gray-900 dark:text-dark-text mb-4">
                  Your Stance
                </h3>
                
                {stanceSubmitted && stanceResult ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2 uppercase tracking-wide">Your Opinion</p>
                      <p className="text-sm text-blue-900 dark:text-blue-100">"{userStance}"</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Similarity</span>
                        <span className="font-semibold text-gray-900 dark:text-dark-text">
                          {(stanceResult.user_stance_similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Similar opinions</span>
                        <span className="font-semibold text-gray-900 dark:text-dark-text">{stanceResult.similar_points_count}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={onResetStance}
                      className="btn-secondary w-full text-sm"
                    >
                      Change Stance
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500 dark:text-dark-text-tertiary mb-4">
                      Add your perspective to see where you stand
                    </p>
                    <button
                      onClick={onAddStance}
                      className="btn-primary w-full"
                    >
                      Add Stance
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button 
                onClick={onBackToSearch}
                className="btn-secondary w-full"
              >
                New Analysis
              </button>
            </div>
          </div>

          {/* Visualization */}
          <div className="lg:col-span-4">
            <div className="card">
              {points.length > 0 ? (
                <div>
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-dark-text mb-2">
                      Opinion Landscape
                    </h2>
                    {stanceResult && (
                      <p className="text-gray-600 dark:text-dark-text-secondary">
                        Colors indicate similarity to your stance
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
                          title: { 
                            text: reduction === 'umap' ? 'UMAP 1' : reduction === 'tsne' ? 't-SNE 1' : 'PC 1',
                            font: { color: isDark ? '#ebebf5' : '#374151' }
                          },
                          showgrid: true,
                          gridwidth: 1,
                          gridcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(156,163,175,0.2)',
                          tickfont: { color: isDark ? '#ebebf599' : '#6b7280' }
                        },
                        yaxis: { 
                          zeroline: false, 
                          title: {
                            text: reduction === 'umap' ? 'UMAP 2' : reduction === 'tsne' ? 't-SNE 2' : 'PC 2',
                            font: { color: isDark ? '#ebebf5' : '#374151' }
                          },
                          showgrid: true,
                          gridwidth: 1,
                          gridcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(156,163,175,0.2)',
                          tickfont: { color: isDark ? '#ebebf599' : '#6b7280' }
                        },
                        autosize: true,
                        showlegend: stanceSubmitted,
                        plot_bgcolor: isDark ? '#1c1c1e' : '#f9fafb',
                        paper_bgcolor: isDark ? '#1c1c1e' : 'white',
                        font: { family: 'Inter, system-ui, sans-serif', color: isDark ? '#ebebf5' : '#374151' },
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
                  
                  <div className="mt-8 pt-6 border-t border-gray-150 dark:border-dark-separator">
                    <div className="text-sm text-gray-500 dark:text-dark-text-tertiary space-y-1">
                      <p>Each point represents an opinion about "{topic}"</p>
                      <p>{stanceResult ? 'Colors show similarity to your stance' : `${totalClusters} opinion clusters identified`}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <ChartBarIcon className="w-16 h-16 text-gray-400 dark:text-dark-text-quaternary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
                    No Data Available
                  </h3>
                  <p className="text-gray-500 dark:text-dark-text-tertiary mb-6">
                    Unable to load visualization data
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsDisplay
