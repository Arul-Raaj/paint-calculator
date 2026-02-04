import './globals.css';

export const metadata = {
  title: 'Paint Calculator | Calculate Paint Requirements',
  description: 'Calculate exactly how much paint you need for your rooms. Supports imperial and metric units, multiple coats, and various opening types.',
  keywords: 'paint calculator, wall paint, room painting, paint estimator, home improvement',
  openGraph: {
    title: 'Paint Calculator',
    description: 'Calculate exactly how much paint you need for your rooms.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#667eea" />
      </head>
      <body>{children}</body>
    </html>
  );
}
