'use client'

import { useState, useEffect } from 'react'
import { Bug, X } from 'lucide-react'

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // Sadece development modunda göster
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  useEffect(() => {
    // Console log'ları yakala
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      setLogs(prev => [...prev.slice(-20), `LOG: ${args.join(' ')}`])
      originalLog(...args)
    }

    console.error = (...args) => {
      setLogs(prev => [...prev.slice(-20), `ERROR: ${args.join(' ')}`])
      originalError(...args)
    }

    console.warn = (...args) => {
      setLogs(prev => [...prev.slice(-20), `WARN: ${args.join(' ')}`])
      originalWarn(...args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-50"
        title="Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-80 bg-black text-green-400 rounded-lg shadow-2xl z-50 font-mono text-xs">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <span className="font-semibold">Debug Console</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-3 h-64 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-500">Henüz log yok...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 break-words">
              {log}
            </div>
          ))
        )}
      </div>
      
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={() => setLogs([])}
          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
        >
          Temizle
        </button>
      </div>
    </div>
  )
}