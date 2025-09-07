"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Swords, Shield, Package, Gift, Settings, Star, Moon, Sun, Sparkles } from "lucide-react"

interface MenuOption {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    color: string
    available: boolean
    route?: string
}

const menuOptions: MenuOption[] = [
    {
        id: "tutorial",
        title: "Tutorial",
        description: "Learn the mystical arts",
        icon: <BookOpen className="w-8 h-8" />,
        color: "text-accent",
        available: true,
        route: "/tutorial",
    },
    {
        id: "pvp",
        title: "PvP Arena",
        description: "Challenge other mystics",
        icon: <Swords className="w-8 h-8" />,
        color: "text-destructive",
        available: false,
    },
    {
        id: "pve",
        title: "Campaign",
        description: "Journey through realms",
        icon: <Shield className="w-8 h-8" />,
        color: "text-primary",
        available: false,
    },
    {
        id: "collections",
        title: "Collections",
        description: "Your tarot deck",
        icon: <Package className="w-8 h-8" />,
        color: "text-secondary",
        available: false,
    },
    {
        id: "loot",
        title: "Loot",
        description: "Mystical rewards",
        icon: <Gift className="w-8 h-8" />,
        color: "text-accent",
        available: false,
    },
    {
        id: "settings",
        title: "Settings",
        description: "Configure your experience",
        icon: <Settings className="w-8 h-8" />,
        color: "text-muted-foreground",
        available: false,
    },
]

export function GameHUD() {
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [hoveredOption, setHoveredOption] = useState<string | null>(null)
    const router = useRouter()

    const handleEnterAction = () => {
        if (selectedOption) {
            const option = menuOptions.find((opt) => opt.id === selectedOption)
            if (option && option.available && option.route) {
                router.push(option.route)
            }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-card relative overflow-hidden">
            {/* Mystical Background Elements */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 left-10 animate-pulse">
                    <Star className="w-6 h-6 text-primary" />
                </div>
                <div className="absolute top-32 right-20 animate-pulse delay-1000">
                    <Moon className="w-8 h-8 text-accent" />
                </div>
                <div className="absolute bottom-20 left-32 animate-pulse delay-500">
                    <Sun className="w-7 h-7 text-secondary" />
                </div>
                <div className="absolute bottom-40 right-10 animate-pulse delay-700">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="absolute top-1/2 left-1/4 animate-pulse delay-300">
                    <Star className="w-4 h-4 text-accent" />
                </div>
                <div className="absolute top-1/3 right-1/3 animate-pulse delay-1200">
                    <Moon className="w-5 h-5 text-secondary" />
                </div>
            </div>

            {/* Header */}
            <header className="relative z-10 p-6 text-center">
                <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">Mystic Tarot Arena</h1>
                <p className="text-muted-foreground text-lg">Unveil the secrets of the cards</p>
                <div className="flex justify-center items-center gap-4 mt-4">
                    <Badge variant="secondary" className="px-3 py-1">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Level 12 Mystic
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1">
                        <Star className="w-4 h-4 mr-1" />
                        1,247 Essence
                    </Badge>
                </div>
            </header>

            {/* Main Menu Grid */}
            <div className="relative z-10 flex-1 flex items-center justify-center p-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full">
                    {menuOptions.map((option) => (
                        <Card
                            key={option.id}
                            className={`
                relative group cursor-pointer transition-all duration-300 transform
                ${hoveredOption === option.id ? "scale-105 shadow-2xl" : "hover:scale-102"}
                ${selectedOption === option.id ? "ring-2 ring-primary shadow-primary/25" : ""}
                ${!option.available ? "opacity-50 cursor-not-allowed" : ""}
                bg-card/80 backdrop-blur-sm border-border/50
              `}
                            onMouseEnter={() => setHoveredOption(option.id)}
                            onMouseLeave={() => setHoveredOption(null)}
                            onClick={() => option.available && setSelectedOption(option.id)}
                        >
                            <CardContent className="p-6 text-center space-y-4">
                                {/* Icon with mystical glow effect */}
                                <div
                                    className={`
                  mx-auto w-16 h-16 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-card to-muted
                  ${hoveredOption === option.id ? "shadow-lg shadow-primary/25" : ""}
                  transition-all duration-300
                `}
                                >
                                    <div className={`${option.color} transition-colors duration-300`}>{option.icon}</div>
                                </div>

                                {/* Title and Description */}
                                <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-foreground">{option.title}</h3>
                                    <p className="text-sm text-muted-foreground text-pretty">{option.description}</p>
                                </div>

                                {/* Availability indicator */}
                                {!option.available && (
                                    <Badge variant="outline" className="text-xs">
                                        Coming Soon
                                    </Badge>
                                )}

                                {/* Mystical border effect on hover */}
                                <div
                                    className={`
                  absolute inset-0 rounded-lg border-2 border-transparent
                  ${hoveredOption === option.id ? "border-primary/30" : ""}
                  transition-all duration-300 pointer-events-none
                `}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Action Button */}
            {selectedOption && (
                <div className="relative z-10 text-center pb-8">
                    <Button
                        size="lg"
                        className="px-8 py-3 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                        onClick={handleEnterAction}
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Enter {menuOptions.find((opt) => opt.id === selectedOption)?.title}
                    </Button>
                </div>
            )}

            {/* Mystical footer */}
            <footer className="relative z-10 text-center p-4 text-muted-foreground text-sm">
                <p>The cards hold infinite wisdom • Choose your path wisely</p>
            </footer>
        </div>
    )
}
