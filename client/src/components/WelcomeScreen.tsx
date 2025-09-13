import React, { useState, useEffect } from 'react'
import { SparklesIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface WelcomeScreenProps {
  onAnalyze: (topic: string) => void
  isLoading: boolean
  loadingStatus: string
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onAnalyze, isLoading, loadingStatus }) => {
  const [topic, setTopic] = useState('')
  const [focused, setFocused] = useState(false)
  const [backgroundIndex, setBackgroundIndex] = useState(0)

  // Dynamic background gradients
  const backgrounds = [
    'from-blue-600 via-purple-600 to-indigo-700',
    'from-purple-600 via-pink-600 to-red-600',
    'from-indigo-600 via-blue-600 to-cyan-600',
    'from-pink-600 via-rose-600 to-orange-600',
    'from-emerald-600 via-teal-600 to-cyan-600',
  ]

  const suggestions = [
    'artificial intelligence',
    'climate change',
    'remote work',
    'cryptocurrency',
    'social media impact',
    'healthcare reform',
    'education system'
  ]

  // Cycle through backgrounds every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBackgroundIndex((prev) => (prev + 1) % backgrounds.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [backgrounds.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (topic.trim() && !isLoading) {
      onAnalyze(topic.trim())
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setTopic(suggestion)
    onAnalyze(suggestion)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-bg dark:to-dark-bg-secondary">
        <div className="text-center space-y-8 max-w-md mx-auto px-4">
          {/* Loading Animation */}
          <div className="relative">
            <div className="w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-dark-bg-tertiary"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <div className="mt-4 w-16 h-1 mx-auto bg-gray-200 dark:bg-dark-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-dark-text">
              Analyzing Perspectives
            </h2>
            <p className="text-lg text-gray-600 dark:text-dark-text-secondary">
              {loadingStatus || 'Processing your topic...'}
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-dark-text-tertiary">
              <SparklesIcon className="w-4 h-4 animate-pulse" />
              <span>This may take a moment</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-25 dark:bg-dark-bg">
      {/* Content */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center space-y-12">
          {/* Header */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-semibold text-gray-900 dark:text-dark-text tracking-tight">
              OpinionScope
            </h1>
            <p className="text-xl text-gray-600 dark:text-dark-text-secondary font-normal max-w-xl mx-auto leading-relaxed">
              Visualize public opinion on any topic
            </p>
          </div>

          {/* Search Interface */}
          <div className="space-y-8">
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Enter any topic to explore..."
                  className="input flex-1 text-lg"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!topic.trim() || isLoading}
                  className="btn-primary flex items-center space-x-2 whitespace-nowrap"
                >
                  <span>Analyze</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Suggestions */}
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-dark-text-tertiary text-sm font-medium">Try these popular topics:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-4 py-2 rounded-full bg-gray-100 dark:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text-secondary text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-bg-quaternary transition-colors duration-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen
