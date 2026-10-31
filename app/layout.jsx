import "./globals.css";

export const metadata = {
  title: "Just This Tab",
  description: "Clear cache for this tab's origin.",
};

export const viewport = {
  width: 380,
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="extension-popup">
      <body>{children}</body>
    </html>
  );
}
