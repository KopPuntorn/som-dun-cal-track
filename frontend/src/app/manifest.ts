import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SomDun - Calorie Tracker',
        short_name: 'SomDun',
        description: 'Track your daily calories, macros,, water, and weight.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d1117',
        theme_color: '#bf5af2',
        icons: [
            {
                src: '/globe.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
            },
            {
                src: '/globe.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
            },
        ],
    }
}
