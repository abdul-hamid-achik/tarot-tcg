'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onReset?: () => void
    showDetails?: boolean
}

interface State {
    hasError: boolean
    error?: Error
    errorInfo?: ErrorInfo
}

/**
 * Error Boundary for graceful error handling
 * Prevents entire app crashes when components throw errors
 */
export class GameErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    }

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details for debugging
        console.error('🔴 Game Error Boundary caught an error:', error, errorInfo)

        this.setState({
            error,
            errorInfo,
        })
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined })
        this.props.onReset?.()
    }

    private handleGoHome = () => {
        // Reset error state and navigate to home
        this.setState({ hasError: false, error: undefined, errorInfo: undefined })
        window.location.href = '/'
    }

    public render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default error UI
            return (
                <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-4">
                    <Card className="w-full max-w-md border-red-500/50 bg-black/40 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-8 w-8 text-red-500" />
                                <div>
                                    <CardTitle className="text-2xl text-red-400">
                                        Something Went Wrong
                                    </CardTitle>
                                    <CardDescription className="text-gray-400">
                                        The game encountered an unexpected error
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {this.props.showDetails && this.state.error && (
                                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-md">
                                    <p className="text-sm font-mono text-red-300 break-words">
                                        {this.state.error.message}
                                    </p>
                                    {this.state.errorInfo && (
                                        <details className="mt-2">
                                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                                                Show stack trace
                                            </summary>
                                            <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-32">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            <p className="text-sm text-gray-300">
                                Don't worry - your game progress might be saved. Try refreshing the page or
                                returning to the main menu.
                            </p>
                        </CardContent>

                        <CardFooter className="flex gap-2">
                            <Button
                                onClick={this.handleReset}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                            <Button
                                onClick={this.handleGoHome}
                                variant="outline"
                                className="flex-1"
                            >
                                <Home className="mr-2 h-4 w-4" />
                                Main Menu
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Specialized error boundary for game board
 * More lenient - tries to preserve game state
 */
export class GameBoardErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('🎮 Game Board Error:', error, errorInfo)

        this.setState({
            error,
            errorInfo,
        })
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined })
        this.props.onReset?.()
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-full bg-red-950/20 border border-red-500/30 rounded-lg p-8">
                    <div className="text-center space-y-4">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                        <div>
                            <h3 className="text-lg font-semibold text-red-400">
                                Game Board Error
                            </h3>
                            <p className="text-sm text-gray-400 mt-2">
                                {this.state.error?.message || 'An error occurred in the game board'}
                            </p>
                        </div>
                        <Button onClick={this.handleReset} variant="outline" size="sm">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reset Game Board
                        </Button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

