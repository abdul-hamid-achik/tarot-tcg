"use client"

import { useState, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CardSearchProps {
  onSearchChange: (query: string) => void
  onFilterChange: (filters: SearchFilters) => void
  searchQuery: string
  filters: SearchFilters
  totalResults: number
}

export interface SearchFilters {
  zodiacClass?: string
  element?: string
  type?: string
  rarity?: string
  costRange?: { min: number; max: number }
}

const filterOptions = {
  zodiacClass: [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ],
  element: ['fire', 'water', 'air', 'earth'],
  type: ['unit', 'spell'],
  rarity: ['common', 'uncommon', 'rare', 'legendary', 'mythic']
}

export function CardSearch({ 
  onSearchChange, 
  onFilterChange, 
  searchQuery, 
  filters, 
  totalResults 
}: CardSearchProps) {
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== '' && 
      !(typeof value === 'object' && value.min === 0 && value.max === 10)
    ).length
  }, [filters])

  const handleFilterChange = (key: keyof SearchFilters, value: string | undefined) => {
    if (value === 'all' || value === '') {
      const newFilters = { ...filters }
      delete newFilters[key]
      onFilterChange(newFilters)
    } else {
      onFilterChange({ ...filters, [key]: value })
    }
  }

  const handleCostRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0
    const currentRange = filters.costRange || { min: 0, max: 10 }
    const newRange = { ...currentRange, [type]: numValue }
    
    if (newRange.min === 0 && newRange.max === 10) {
      const newFilters = { ...filters }
      delete newFilters.costRange
      onFilterChange(newFilters)
    } else {
      onFilterChange({ ...filters, costRange: newRange })
    }
  }

  const clearAllFilters = () => {
    onFilterChange({})
    onSearchChange('')
  }

  const clearFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFilterChange(newFilters)
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search cards by name, description, or abilities..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null
            
            const displayValue = typeof value === 'object' 
              ? `Cost: ${value.min}-${value.max}`
              : String(value)
            
            return (
              <Badge 
                key={key} 
                variant="secondary" 
                className="flex items-center space-x-1"
              >
                <span className="capitalize">{displayValue}</span>
                <button 
                  onClick={() => clearFilter(key as keyof SearchFilters)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )
          })}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-red-600 hover:text-red-800"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        {totalResults} {totalResults === 1 ? 'card' : 'cards'} found
        {searchQuery && ` for "${searchQuery}"`}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Zodiac Class Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Zodiac Class</label>
              <Select 
                value={filters.zodiacClass || 'all'} 
                onValueChange={(value) => handleFilterChange('zodiacClass', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {filterOptions.zodiacClass.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Element Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Element</label>
              <Select 
                value={filters.element || 'all'} 
                onValueChange={(value) => handleFilterChange('element', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Elements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Elements</SelectItem>
                  {filterOptions.element.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select 
                value={filters.type || 'all'} 
                onValueChange={(value) => handleFilterChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {filterOptions.type.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rarity Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Rarity</label>
              <Select 
                value={filters.rarity || 'all'} 
                onValueChange={(value) => handleFilterChange('rarity', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Rarities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  {filterOptions.rarity.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost Range Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Mana Cost</label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={10}
                  value={filters.costRange?.min || 0}
                  onChange={(e) => handleCostRangeChange('min', e.target.value)}
                  className="w-16"
                />
                <span className="text-gray-500">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={10}
                  value={filters.costRange?.max || 10}
                  onChange={(e) => handleCostRangeChange('max', e.target.value)}
                  className="w-16"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}