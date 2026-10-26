'use strict';
/* Client pseudonyms: a mild adjective and an animal, "Quiet Heron". Nothing about appearance, mood, ability,
   size or age; no predators-as-insults, no vermin, nothing that could read as a comment on the person.
   120 x 120 = 14,400 combinations; a number suffix is added only if the space ever fills. */

const ADJECTIVES = [
  'Amber', 'Ashen', 'Autumn', 'Azure', 'Blue', 'Brass', 'Bright', 'Bronze', 'Calm', 'Cedar',
  'Clear', 'Cloud', 'Clover', 'Coastal', 'Copper', 'Coral', 'Cotton', 'Crimson', 'Dawn', 'Delta',
  'Dusk', 'Early', 'Ember', 'Evening', 'Fern', 'Field', 'Flint', 'Forest', 'Garden', 'Gentle',
  'Ginger', 'Glass', 'Golden', 'Granite', 'Green', 'Harbor', 'Hazel', 'Heather', 'Hidden', 'Hollow',
  'Honey', 'Indigo', 'Island', 'Ivory', 'Jade', 'Juniper', 'Lake', 'Lantern', 'Lavender', 'Lilac',
  'Linen', 'Maple', 'Marble', 'Meadow', 'Mellow', 'Misty', 'Morning', 'Moss', 'Mountain', 'Night',
  'North', 'Oak', 'Ocean', 'Olive', 'Opal', 'Orchard', 'Pale', 'Paper', 'Pebble', 'Pine',
  'Plum', 'Prairie', 'Quiet', 'Rain', 'Red', 'River', 'Rose', 'Rosy', 'Ruby', 'Rustic',
  'Saffron', 'Sage', 'Sand', 'Sapphire', 'Scarlet', 'Sea', 'Shady', 'Silver', 'Sky', 'Slate',
  'Snow', 'Soft', 'Solar', 'South', 'Spring', 'Steady', 'Stone', 'Storm', 'Summer', 'Sunny',
  'Teal', 'Thistle', 'Tidal', 'Timber', 'Topaz', 'Tulip', 'Umber', 'Valley', 'Velvet', 'Violet',
  'Walnut', 'Wandering', 'Warm', 'Western', 'Wild', 'Willow', 'Winter', 'Wren', 'Yellow', 'Zinc',
];

const ANIMALS = [
  'Albatross', 'Alpaca', 'Antelope', 'Badger', 'Beaver', 'Bison', 'Bluebird', 'Bumblebee', 'Butterfly', 'Camel',
  'Cardinal', 'Caribou', 'Chickadee', 'Chipmunk', 'Crane', 'Cricket', 'Curlew', 'Deer', 'Dolphin', 'Dove',
  'Dragonfly', 'Duck', 'Eagle', 'Egret', 'Elk', 'Falcon', 'Fawn', 'Finch', 'Firefly', 'Flamingo',
  'Fox', 'Gazelle', 'Gecko', 'Giraffe', 'Goldfinch', 'Goose', 'Grouse', 'Gull', 'Hare', 'Hawk',
  'Hedgehog', 'Heron', 'Hummingbird', 'Ibis', 'Iguana', 'Jay', 'Kestrel', 'Kingfisher', 'Kiwi', 'Koala',
  'Ladybug', 'Lark', 'Lemur', 'Linnet', 'Lion', 'Llama', 'Loon', 'Lynx', 'Macaw', 'Magpie',
  'Manatee', 'Marten', 'Meerkat', 'Moose', 'Moth', 'Narwhal', 'Newt', 'Nightingale', 'Ocelot', 'Oriole',
  'Osprey', 'Otter', 'Owl', 'Oyster', 'Panda', 'Parrot', 'Pelican', 'Penguin', 'Pheasant', 'Pigeon',
  'Plover', 'Pony', 'Puffin', 'Quail', 'Rabbit', 'Raven', 'Reindeer', 'Robin', 'Salmon', 'Sandpiper',
  'Seal', 'Sparrow', 'Squirrel', 'Starling', 'Stork', 'Swallow', 'Swan', 'Swift', 'Tanager', 'Tern',
  'Thrush', 'Tortoise', 'Toucan', 'Trout', 'Turtle', 'Vireo', 'Walrus', 'Warbler', 'Whale', 'Wombat',
  'Woodpecker', 'Wren', 'Yak', 'Zebra', 'Antler', 'Beetle', 'Cormorant', 'Dunlin', 'Gannet', 'Harrier',
];

function makeAlias(rnd = Math.random) {
  const a = ADJECTIVES[Math.floor(rnd() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(rnd() * ANIMALS.length)];
  return a === b ? makeAlias(rnd) : `${a} ${b}`;      // "Wren Wren" is the one collision in the lists
}

/* Reserve a unique alias in Firestore: aliases/{slug} -> { uid }. Returns the alias. */
async function reserveAlias(db, uid, rnd = Math.random, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const alias = i < tries - 3 ? makeAlias(rnd) : `${makeAlias(rnd)} ${Math.floor(rnd() * 900 + 100)}`;
    const ref = db.collection('aliases').doc(alias.toLowerCase().replace(/\s+/g, '-'));
    const ok = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, { uid, alias, createdAt: new Date().toISOString() });
      return true;
    });
    if (ok) return alias;
  }
  throw new Error('alias space exhausted');
}

module.exports = { ADJECTIVES, ANIMALS, makeAlias, reserveAlias };
