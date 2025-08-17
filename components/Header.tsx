"use server";
export default async function Header() {
  return (
    <div className="w-full items-center justify-center border mb-4 flex flex-col p-2">
      <div className="flex items-center justify-center     ">
        <svg className="w-8 h-8 mr-2" viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#002395" />
          <rect width="1" height="2" x="1" fill="#FFFFFF" />
          <rect width="1" height="2" x="2" fill="#ED2939" />
        </svg>
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 text-center flex items-center justify-center">
          Filigraneur.fr
        </h1>
      </div>
      <h2 className="text-lg sm:text-lg  text-gray-600 text-center items-center justify-center gap-[5px]  leading-tight">
        <span className="block sm:inline">
          Outil{" "}
          <a
            href="https://github.com/cyberclarence/filigraneur"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline underline"
          >
            open source
          </a>{" "}
          et <span className="text-green-600">gratuit</span>{" "}
        </span>
        <span className="block sm:inline">pour ajouter des filigranes</span>
      </h2>
    </div>
  );
}
