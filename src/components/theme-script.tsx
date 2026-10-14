// Pasang kelas tema sebelum panel tampil agar tidak ada kilatan putih saat memuat ulang.
const code = `try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`;
export function ThemeScript() { return <script dangerouslySetInnerHTML={{ __html: code }} />; }
