/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ------------------------------------------------------------------
        // Palette modelled on Spotify's surface ladder: a pure-black app shell
        // with panels floating on top of it, each step up the ladder lifting
        // the surface toward the viewer.
        //
        // Token names are kept from the previous Material-style scheme so the
        // whole app re-themes from one place rather than every component
        // needing to be rewritten.
        // ------------------------------------------------------------------
        // Figma calls the nav column pure black and the player bar #181818;
        // the content column sits between them at #121212 under the hero
        // gradient. Nothing floats, so there is no separate "shell" colour.
        "background": "#000000",                    // nav column + app frame
        "surface-container-lowest": "#121212",      // main content column
        "surface-container-low": "#181818",         // player bar
        "surface-container": "#181818",
        "surface-container-high": "#282828",        // raised control / menu
        "surface-container-highest": "#3E3E3E",     // pressed
        "surface": "#121212",
        "surface-dim": "#0A0A0A",
        "surface-bright": "#282828",
        "surface-variant": "#242424",
        "surface-tint": "#1ED760",

        // Foregrounds
        "on-background": "#FFFFFF",
        "on-surface": "#FFFFFF",
        // Figma uses #b3b3b3, #adadad and #a6a6a6 in different places. They are
        // within 13/255 of each other — indistinguishable in situ, and three
        // near-identical greys is exactly the token drift that made the old
        // palette unmaintainable. All three collapse to this one value.
        "on-surface-variant": "#B3B3B3",            // subdued body text
        "outline": "#727272",                       // subdued icons
        "outline-variant": "#292929",               // hairlines

        // Brand accent
        "primary": "#1ED760",
        "primary-fixed": "#3BE477",                 // hover (brighter)
        "primary-fixed-dim": "#1DB954",             // pressed (classic green)
        "primary-container": "#1DB954",
        "on-primary": "#000000",                    // black on green
        "on-primary-container": "#000000",
        "on-primary-fixed": "#000000",
        "on-primary-fixed-variant": "#000000",
        "inverse-primary": "#1DB954",

        // Neutral secondary
        "secondary": "#B3B3B3",
        "secondary-container": "#282828",
        "on-secondary": "#000000",
        "on-secondary-container": "#FFFFFF",
        "secondary-fixed": "#E5E5E5",
        "secondary-fixed-dim": "#B3B3B3",
        "on-secondary-fixed": "#000000",
        "on-secondary-fixed-variant": "#282828",

        // Tertiary reads as "muted white surface" rather than a second hue
        "tertiary": "#FFFFFF",
        "tertiary-container": "#282828",
        "tertiary-fixed": "#FFFFFF",
        "tertiary-fixed-dim": "#B3B3B3",
        "on-tertiary": "#000000",
        "on-tertiary-container": "#FFFFFF",
        "on-tertiary-fixed": "#000000",
        "on-tertiary-fixed-variant": "#282828",

        "inverse-surface": "#FFFFFF",
        "inverse-on-surface": "#121212",

        // Status
        "error": "#F15E6C",
        "error-container": "#2A1214",
        "on-error": "#000000",
        "on-error-container": "#F7A6AE",

        "brand-dark": "#000000",
        "brand-card": "#181818",
      },

      borderRadius: {
        // Monotonic on purpose. The previous scale overrode lg/xl/2xl but left
        // 3xl at its default, which made `rounded-3xl` (1.5rem) SMALLER than
        // `rounded-2xl` (2rem) — so large containers ended up less rounded than
        // the cards sitting inside them.
        "none": "0",
        "sm": "0.125rem",   //  2px
        "DEFAULT": "0.25rem", //  4px  - album art in list rows
        "md": "0.375rem",   //  6px
        "lg": "0.5rem",     //  8px  - cards and panels (Spotify's default)
        "xl": "0.75rem",    // 12px
        "2xl": "1rem",      // 16px
        "3xl": "1.5rem",    // 24px
        "full": "9999px"    //       - pills, buttons, avatars
      },

      spacing: {
        // Values the components already reference. Without these the classes
        // compile to nothing, which is why the player bar had no height and the
        // collapsed sidebar had no width.
        "13": "3.25rem",  // 52px - navigation row pitch in the comp
        "18": "4.5rem",   // 72px
        "22": "5.5rem",   // 88px
        "84": "21rem",    // 336px
        "88": "22rem",

        // ------------------------------------------------------------------
        // Shell measurements taken from the desktop comp (1728px frame).
        // Named rather than numeric so the intent survives a re-measure.
        // ------------------------------------------------------------------
        "nav": "310px",      // left navigation column
        "nav-sm": "72px",    // ...collapsed
        "rail": "346px",     // right panel
        "player": "112px",   // bottom player bar
        "header": "80px",    // in-column top bar
        "card": "224px",     // content tile
        "art": "182px",      // artwork inside a tile
        "tile": "82px",      // shortcut tile height (and its square artwork)

        // Mobile comp (428pt frame).
        "tabbar": "78px",    // bottom tab bar
        "dock": "59px",      // mini player card above it
      },

      letterSpacing: {
        // The comp tracks display type tighter and label type looser; without
        // these the headings read noticeably wider than the design.
        "display": "-0.9px",  // 30px section headings
        "title": "0.6px",     // 20px tile titles
        "label": "1.28px",    // uppercase "SEE ALL" style labels
      },

      scale: {
        "102": "1.02",
      },

      fontFamily: {
        headline: ["Figtree", "Inter", "system-ui", "sans-serif"],
        display: ["Figtree", "Inter", "system-ui", "sans-serif"],
        body: ["Figtree", "Inter", "system-ui", "sans-serif"],
        label: ["Figtree", "Inter", "system-ui", "sans-serif"]
      },

      fontSize: {
        // A real scale, so components stop reaching for arbitrary bracket
        // values like text-[9px] that fall below a readable floor.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],      // 11px
        "xs": ["0.75rem", { lineHeight: "1rem" }],         // 12px
        "sm": ["0.875rem", { lineHeight: "1.25rem" }],     // 14px
        "base": ["1rem", { lineHeight: "1.5rem" }],        // 16px
      },

      boxShadow: {
        // Spotify uses shadow sparingly, mostly to lift the play button.
        "card": "0 8px 24px rgba(0,0,0,.5)",
        "play": "0 8px 16px rgba(0,0,0,.4)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "slide-left": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        },
        "zoom-in": {
          from: { opacity: "0", transform: "scale(.97)" },
          to: { opacity: "1", transform: "scale(1)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        }
      },

      animation: {
        "fade-in": "fade-in .2s ease-out both",
        "slide-up": "slide-up .25s cubic-bezier(.3,0,.4,1) both",
        "slide-down": "slide-down .18s cubic-bezier(.3,0,.4,1) both",
        "slide-left": "slide-left .25s cubic-bezier(.3,0,.4,1) both",
        "zoom-in": "zoom-in .2s cubic-bezier(.3,0,.4,1) both",
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite"
      }
    },
  },
  plugins: [],
}
