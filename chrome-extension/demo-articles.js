// Original, concise practice adaptations of the two requested articles.
// Only an explicit selection is sent to Gemini; source pages are not loaded.
const prose = (text) => text.replace(/\s+/g, ' ').trim();
export const DEMO_ARTICLES = Object.freeze({
  hash: {
    title: 'Hash Table',
    site: 'GeeksforGeeks',
    url: 'https://www.geeksforgeeks.org/dsa/hash-table-data-structure/',
    text: prose(`
      A hash table stores information as pairs of keys and values. A hash function
      turns each key into an index, allowing the table to locate its value without
      searching every entry. With a suitable hash function and enough space,
      insertion, lookup, and deletion usually take constant time on average.
      Different keys can produce the same index, creating a collision. Separate
      chaining handles this by keeping multiple entries in a bucket, while open
      addressing searches for another available position in the table itself.
      The load factor compares the number of stored entries with the table's
      capacity. As the table fills, collisions become more common, so many
      implementations grow the table and redistribute its entries. Although
      average operations are fast, a poor distribution of keys can make the worst
      case linear in the number of entries. Hash tables are useful for dictionaries,
      caches, and checking whether an item has already been seen.
    `)
  },
  toronto: {
    title: 'Toronto',
    site: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Toronto',
    text: prose(`
      Toronto is the capital of Ontario and Canada's largest city. It stands on
      the northwestern shore of Lake Ontario and forms the centre of the Greater
      Toronto Area. Indigenous peoples lived in the region long before European
      settlement. The settlement called York was established in 1793, and it became
      the city of Toronto in 1834. In 1998, six municipalities joined to form the
      present city. Toronto developed into a major centre for finance, business,
      education, and culture. Its economy includes financial services, technology,
      film production, and other industries. Immigration has helped shape a city
      with many languages, cultural traditions, and distinct neighbourhoods. The
      downtown contains major offices and cultural institutions, while residential
      areas extend across a much wider urban region. Parks, ravines, and waterfront
      spaces connect parts of the city to its natural landscape. Toronto's role in
      the wider region is reflected in its transport connections and institutions.
    `)
  }
});
