

export function getRegole(data) {
  // Elenco regole configuratore (dim, color-variant, visible, ar, ...).
  return Array.isArray(data?.regole) ? data.regole : [];
}





