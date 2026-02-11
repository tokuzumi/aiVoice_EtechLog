/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#000000",
                surface: "#0a0a0a",
                primary: "#ffffff",
                secondary: "#a1a1aa",
                accent: "#2563eb",
                border: "#27272a",
            },
            fontFamily: {
                main: ['Inter', 'sans-serif'],
                title: ['Outfit', 'sans-serif'],
            },
            animation: {
                'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
                'slide-up': 'slide-up 0.5s ease-out forwards',
                'orbit': 'orbit 20s linear infinite',
            },
            keyframes: {
                'pulse-soft': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
                    '50%': { transform: 'scale(1.05)', opacity: '1' },
                },
                'slide-up': {
                    'from': { opacity: '0', transform: 'translateY(20px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                'orbit': {
                    'from': { transform: 'rotate(0deg) translateX(100px) rotate(0deg)' },
                    'to': { transform: 'rotate(360deg) translateX(100px) rotate(-360deg)' },
                }
            },
        },
    },
    plugins: [],
}
