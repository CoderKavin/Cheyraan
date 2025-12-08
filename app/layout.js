import "./globals.css";

export const metadata = {
  title: "IB Economics HL Practice",
  description: "Adaptive learning platform for IB Economics HL",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
