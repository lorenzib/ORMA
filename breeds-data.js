/**
 * breeds-data.js — ORMA breed catalogue + physical trait sets.
 *
 * The breed list mirrors the FCI Breeds Nomenclature (fci.be/en/nomenclature),
 * groups 1–10, including breeds recognised on a provisional basis, checked
 * against fci.be in July 2026. English names are used (the FCI publishes
 * original-language names first; we use their English equivalents), with the
 * original name in parentheses where it is better known.
 *
 * On top of the FCI list we add a short "not in the FCI list" section for
 * common breeds/types the FCI doesn't register (e.g. Podenco Andaluz — an
 * RSCE-recognised Spanish breed) and mixed/rescue options, because real dogs
 * on real trails are not all pedigree dogs.
 *
 * The trait sets at the bottom drive the personal safety scoring
 * (see SCORING.md): they never change a trail's objective rating, only how
 * a trail is matched to THIS dog.
 */

const FCI_BREED_GROUPS = [
  {
    id: 'g1',
    label: 'FCI Group 1 — Sheepdogs & Cattledogs',
    breeds: [
      'Australian Cattle Dog', 'Australian Kelpie', 'Australian Shepherd',
      'Australian Stumpy Tail Cattle Dog', 'Bearded Collie',
      'Beauce Sheepdog (Beauceron)', 'Belgian Shepherd Dog (Malinois, Tervueren, Groenendael, Laekenois)',
      'Bergamasco Shepherd Dog', 'Bohemian Shepherd Dog', 'Border Collie',
      'Bouvier des Ardennes', 'Bouvier des Flandres', 'Briard',
      'Catalan Sheepdog', 'Croatian Shepherd Dog', 'Czechoslovakian Wolfdog',
      'Dutch Schapendoes', 'Dutch Shepherd Dog', 'German Shepherd Dog',
      'Komondor', 'Kuvasz', 'Lancashire Heeler',
      'Long-haired Pyrenean Sheepdog', 'Majorca Shepherd Dog (Ca de Bestiar)',
      'Maremma and Abruzzes Sheepdog', 'Miniature American Shepherd', 'Mudi',
      'Old English Sheepdog (Bobtail)', 'Picardy Sheepdog',
      'Polish Lowland Sheepdog', 'Portuguese Sheepdog', 'Puli', 'Pumi',
      'Pyrenean Sheepdog (smooth-faced)', 'Romanian Carpathian Shepherd Dog',
      'Romanian Mioritic Shepherd Dog', 'Rough Collie', 'Saarloos Wolfdog',
      'Schipperke', 'Shetland Sheepdog', 'Slovakian Chuvach', 'Smooth Collie',
      'South Russian Shepherd Dog', 'Tatra Shepherd Dog (Polski Owczarek Podhalański)',
      'Welsh Corgi (Cardigan)', 'Welsh Corgi (Pembroke)', 'White Swiss Shepherd Dog',
    ],
  },
  {
    id: 'g2',
    label: 'FCI Group 2 — Pinscher, Schnauzer, Molossoid & Swiss Mountain Dogs',
    breeds: [
      'Affenpinscher', 'Aidi (Atlas Mountain Dog)', 'Appenzell Cattle Dog',
      'Austrian Pinscher', 'Bernese Mountain Dog', 'Boxer',
      'Brazilian Campeiro Bulldog', 'Broholmer', 'Bulldog (English Bulldog)',
      'Bullmastiff', 'Cane Corso (Italian Cane Corso)', 'Castro Laboreiro Dog',
      'Caucasian Shepherd Dog', 'Central Asia Shepherd Dog', 'Cimarrón Uruguayo',
      'Continental Bulldog', 'Danish-Swedish Farmdog', 'Dobermann',
      'Dogo Argentino', 'Dogo Canario', 'Dogue de Bordeaux',
      'Dutch Smoushond', 'Entlebuch Cattle Dog', 'Estrela Mountain Dog',
      'Fila Brasileiro', 'German Pinscher', 'Giant Schnauzer', 'Great Dane',
      'Great Swiss Mountain Dog', 'Hovawart', 'Kangal Shepherd Dog',
      'Karst Shepherd Dog', 'Landseer', 'Leonberger',
      'Macedonian Shepherd Dog Karaman', 'Majorca Mastiff (Ca de Bou)',
      'Mastiff (English Mastiff)', 'Miniature Pinscher', 'Miniature Schnauzer',
      'Neapolitan Mastiff', 'Newfoundland', 'Pyrenean Mastiff',
      'Pyrenean Mountain Dog (Great Pyrenees)', 'Rafeiro of Alentejo',
      'Romanian Bucovina Shepherd', 'Romanian Raven Shepherd Dog', 'Rottweiler',
      'Russian Black Terrier', 'Saint Bernard', 'Saint Miguel Cattle Dog',
      'Schnauzer (Standard)', 'Shar Pei', 'Spanish Mastiff', 'Tibetan Mastiff',
      'Tornjak', 'Tosa', 'Transmontano Mastiff',
      'Yugoslavian Shepherd Dog (Šarplaninac)',
    ],
  },
  {
    id: 'g3',
    label: 'FCI Group 3 — Terriers',
    breeds: [
      'Airedale Terrier', 'American Staffordshire Terrier',
      'Andalusian Terrier (Ratonero Bodeguero Andaluz)', 'Australian Silky Terrier',
      'Australian Terrier', 'Bedlington Terrier', 'Border Terrier',
      'Brazilian Terrier', 'Bull Terrier', 'Cairn Terrier', 'Czech Terrier',
      'Dandie Dinmont Terrier', 'English Toy Terrier (Black and Tan)',
      'Fox Terrier (Smooth)', 'Fox Terrier (Wire)',
      'German Hunting Terrier (Jagdterrier)', 'Glen of Imaal Terrier',
      'Irish Soft Coated Wheaten Terrier', 'Irish Terrier', 'Jack Russell Terrier',
      'Japanese Terrier', 'Kerry Blue Terrier', 'Lakeland Terrier',
      'Manchester Terrier', 'Miniature Bull Terrier', 'Norfolk Terrier',
      'Norwich Terrier', 'Parson Russell Terrier', 'Scottish Terrier',
      'Sealyham Terrier', 'Skye Terrier', 'Staffordshire Bull Terrier',
      'Valencian Terrier (Gos Rater Valencià)', 'Welsh Terrier',
      'West Highland White Terrier', 'Yorkshire Terrier',
    ],
  },
  {
    id: 'g4',
    label: 'FCI Group 4 — Dachshunds',
    breeds: [
      'Dachshund (Standard, Miniature or Rabbit)',
    ],
  },
  {
    id: 'g5',
    label: 'FCI Group 5 — Spitz & Primitive Types',
    breeds: [
      'Akita', 'Alaskan Malamute', 'American Akita', 'Basenji', 'Canaan Dog',
      'Canadian Eskimo Dog', 'Chow Chow', "Cirneco dell'Etna",
      'East Siberian Laika', 'Eurasier', 'Finnish Lapphund', 'Finnish Spitz',
      'German Spitz (incl. Pomeranian & Keeshond)', 'Greenland Dog', 'Hokkaido',
      'Ibizan Podenco (Podenco Ibicenco)', 'Iceland Sheepdog', 'Japanese Spitz',
      'Kai', 'Karelian Bear Dog', 'Kintamani-Bali Dog', 'Kishu',
      'Korea Jindo Dog', 'Lapponian Herder', 'Norrbottenspitz',
      'Norwegian Buhund', 'Norwegian Elkhound (black)', 'Norwegian Elkhound (grey)',
      'Norwegian Lundehund', 'Peruvian Hairless Dog', 'Pharaoh Hound',
      'Podenco Canario', 'Portuguese Podengo', 'Russian-European Laika',
      'Samoyed', 'Shiba', 'Shikoku', 'Siberian Husky', 'Swedish Lapphund',
      'Swedish Vallhund', 'Taiwan Dog', 'Thai Bangkaew Dog', 'Thai Ridgeback',
      'Volpino Italiano', 'West Siberian Laika', 'Xoloitzcuintle (Mexican Hairless)',
      'Yakutian Laika',
    ],
  },
  {
    id: 'g6',
    label: 'FCI Group 6 — Scent Hounds & Related Breeds',
    breeds: [
      'Alpine Dachsbracke', 'American Foxhound',
      "Appennine Hound (Segugio dell'Appennino)", 'Ariegeois', 'Artois Hound',
      'Austrian Black and Tan Hound', 'Basset Artésien Normand',
      'Basset Fauve de Bretagne', 'Basset Hound', 'Bavarian Mountain Scent Hound',
      'Beagle', 'Beagle-Harrier', 'Billy', 'Black and Tan Coonhound',
      'Bloodhound', 'Blue Gascony Basset', 'Bosnian Broken-haired Hound (Barak)',
      'Briquet Griffon Vendéen', 'Colombian Fino Hound', 'Dalmatian', 'Drever',
      'English Foxhound', 'Estonian Hound', 'Finnish Hound',
      'French Tricolour Hound', 'French White and Black Hound',
      'French White and Orange Hound', 'Gascon Saintongeois',
      'German Hound (Deutsche Bracke)', 'Grand Anglo-Français Blanc et Noir',
      'Grand Anglo-Français Blanc et Orange', 'Grand Anglo-Français Tricolore',
      'Grand Basset Griffon Vendéen', 'Grand Bleu de Gascogne',
      'Grand Griffon Vendéen', 'Greek Harehound', 'Griffon Bleu de Gascogne',
      'Griffon Fauve de Bretagne', 'Griffon Nivernais', 'Halden Hound',
      'Hamiltonstövare', 'Hanoverian Scent Hound', 'Harrier', 'Hygen Hound',
      'Istrian Coarse-haired Hound', 'Istrian Short-haired Hound',
      'Italian Hound (coarse-haired)', 'Italian Hound (short-haired)',
      'Medium-sized Anglo-French Hound', 'Montenegrin Mountain Hound',
      'Norwegian Hound (Dunker)', 'Otterhound', 'Petit Basset Griffon Vendéen',
      'Petit Bleu de Gascogne', 'Poitevin', 'Polish Hound (Ogar Polski)',
      'Polish Hunting Dog (Gończy Polski)', 'Porcelaine', 'Posavatz Hound',
      'Rhodesian Ridgeback', 'Schillerstövare', 'Segugio Maremmano',
      'Serbian Hound', 'Serbian Tricolour Hound', 'Slovakian Hound',
      'Småland Hound (Smålandsstövare)', 'Small Swiss Hound',
      'Spanish Hound (Sabueso Español)', 'Styrian Coarse-haired Hound',
      'Swiss Hound', 'Tatra Hound (Tatranský Durič)', 'Transylvanian Hound',
      'Tyrolean Hound', 'Westphalian Dachsbracke',
    ],
  },
  {
    id: 'g7',
    label: 'FCI Group 7 — Pointing Dogs',
    breeds: [
      'Ariege Pointing Dog', 'Auvergne Pointer', 'Blue Picardy Spaniel',
      'Bohemian Wire-haired Pointing Griffon (Český Fousek)',
      'Bourbonnais Pointing Dog', 'Brittany Spaniel (Epagneul Breton)',
      'Burgos Pointing Dog', 'Drentsche Partridge Dog', 'English Pointer',
      'English Setter', 'French Pointing Dog (Gascogne type)',
      'French Pointing Dog (Pyrenean type)', 'French Spaniel',
      'German Long-haired Pointing Dog', 'German Rough-haired Pointing Dog',
      'German Short-haired Pointing Dog', 'German Wire-haired Pointing Dog',
      'Gordon Setter', 'Hungarian Short-haired Pointer (Vizsla)',
      'Hungarian Wire-haired Pointer', 'Irish Red and White Setter',
      'Irish Red Setter', 'Italian Pointing Dog (Bracco Italiano)',
      'Italian Spinone', 'Large Munsterlander', 'Old Danish Pointing Dog',
      'Picardy Spaniel', 'Pont-Audemer Spaniel', 'Portuguese Pointing Dog',
      'Pudelpointer', 'Saint-Germain Pointer', 'Slovakian Wire-haired Pointing Dog',
      'Small Munsterlander', 'Stabijhoun (Frisian Pointing Dog)', 'Weimaraner',
      'Wire-haired Pointing Griffon Korthals',
    ],
  },
  {
    id: 'g8',
    label: 'FCI Group 8 — Retrievers, Flushing Dogs & Water Dogs',
    breeds: [
      'American Cocker Spaniel', 'American Water Spaniel',
      'Barbet (French Water Dog)', 'Chesapeake Bay Retriever', 'Clumber Spaniel',
      'Curly Coated Retriever', 'English Cocker Spaniel',
      'English Springer Spaniel', 'Field Spaniel', 'Flat Coated Retriever',
      'German Spaniel (Deutscher Wachtelhund)', 'Golden Retriever',
      'Irish Water Spaniel', 'Kooikerhondje', 'Labrador Retriever',
      'Lagotto Romagnolo', 'Nova Scotia Duck Tolling Retriever',
      'Portuguese Water Dog', 'Spanish Water Dog', 'Sussex Spaniel',
      'Welsh Springer Spaniel', 'Wetterhoun (Frisian Water Dog)',
    ],
  },
  {
    id: 'g9',
    label: 'FCI Group 9 — Companion & Toy Dogs',
    breeds: [
      'Bichon Frise', 'Bolognese', 'Boston Terrier',
      'Cavalier King Charles Spaniel', 'Chihuahua', 'Chinese Crested Dog',
      'Continental Toy Spaniel (Papillon / Phalène)', 'Coton de Tulear',
      'French Bulldog', 'Griffon Belge', 'Griffon Bruxellois', 'Havanese',
      'Japanese Chin', 'King Charles Spaniel', 'Kromfohrländer', 'Lhasa Apso',
      'Little Lion Dog (Löwchen)', 'Maltese', 'Pekingese', 'Petit Brabançon',
      'Poodle (Toy, Miniature, Medium or Standard)', 'Prague Ratter', 'Pug',
      'Russian Toy', 'Shih Tzu', 'Tibetan Spaniel', 'Tibetan Terrier',
    ],
  },
  {
    id: 'g10',
    label: 'FCI Group 10 — Sighthounds',
    breeds: [
      'Afghan Hound', 'Azawakh', 'Borzoi', 'Deerhound', 'Greyhound',
      'Hungarian Greyhound (Magyar Agár)', 'Irish Wolfhound',
      'Italian Sighthound', 'Kazakh Tazy', 'Polish Greyhound (Chart Polski)',
      'Saluki', 'Sloughi', 'Spanish Greyhound (Galgo Español)', 'Whippet',
    ],
  },
  {
    id: 'other',
    label: 'Not in the FCI list',
    breeds: [
      'Podenco Andaluz', 'American Pit Bull Terrier', 'American Bully',
      'Alaskan Husky', 'Working Kelpie', 'Lurcher', 'Patterdale Terrier',
      'Labradoodle', 'Goldendoodle', 'Cockapoo', 'Maltipoo',
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed & rescue',
    breeds: [
      'Mixed breed — small (under 10 kg)', 'Mixed breed — medium (10–25 kg)',
      'Mixed breed — large (over 25 kg)', 'Rescue / unknown mix',
    ],
  },
];

// Flat list — kept for backwards compatibility with older scripts.
// One flat, ALPHABETICAL list for every breed picker. The FCI groups above
// stay in registry order for maintenance against fci.be; pickers must not
// expose that grouping, which reads as random once concatenated.
const DOG_BREEDS = FCI_BREED_GROUPS.reduce((acc, g) => acc.concat(g.breeds), [])
  .sort((a, b) => a.localeCompare(b, 'en'));

// ============================================================
// TRAIT SETS — physical characteristics with a real, documented
// effect on mountain-trail safety. Names must match the list above.
// See SCORING.md for exactly how each trait changes the match score.
// ============================================================

// Brachycephalic (flat-nosed) or otherwise breathing-compromised breeds:
// strongly reduced heat tolerance and stamina at altitude.
const BRACHY_BREEDS = [
  'French Bulldog', 'Bulldog (English Bulldog)', 'Continental Bulldog',
  'Brazilian Campeiro Bulldog', 'Pug', 'Boston Terrier', 'Boxer', 'Bullmastiff',
  'Dogue de Bordeaux', 'Mastiff (English Mastiff)', 'Neapolitan Mastiff',
  'Majorca Mastiff (Ca de Bou)', 'Shar Pei', 'Chow Chow', 'Shih Tzu',
  'Pekingese', 'Japanese Chin', 'King Charles Spaniel',
  'Cavalier King Charles Spaniel', 'Griffon Belge', 'Griffon Bruxellois',
  'Petit Brabançon', 'Affenpinscher', 'Lhasa Apso', 'Tibetan Spaniel',
  'American Bully',
];

// Heavy double coats bred for cold: overheat quickly on exposed,
// south-facing summer trails even when perfectly fit.
const THICK_COAT_BREEDS = [
  'Siberian Husky', 'Alaskan Malamute', 'Alaskan Husky', 'Samoyed',
  'Greenland Dog', 'Canadian Eskimo Dog', 'Yakutian Laika',
  'East Siberian Laika', 'West Siberian Laika', 'Russian-European Laika',
  'Karelian Bear Dog', 'Finnish Lapphund', 'Swedish Lapphund',
  'Lapponian Herder', 'Norwegian Elkhound (black)', 'Norwegian Elkhound (grey)',
  'Eurasier', 'Chow Chow', 'German Spitz (incl. Pomeranian & Keeshond)',
  'Newfoundland', 'Landseer', 'Saint Bernard', 'Bernese Mountain Dog',
  'Leonberger', 'Tibetan Mastiff', 'Caucasian Shepherd Dog',
  'Central Asia Shepherd Dog', 'South Russian Shepherd Dog', 'Komondor',
  'Kuvasz', 'Old English Sheepdog (Bobtail)',
  'Pyrenean Mountain Dog (Great Pyrenees)', 'Pyrenean Mastiff',
  'Estrela Mountain Dog', 'Tornjak', 'Yugoslavian Shepherd Dog (Šarplaninac)',
  'Karst Shepherd Dog', 'Tatra Shepherd Dog (Polski Owczarek Podhalański)',
  'Slovakian Chuvach', 'Romanian Mioritic Shepherd Dog',
  'Romanian Bucovina Shepherd', 'Romanian Carpathian Shepherd Dog',
  'Maremma and Abruzzes Sheepdog',
];

// Giant breeds: joint loading on long descents, and a practical limit —
// many Dolomites lifts refuse or struggle with dogs over ~40 kg.
const GIANT_BREEDS = [
  'Great Dane', 'Irish Wolfhound', 'Saint Bernard', 'Mastiff (English Mastiff)',
  'Neapolitan Mastiff', 'Spanish Mastiff', 'Pyrenean Mastiff', 'Tibetan Mastiff',
  'Transmontano Mastiff', 'Newfoundland', 'Landseer', 'Leonberger',
  'Great Swiss Mountain Dog', 'Bernese Mountain Dog', 'Caucasian Shepherd Dog',
  'Central Asia Shepherd Dog', 'Kangal Shepherd Dog', 'Tosa',
  'Dogue de Bordeaux', 'Fila Brasileiro', 'Broholmer', 'Komondor', 'Kuvasz',
  'Pyrenean Mountain Dog (Great Pyrenees)', 'Rafeiro of Alentejo', 'Deerhound',
];

// Short-legged builds: big rock steps, ladders and steep scree are a
// different (harder) trail for these dogs than for a leggy one.
const SHORT_LEGGED_BREEDS = [
  'Dachshund (Standard, Miniature or Rabbit)', 'Basset Hound',
  'Basset Artésien Normand', 'Blue Gascony Basset', 'Basset Fauve de Bretagne',
  'Petit Basset Griffon Vendéen', 'Grand Basset Griffon Vendéen',
  'Welsh Corgi (Cardigan)', 'Welsh Corgi (Pembroke)', 'Swedish Vallhund',
  'Lancashire Heeler', 'Drever', 'Westphalian Dachsbracke', 'Alpine Dachsbracke',
  'Small Swiss Hound', 'Scottish Terrier', 'Sealyham Terrier', 'Skye Terrier',
  'Dandie Dinmont Terrier', 'Glen of Imaal Terrier', 'Pekingese', 'Shih Tzu',
  'Lhasa Apso',
];

// Elevated spinal / disc (IVDD) risk: jumps down big steps and twisting
// scrambles are the specific hazard.
const BACK_RISK_BREEDS = [
  'Dachshund (Standard, Miniature or Rabbit)', 'Basset Hound', 'French Bulldog',
  'Pekingese', 'Shih Tzu', 'Welsh Corgi (Cardigan)', 'Welsh Corgi (Pembroke)',
  'Beagle', 'Drever', 'Westphalian Dachsbracke', 'Alpine Dachsbracke',
];

// Kept for backwards compatibility with older scripts that import this name.
const HEAT_SENSITIVE_BREEDS = BRACHY_BREEDS.concat(THICK_COAT_BREEDS);

/**
 * breedTraits(name) → { brachy, thickCoat, giant, shortLegged, backRisk,
 * heatSensitive } for a breed string (saved profile value). Unknown or
 * free-text breeds return all-false: the health-conditions dropdown is the
 * catch-all for dogs we can't classify by name.
 */
function breedTraits(name){
  const b = name || '';
  const brachy = BRACHY_BREEDS.includes(b);
  const thickCoat = THICK_COAT_BREEDS.includes(b);
  return {
    brachy,
    thickCoat,
    giant: GIANT_BREEDS.includes(b),
    shortLegged: SHORT_LEGGED_BREEDS.includes(b),
    backRisk: BACK_RISK_BREEDS.includes(b),
    heatSensitive: brachy || thickCoat,
  };
}

/**
 * breedInsights(name) → array of { icon, title, sub } insight lines for a
 * breed, derived ONLY from documented physical traits (and FCI Group 1 for
 * the livestock/leash line). Never temperament. Unknown or free-text breeds
 * return [] — the caller then shows the health-profile fallback instead of
 * generic filler. Keep wording in sync with the safety guide.
 */
// Working stockdogs outside the FCI list under this exact name but with the
// identical documented function as FCI Group 1 — added by name rather than
// by editing FCI_BREED_GROUPS so the breed picker's grouping is untouched.
const EXTRA_HERDING_BREEDS = ['Working Kelpie'];

function breedIsHerding(name){
  const b = name || '';
  if(EXTRA_HERDING_BREEDS.includes(b)) return true;
  const g1 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g1') : null;
  return !!(g1 && g1.breeds.includes(b));
}

// Groups below share a documented WORKING FUNCTION (the reason FCI grouped
// them together in the first place), not a personality trait — same basis
// as the herding/leash line above. Each maps to one concrete trail action.
function breedIsScentHound(name){
  const b = name || '';
  const g6 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g6') : null;
  return !!(g6 && g6.breeds.includes(b));
}
function breedIsPointingDog(name){
  const b = name || '';
  const g7 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g7') : null;
  return !!(g7 && g7.breeds.includes(b));
}
// Poodle-retriever crosses with a documented water-retrieving parent breed
// on one side (Labrador / Golden Retriever) — same instinct, added by name.
const EXTRA_RETRIEVER_WATER_BREEDS = ['Labradoodle', 'Goldendoodle'];

function breedIsRetrieverWaterDog(name){
  const b = name || '';
  if(EXTRA_RETRIEVER_WATER_BREEDS.includes(b)) return true;
  const g8 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g8') : null;
  return !!(g8 && g8.breeds.includes(b));
}

/* ---------------------------------------------------------------------
 * INSIGHT-ONLY breed lists below. These do NOT feed scoreTrail() or
 * breedTraits() — they exist purely to enrich breedInsights() text for
 * breeds outside the five scored trait categories above. Keeping them
 * separate means expanding the insight card can never silently change a
 * dog's match percentage. If a breed should also affect scoring, that is
 * a deliberate, separate change to breedTraits() + scoring.js, not this.
 * --------------------------------------------------------------------- */

// FCI Group 10 — built for speed, not endurance in the cold: minimal body
// fat, thin single coats, thin skin. Already described in the safety guide;
// surfaced here per-breed instead of only in prose.
function breedIsSighthound(name){
  const b = name || '';
  const g10 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g10') : null;
  return !!(g10 && g10.breeds.includes(b));
}

// FCI Group 3 — terriers bred to go to ground after prey. The genuine trail
// hazard is investigating marmot burrows, scree gaps and crevices, not
// temperament.
// Working terriers bred for underground fox/badger work under a name that
// sits outside the FCI Group 3 list used above, same documented function.
const EXTRA_EARTH_TERRIER_BREEDS = ['Patterdale Terrier'];

function breedIsEarthTerrier(name){
  const b = name || '';
  if(EXTRA_EARTH_TERRIER_BREEDS.includes(b)) return true;
  const g3 = (typeof FCI_BREED_GROUPS !== 'undefined')
    ? FCI_BREED_GROUPS.find(g => g.id === 'g3') : null;
  return !!(g3 && g3.breeds.includes(b));
}

// Toy-sized companion breeds (roughly under 6 kg per breed standard) that
// are NOT already covered by SHORT_LEGGED_BREEDS above. Curated by hand —
// deliberately excludes compound/ambiguous entries (e.g. breed standards
// spanning both toy and non-toy varieties) and breeds already flagged
// elsewhere (Pug and Cavalier King Charles Spaniel already surface a heat
// warning via BRACHY_BREEDS).
const TOY_BREEDS = [
  'Miniature Pinscher', 'Yorkshire Terrier', 'Volpino Italiano',
  'Bichon Frise', 'Bolognese', 'Chihuahua', 'Chinese Crested Dog',
  'Continental Toy Spaniel (Papillon / Phalène)', 'Coton de Tulear',
  'Griffon Belge', 'Griffon Bruxellois', 'Havanese', 'Japanese Chin',
  'King Charles Spaniel', 'Little Lion Dog (Löwchen)', 'Maltese',
  'Prague Ratter', 'Russian Toy',
];

// Large, heavy-boned, muscular breeds where descents load joints the same
// way they do for GIANT_BREEDS, but that fall just under the giant/45kg
// threshold used in scoring. Excludes anything already in GIANT_BREEDS.
const HEAVY_BUILD_BREEDS = [
  'Bullmastiff', 'Cane Corso (Italian Cane Corso)', 'Dobermann',
  'Dogo Argentino', 'Dogo Canario', 'Rottweiler', 'Russian Black Terrier',
  'Akita', 'American Akita', 'American Pit Bull Terrier',
];

// Lean, thin-coated primitive/hound-type breeds that share the sighthound
// physical profile (minimal body fat, thin or absent coat) but sit outside
// FCI Group 10 in this classification (mostly filed under Group 5 with the
// thick-coated Nordic spitz breeds, which are the OPPOSITE build and are
// deliberately excluded here). Hairless breeds are included — they carry
// the same cold and skin-abrasion exposure, plus sunburn risk.
const LEAN_PRIMITIVE_BREEDS = [
  'Basenji', "Cirneco dell'Etna", 'Ibizan Podenco (Podenco Ibicenco)',
  'Pharaoh Hound', 'Podenco Canario', 'Portuguese Podengo',
  'Thai Ridgeback', 'Peruvian Hairless Dog', 'Xoloitzcuintle (Mexican Hairless)',
  'Podenco Andaluz', 'Lurcher',
];

// FCI Group 2 breeds with a documented livestock- or property-guarding
// function (as opposed to the herding function of Group 1) — bred to stay
// with stock or a farm and deter strangers, not to round animals up. Same
// "read the breed's job, not its mood" basis as the herding line.
const LIVESTOCK_GUARDIAN_BREEDS = [
  'Aidi (Atlas Mountain Dog)', 'Castro Laboreiro Dog', 'Cimarrón Uruguayo',
  'Macedonian Shepherd Dog Karaman', 'Romanian Raven Shepherd Dog',
  'Saint Miguel Cattle Dog', 'Hovawart', 'Appenzell Cattle Dog',
  'Entlebuch Cattle Dog', 'Danish-Swedish Farmdog',
];

// Wire-coated ratting/all-purpose farm breeds (Pinscher-Schnauzer branch of
// Group 2) — coat catches burrs and seed heads on brushy trail sections.
// Purely a coat-texture note, not a heat or build claim.
const WIRY_COAT_BREEDS = [
  'Austrian Pinscher', 'German Pinscher', 'Giant Schnauzer',
  'Miniature Schnauzer', 'Schnauzer (Standard)', 'Dutch Smoushond',
];

// Independent hunting, alarm, or all-purpose spitz breeds (mostly Group 5)
// bred to work at a distance from their handler and think for themselves —
// documented in their breed standards as historically off-lead hunting or
// guard dogs, not companion-bred for constant check-in.
const INDEPENDENT_SPITZ_BREEDS = [
  'Canaan Dog', 'Finnish Spitz', 'Hokkaido', 'Iceland Sheepdog',
  'Japanese Spitz', 'Kai', 'Kintamani-Bali Dog', 'Kishu', 'Korea Jindo Dog',
  'Norrbottenspitz', 'Norwegian Buhund', 'Norwegian Lundehund', 'Shiba',
  'Shikoku', 'Taiwan Dog', 'Thai Bangkaew Dog',
];

// Curly or dense wavy non-shedding coats (Poodle-type) that mat and collect
// burrs on rough terrain regardless of body size — a grooming/coat-care
// note, independent of the toy/short-legged/giant scored traits above.
const CURLY_COAT_BREEDS = [
  'Poodle (Toy, Miniature, Medium or Standard)', 'Tibetan Terrier',
  'Kromfohrländer', 'Labradoodle', 'Goldendoodle', 'Cockapoo', 'Maltipoo',
];

// Sled/endurance working breeds bred for sustained pulling, under a name
// outside the recognised breed lists above (Alaskan Husky is a working
// type, not an FCI or major-registry breed).
const ENDURANCE_WORKING_BREEDS = ['Alaskan Husky'];

function breedInsights(name){
  const tr = breedTraits(name);
  const out = [];

  if(tr.brachy){
    out.push({ icon:'heat', title:'Breathing is the limit',
      sub:'A short muzzle makes panting less effective — hot, exposed climbs cost far more. Start early and favour shade.' });
  } else if(tr.thickCoat){
    out.push({ icon:'heat', title:'Heat is the real limit',
      sub:'A heavy double coat makes hot, exposed routes costly even on days you find mild. Start early.' });
  }

  if(tr.giant){
    out.push({ icon:'mountain', title:'Descents load joints',
      sub:'Weight multiplies impact downhill on hard rock — favour gradual descents and a slow pace down.' });
    out.push({ icon:'loop', title:'Lifts may have size limits',
      sub:'Some gondolas cap dog size or require a muzzle — check the specific lift before building a route around it.' });
  }

  if(tr.shortLegged){
    out.push({ icon:'paw', title:'Short legs, longer day',
      sub:'Scree and rock steps are far more effort than for a tall dog — halve your usual distance at first.' });
  }

  if(tr.backRisk){
    out.push({ icon:'shade', title:'Protect the spine',
      sub:'Repeated jumping down from rocks loads a long back — pick low-step routes and lift over big drops.' });
  }

  if(breedIsHerding(name)){
    out.push({ icon:'crowd', title:'Leash through pastures',
      sub:'Grazing livestock and guardian dogs will not tolerate being herded — keep the leash on across any alpage.' });
  }

  if(breedIsSighthound(name) || LEAN_PRIMITIVE_BREEDS.includes(name || '')){
    out.push({ icon:'cold', title:'Cold at rest',
      sub:'Minimal body fat and a thin (or absent) coat mean the summit break is a shiver session — pack a light coat for stops.' });
    out.push({ icon:'paw', title:'Thin skin tears easily',
      sub:'Sharp limestone and dense scrub can nick thin skin — check legs and flanks at breaks, not just pads.' });
  }

  if(breedIsEarthTerrier(name)){
    out.push({ icon:'paw', title:'Bred to investigate burrows',
      sub:'Marmot holes and gaps in scree are a strong pull for earth-dog breeds — keep an eye near any burrow.' });
  }

  if(TOY_BREEDS.includes(name || '') && !tr.shortLegged){
    out.push({ icon:'paw', title:'Small strides, long day',
      sub:'A 10 km route is far more steps for a toy breed — scale distance down and watch recovery closely.' });
    out.push({ icon:'cold', title:'Loses heat fast when wet',
      sub:'A small body chills quickly after rain or a stream crossing — carry a dry layer.' });
  }

  if(HEAVY_BUILD_BREEDS.includes(name || '') && !tr.giant){
    out.push({ icon:'mountain', title:'Weight adds up on descents',
      sub:'A heavy, muscular build loads joints on the way down — favour gradual descents and a slow pace.' });
  }

  if(breedIsScentHound(name)){
    out.push({ icon:'paw', title:'Nose over recall',
      sub:'Bred to follow ground scent independently at a distance — once locked onto a trail, recall can lag. Leash or long-line on exposed or unmarked ground.' });
  }

  if(breedIsPointingDog(name)){
    out.push({ icon:'paw', title:'Built to range and chase',
      sub:'Bred to quarter ground fast and point or flush game — a marmot or chamois can trigger the same drive. Leash where wildlife is active.' });
  }

  if(breedIsRetrieverWaterDog(name)){
    out.push({ icon:'water', title:'Drawn to water',
      sub:'Bred to enter water eagerly — alpine lakes run glacially cold and some restrict swimming to protect water quality. Check signage before letting your dog in.' });
  }

  if(LIVESTOCK_GUARDIAN_BREEDS.includes(name || '')){
    out.push({ icon:'crowd', title:'Bred to guard, not herd',
      sub:'Livestock and farm-guardian breeds are wired to stay close to stock and be wary of strangers passing near it — give grazing animals and their guardian dogs a wide berth.' });
  }

  if(WIRY_COAT_BREEDS.includes(name || '')){
    out.push({ icon:'paw', title:'Wiry coat catches debris',
      sub:'A dense, wire coat picks up burrs and seed heads on brushy sections — plan a coat check after any scrub or hedgerow stretch.' });
  }

  if(INDEPENDENT_SPITZ_BREEDS.includes(name || '')){
    out.push({ icon:'paw', title:'Bred to work at a distance',
      sub:'These breeds have a history as independent hunting or alarm dogs, working out of sight of their handler — recall can lag behind an obedience-bred dog off-leash near wildlife.' });
  }

  if(CURLY_COAT_BREEDS.includes(name || '')){
    out.push({ icon:'paw', title:'Curly coat mats easily',
      sub:'Non-shedding, curly or dense wavy coats trap burrs and tangle on rough trail — a comb-through (and a shorter trim in summer) saves a lot of post-hike work.' });
  }

  if(ENDURANCE_WORKING_BREEDS.includes(name || '')){
    out.push({ icon:'mountain', title:'Built to keep going',
      sub:'Bred for sustained pulling over long distances, this build tends not to self-limit — watch for fatigue signs yourself rather than trusting your dog to slow down.' });
  }

  return out;
}
