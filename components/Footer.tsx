"use server";
export default async function Footer() {
  return (
    <footer className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
      Fait avec ❤️ par CyberClarence |{" "}
      <a
        href="https://cybercla.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        cybercla.dev
      </a>
    </footer>
  );
}
