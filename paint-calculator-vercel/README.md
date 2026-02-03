# Paint Calculator

A minimal, Apple-inspired web app to calculate paint requirements for rooms.

## Features

- 🏠 Add multiple rooms with dimensions
- 🚪 Configure openings (doors, windows, wardrobes)
- 🔄 Toggle between Imperial (ft) and Metric (m) units
- 🎨 Multiple paint types with different coverage rates
- 📊 Real-time calculations with detailed breakdown
- 📥 Export to CSV, JSON, or Print
- ♿ WCAG 2.1 AA accessible

## Deploy to Vercel

### Option 1: One-Click Deploy (After pushing to GitHub)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Option 2: Manual Deploy

1. **Push to GitHub:**
   ```bash
   # Initialize git repo
   git init
   git add .
   git commit -m "Initial commit"
   
   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/paint-calculator.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Click "Deploy"

### Option 3: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
paint-calculator/
├── app/
│   ├── components/
│   │   ├── PaintCalculator.js
│   │   └── PaintCalculator.module.css
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── public/
│   └── favicon.svg
├── package.json
├── next.config.js
└── README.md
```

## Calculation Formula

```
Wall Area = 2 × (Length + Width) × Height
Ceiling Area = Length × Width (optional)
Net Area = Wall Area - Subtract Areas + Add Areas + Ceiling
Paint Required = (Net Area ÷ Coverage) × Coats × (1 + Wastage%)
```

## License

MIT
