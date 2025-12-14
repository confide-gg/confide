/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Geist Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            },
            fontWeight: {
                thin: '100',
                extralight: '200',
                light: '300',
                normal: '400',
                medium: '500',
                semibold: '600',
                bold: '700',
                extrabold: '800',
                black: '900',
            },
            colors: {
                background: "#000000",
                "bg-elevated": "#0a0a0a",
                foreground: "#ffffff",
                card: "#0a0a0a",
                "card-hover": "#141414",
                primary: {
                    DEFAULT: "#ffffff",
                    foreground: "#000000",
                },
                secondary: "#1a1a1a",
                muted: {
                    DEFAULT: "#666666",
                    foreground: "#999999",
                },
                border: "#1a1a1a",
                "border-subtle": "#141414",
                destructive: "#ff4444",
                online: "#00ff88",
                sidebar: {
                    DEFAULT: "#000000",
                    foreground: "#ffffff",
                    accent: "#0a0a0a",
                    "accent-foreground": "#ffffff",
                    border: "#1a1a1a",
                },
            },
            borderRadius: {
                DEFAULT: "6px",
                lg: "8px",
            },
            boxShadow: {
                DEFAULT: "0 8px 32px rgba(0,0,0,0.5)",
                lg: "0 16px 48px rgba(0,0,0,0.6)",
            },
        },
    },
    plugins: [],
}
