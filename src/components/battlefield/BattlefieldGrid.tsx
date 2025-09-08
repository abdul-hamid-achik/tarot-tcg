"use client"

import React, { useEffect, useRef } from 'react'
import { useGameStore, type CellPosition, getCellType } from '@/store/gameStore'
import { gridMathService } from '@/services/GridMathService'
import GridCell from './GridCell'

interface BattlefieldGridProps {
    className?: string
}

export default function BattlefieldGrid({ className = '' }: BattlefieldGridProps) {
    const gridRef = useRef<HTMLDivElement>(null)
    const { gameState } = useGameStore()

    // Update grid dimensions when component mounts or resizes
    useEffect(() => {
        const updateDimensions = () => {
            if (gridRef.current) {
                gridMathService.updateDimensions(gridRef.current)
            }
        }

        updateDimensions()
        window.addEventListener('resize', updateDimensions)
        return () => window.removeEventListener('resize', updateDimensions)
    }, [])

    // Initialize grid from game state
    useEffect(() => {
        if (gameState) {
            // This would be handled by the GridManagerService in practice
            // For now, we'll initialize directly from game state
        }
    }, [gameState])

    const renderGridRow = (rowIndex: 0 | 1 | 2 | 3) => {
        const cells = []

        for (let colIndex = 0; colIndex < 6; colIndex++) {
            const position: CellPosition = {
                row: rowIndex,
                col: colIndex as 0 | 1 | 2 | 3 | 4 | 5
            }

            cells.push(
                <GridCell
                    key={`cell-${rowIndex}-${colIndex}`}
                    position={position}
                    cellType={getCellType(position)}
                />
            )
        }

        return cells
    }

    const getRowLabel = (rowIndex: number): string => {
        switch (rowIndex) {
            case 0: return 'Enemy Bench'
            case 1: return 'Enemy Attack'
            case 2: return 'Your Attack'
            case 3: return 'Your Bench'
            default: return ''
        }
    }


    return (
        <div
            ref={gridRef}
            className={`bg-slate-800/30 rounded-lg p-6 border border-slate-600 ${className}`}
        >
            <div className="grid grid-cols-[100px_1fr] gap-2 items-stretch">
                {/* Enemy Bench Row */}
                <div className="text-xs text-slate-400 flex items-center justify-end pr-3">
                    {getRowLabel(0)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                    {renderGridRow(0)}
                </div>

                {/* Enemy Attack Row */}
                <div className="text-xs text-slate-400 flex items-center justify-end pr-3">
                    {getRowLabel(1)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                    {renderGridRow(1)}
                </div>

                {/* Divider between enemy and player zones */}
                <div className="col-span-2 border-t border-slate-600/50 my-3"></div>

                {/* Player Attack Row */}
                <div className="text-xs text-slate-400 flex items-center justify-end pr-3">
                    {getRowLabel(2)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                    {renderGridRow(2)}
                </div>

                {/* Player Bench Row */}
                <div className="text-xs text-slate-400 flex items-center justify-end pr-3">
                    {getRowLabel(3)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                    {renderGridRow(3)}
                </div>
            </div>
        </div>
    )
}
