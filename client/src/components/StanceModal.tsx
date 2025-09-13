import React from 'react'
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

interface StanceModalProps {
  isOpen: boolean
  onClose: () => void
  userStance: string
  setUserStance: (stance: string) => void
  topic: string
  isLoading: boolean
  onSubmit: () => void
}

const StanceModal: React.FC<StanceModalProps> = ({
  isOpen,
  onClose,
  userStance,
  setUserStance,
  topic,
  isLoading,
  onSubmit
}) => {
  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500/75 dark:bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block w-full max-w-xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-dark-bg-elevated shadow-2xl rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-8 border-b border-gray-150 dark:border-dark-separator">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                Add Your Stance
              </h3>
              <p className="text-gray-500 dark:text-dark-text-tertiary mt-1">
                Share your perspective on "{topic}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn-minimal p-2"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-8 py-8">
            <div className="space-y-6">
              {/* Input field */}
              <div>
                <textarea
                  value={userStance}
                  onChange={(e) => setUserStance(e.target.value)}
                  placeholder="Share your perspective on this topic..."
                  rows={4}
                  className="input resize-none w-full"
                  autoFocus
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!userStance.trim() || isLoading}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Stance</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default StanceModal
