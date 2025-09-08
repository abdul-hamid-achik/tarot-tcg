"use client"

import React from 'react'
import { Star, Moon, Sun, Sparkles } from 'lucide-react'

export default function BackgroundEffects() {
  return (
    <div className="fixed inset-0 opacity-5 pointer-events-none overflow-hidden">
      {/* Primary celestial bodies */}
      <div className="absolute top-10 left-10 animate-pulse">
        <Star className="w-6 h-6 text-purple-400" />
      </div>
      
      <div className="absolute top-32 right-20 animate-pulse delay-1000">
        <Moon className="w-8 h-8 text-indigo-400" />
      </div>
      
      <div className="absolute bottom-20 left-1/4 animate-pulse delay-500">
        <Sun className="w-7 h-7 text-amber-400" />
      </div>
      
      <div className="absolute top-1/2 right-10 animate-pulse delay-1500">
        <Sparkles className="w-5 h-5 text-violet-400" />
      </div>

      {/* Additional scattered stars */}
      <div className="absolute top-1/4 left-1/3 animate-pulse delay-2000">
        <Star className="w-4 h-4 text-blue-300" />
      </div>
      
      <div className="absolute bottom-1/3 right-1/3 animate-pulse delay-700">
        <Star className="w-3 h-3 text-cyan-400" />
      </div>
      
      <div className="absolute top-3/4 left-1/6 animate-pulse delay-1200">
        <Sparkles className="w-4 h-4 text-pink-400" />
      </div>
      
      <div className="absolute top-1/6 right-1/2 animate-pulse delay-800">
        <Star className="w-5 h-5 text-emerald-400" />
      </div>

      {/* Subtle constellation lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: -1 }}>
        <defs>
          <linearGradient id="constellation" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.1 }} />
            <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        
        {/* Connecting lines between celestial bodies */}
        <line 
          x1="10%" y1="15%" 
          x2="25%" y2="30%" 
          stroke="url(#constellation)" 
          strokeWidth="1" 
          className="animate-pulse delay-500"
        />
        <line 
          x1="85%" y1="25%" 
          x2="75%" y2="45%" 
          stroke="url(#constellation)" 
          strokeWidth="1" 
          className="animate-pulse delay-1000"
        />
        <line 
          x1="30%" y1="75%" 
          x2="50%" y2="60%" 
          stroke="url(#constellation)" 
          strokeWidth="1" 
          className="animate-pulse delay-1500"
        />
      </svg>

      {/* Floating particles */}
      <div className="absolute top-1/5 left-1/5">
        <div className="w-1 h-1 bg-white rounded-full animate-ping delay-3000" />
      </div>
      <div className="absolute bottom-1/5 right-1/5">
        <div className="w-1 h-1 bg-purple-300 rounded-full animate-ping delay-4000" />
      </div>
      <div className="absolute top-2/5 left-4/5">
        <div className="w-1 h-1 bg-blue-300 rounded-full animate-ping delay-5000" />
      </div>
    </div>
  )
}
