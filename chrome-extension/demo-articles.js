// Original, concise practice adaptations of the two requested articles.
// Only an explicit selection is sent to Gemini; source pages are not loaded.
const prose = (text) =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .join('\n\n');
export const DEMO_ARTICLES = Object.freeze({
  hash: {
    title: 'Hash Table',
    site: 'GeeksforGeeks',
    url: 'https://www.geeksforgeeks.org/dsa/hash-table-data-structure/',
    text: prose(`
      A hash table stores key–value pairs and uses a hash function to map each key
      to an array index. This makes insertion, lookup, and deletion fast on average,
      often constant time. Different keys can map to the same index, causing
      collisions.

      A useful hash function spreads keys across the available buckets rather than
      concentrating them in a few positions. For example, a name can act as a key
      for a stored record. Looking up that name computes its bucket instead of
      scanning every record from the beginning.

      Separate chaining keeps multiple entries in a bucket; open
      addressing finds another slot in the table. The load factor measures how full
      the table is.

      Resizing allocates a larger array and places existing entries into their new
      buckets. This costs extra work during the resize, but leaves more space for
      future insertions. Choosing the capacity and collision strategy is therefore
      part of balancing memory use against lookup speed.

      Growing and rehashing the table helps reduce collisions as more
      entries are added. Poorly distributed keys can still make operations take
      linear time in the worst case.
    `)
  },
  toronto: {
    title: 'Toronto',
    site: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Toronto',
    text: prose(`
      Toronto is Ontario’s capital and Canada’s largest city, located on Lake
      Ontario’s northwestern shore. It is the centre of the Greater Toronto Area
      and a major hub for finance, technology, education, and culture. Indigenous
      peoples lived in the region long before European settlement. The town of
      York was established in 1793 and became Toronto in 1834. Six municipalities
      amalgamated into today’s city in 1998.

      The city’s cultural life includes theatres, concert venues, museums and
      galleries. Performances take place in spaces ranging from neighbourhood
      stages to major downtown halls. These institutions give residents and
      visitors many ways to experience the city beyond its business districts.

      Immigration has shaped its many
      languages, cultural traditions, and neighbourhoods. Ravines, parks, and
      waterfront spaces form an important part of its landscape, while transport
      links connect the city to the wider region.

      River valleys cut through the urban landscape, creating a network of ravines
      between built-up neighbourhoods. Along the lake, waterfront spaces provide
      a different view of the city. Together, these features help explain why
      Toronto’s geography includes both dense streets and substantial green corridors.
    `)
  }
});
