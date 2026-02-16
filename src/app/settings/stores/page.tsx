@import "tailwindcss";

@theme {
  --color-primary: #1428A0;
  --color-primary-dark: #0f1d6b;
  --color-gold: #F5B731;
  --color-success: #43A047;
  --color-error: #E53935;
  --color-dark: #1a1a1a;
  --color-mr-gray: #4a4a4a;
  --color-light-gray: #E0E0E0;
  --color-blue: #156082;
  --color-skyBlue: #0F9ED5;
  --color-orange: #E97132;
  --color-purple: #7B1FA2;
  --color-bg: #F5F6FA;
  --font-pretendard: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

@layer base {
  body {
    font-family: var(--font-pretendard);
    background-color: var(--color-bg);
    color: var(--color-dark);
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4 {
    color: #111111;
    font-weight: 700;
  }

  p, span, td, th, label {
    color: #333333;
  }

  input, select, textarea, button {
    font-family: inherit;
    font-size: 14px;
  }

  input, select, textarea {
    color: #111111;
  }

  input::placeholder {
    color: #999999;
  }

  table th {
    font-weight: 600;
    color: #444444;
  }

  table td {
    color: #222222;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }

  ::selection {
    background-color: #1428A020;
  }
}