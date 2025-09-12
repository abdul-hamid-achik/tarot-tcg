'use client';

import { Card } from '@/schemas/gameSchemas';
import { Card as CardUI, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GameCardProps {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  showStats?: boolean;
}

export function GameCard({ 
  card, 
  isSelected = false, 
  onClick, 
  size = 'medium',
  showStats = true 
}: GameCardProps) {
  const sizeClasses = {
    small: 'w-16 h-20',
    medium: 'w-24 h-32',
    large: 'w-32 h-44'
  };

  const fontSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <CardUI 
      className={cn(
        sizeClasses[size],
        'cursor-pointer transition-all hover:scale-105 hover:shadow-lg',
        'bg-gradient-to-br from-purple-900/90 to-indigo-900/90 border-purple-600',
        isSelected && 'ring-2 ring-yellow-400 scale-105',
        'relative overflow-hidden'
      )}
      onClick={onClick}
    >
      <CardHeader className={cn('p-1', fontSize[size])}>
        <div className="flex justify-between items-start">
          <span className="text-blue-300 font-bold">{card.cost}</span>
          {card.tarotSymbol && (
            <span className="text-yellow-300">{card.tarotSymbol}</span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={cn('p-1 flex flex-col justify-between h-full', fontSize[size])}>
        <div className="text-center">
          <p className="font-semibold text-white truncate">{card.name}</p>
          {size !== 'small' && card.description && (
            <p className="text-xs text-gray-300 mt-1 line-clamp-2">{card.description}</p>
          )}
        </div>
        
        {showStats && card.type === 'unit' && (
          <div className="flex justify-between mt-auto">
            <span className="text-orange-300 font-bold">⚔️ {card.attack}</span>
            <span className="text-red-400 font-bold">❤️ {card.health}</span>
          </div>
        )}
      </CardContent>
    </CardUI>
  );
}