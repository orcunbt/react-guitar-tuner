// Footer.js

export default function Footer() {
  return (
    <footer
      className="py-8 bg-gray-100 dark:bg-gray-800 text-center mt-auto"
      style={{ fontFamily: "'Press Start 2P', cursive" }}
    >
      <p className="text-sm">
        &copy; {new Date().getFullYear()} Frankenbox.
      </p>
      <p className="text-xs mt-2">
        Hosted on frankenbox.dev. All rights reserved.
      </p>
    </footer>
  );
}
