import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme()

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <SunIcon className="h-5 w-5" />
      case 'dark':
        return <MoonIcon className="h-5 w-5" />
      case 'system':
        return <ComputerDesktopIcon className="h-5 w-5" />
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-3 rounded-2xl bg-gray-100 dark:bg-dark-bg-tertiary hover:bg-gray-200 dark:hover:bg-dark-bg-quaternary transition-colors duration-200"
      title={`Theme: ${theme}`}
    >
      {getIcon()}
    </button>
  )
}

export default ThemeToggle
