/** Split text into ~`target`-char chunks on sentence/paragraph boundaries. */
export function chunkText(input: string, target = 1200): string[] {
  const clean = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const units = clean.split(/(?<=[.!?।\n])/);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current.length + unit.length > target && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += unit;
    // Safety: hard-split runaway units.
    while (current.length > target * 1.5) {
      chunks.push(current.slice(0, target).trim());
      current = current.slice(target);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}
