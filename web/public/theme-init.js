// Apply the stored or OS theme before first paint so dark mode never flashes light.
(() => {
  const t = localStorage.getItem("aidlc-theme");
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) document.documentElement.classList.add("dark");
})();
