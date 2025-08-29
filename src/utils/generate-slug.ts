export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // replace whitespace with hyphens
    .replace(/-+/g, "-"); // collapse multiple hyphens
}