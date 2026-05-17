export async function parseAniwatchFile(url = '/Aniwatch.txt') {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const text = await response.text();
    return parseText(text);
  } catch (error) {
    console.error('Error parsing Aniwatch file:', error);
    return [];
  }
}

export function parseText(text) {
  const lines = text.split('\n');
  const result = [];
  let currentCategory = 'Uncategorized';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      currentCategory = line.substring(1).trim();
      continue;
    }

    if (line.includes('|')) {
      const [titlePart, urlPart] = line.split('|').map(s => s.trim());
      if (urlPart) {
        // extract ID from https://myanimelist.net/anime/52991
        const match = urlPart.match(/\/anime\/(\d+)/);
        const malId = match ? match[1] : null;
        
        if (malId) {
          result.push({
            title: titlePart,
            url: urlPart,
            malId: parseInt(malId, 10),
            category: currentCategory,
          });
        }
      }
    }
  }
  return result;
}
