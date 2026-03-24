/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand': {
                    DEFAULT: '#6366f1', // indigo-500
                    dark: '#4338ca',    // indigo-700
                    light: '#818cf8',   // indigo-400
                },
                'dark': {
                    bg: '#050505',
                    card: '#111827',
                    border: '#1f2937',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'blob': 'blob 7s infinite',
                'glow': 'glow 3s ease-in-out infinite alternate',
                'spin-slow': 'spin 8s linear infinite',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)' },
                    '100%': { boxShadow: '0 0 40px rgba(99, 102, 241, 0.6)' },
                }
            }
        },
    },
    plugins: [],
}
