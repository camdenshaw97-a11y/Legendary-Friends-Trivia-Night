/*
 * General knowledge. See questions.js for the format. In a multiple-choice question the first
 * answer is the right one (the game shuffles them); in a double-answer question the first two are.
 */
module.exports = [
  // ---- multiple choice
  { t: 'mc', q: 'Which planet has the most moons as of 2025?', a: ['Saturn', 'Jupiter', 'Uranus', 'Neptune'], h: 'It also has the rings.' },
  { t: 'mc', q: 'What is the only letter that does not appear in any U.S. state name?', a: ['Q', 'Z', 'X', 'J'], h: 'Arizona and Texas rule out two of them.' },
  { t: 'mc', q: 'How many time zones does Russia span?', a: ['11', '7', '9', '13'], h: 'More than ten.' },
  { t: 'mc', q: 'What is the strongest muscle in the human body by force exerted?', a: ['The masseter (jaw)', 'The tongue', 'The gluteus maximus', 'The heart'], h: 'You use it to chew.' },
  { t: 'mc', q: 'Which country has the most pyramids?', a: ['Sudan', 'Egypt', 'Mexico', 'Peru'], h: 'Egypt’s southern neighbor.' },
  { t: 'mc', q: 'What does the “D” in D-Day stand for?', a: ['Day', 'Deliverance', 'Decision', 'Doom'], h: 'It’s just a placeholder.' },
  { t: 'mc', q: 'How many squares are on a standard chessboard, counting squares of every size?', a: ['204', '64', '128', '256'], h: 'Count the 2×2s, 3×3s and so on, too.' },
  { t: 'mc', q: 'Which is the only U.S. state capital whose name shares no letters with its state’s name?', a: ['Pierre, South Dakota', 'Boise, Idaho', 'Austin, Texas', 'Salem, Oregon'], h: 'The Dakotas.' },
  { t: 'mc', q: 'What is the collective noun for a group of crows?', a: ['A murder', 'A parliament', 'A conspiracy', 'An unkindness'], h: 'Grim.' },
  { t: 'mc', q: 'Which blood type is the universal donor for red blood cells?', a: ['O negative', 'O positive', 'AB negative', 'AB positive'], h: 'No antigens at all.' },
  { t: 'mc', q: 'What is the national animal of Scotland?', a: ['The unicorn', 'The red deer', 'The golden eagle', 'The Highland cow'], h: 'It isn’t real.' },
  { t: 'mc', q: 'How many bones does an adult human have?', a: ['206', '186', '226', '256'], h: 'A little over two hundred.' },
  { t: 'mc', q: 'Which country gifted the Statue of Liberty to the United States?', a: ['France', 'Spain', 'The United Kingdom', 'Italy'], h: 'Think Bastille Day.' },
  { t: 'mc', q: 'What is the tallest breed of dog?', a: ['Irish wolfhound', 'Great Dane', 'Saint Bernard', 'English mastiff'], h: 'Not the one everyone guesses.' },
  { t: 'mc', q: 'Which of these is the largest desert on Earth?', a: ['The Antarctic', 'The Sahara', 'The Arabian', 'The Gobi'], h: 'A desert is defined by rainfall, not heat.' },
  { t: 'mc', q: 'How many hearts does an octopus have?', a: ['Three', 'One', 'Two', 'Eight'], h: 'Two pump to the gills.' },
  { t: 'mc', q: 'What is the most common surname in the world?', a: ['Wang', 'Smith', 'Garcia', 'Li'], h: 'Chinese, with over 100 million people.' },
  { t: 'mc', q: 'Which U.S. state has the most coastline?', a: ['Alaska', 'Florida', 'California', 'Hawaii'], h: 'Count the islands.' },
  { t: 'mc', q: 'In what year did the Titanic sink?', a: ['1912', '1905', '1915', '1921'], h: 'Before World War I.' },
  { t: 'mc', q: 'What is the smallest country in the world by area?', a: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'], h: 'It’s inside Rome.' },
  { t: 'mc', q: 'How many strings does a standard violin have?', a: ['Four', 'Five', 'Six', 'Three'], h: 'G, D, A and E.' },
  { t: 'mc', q: 'Which of these animals can’t jump?', a: ['Elephant', 'Hippo', 'Rhino', 'Giraffe'], h: 'The biggest.' },
  { t: 'mc', q: 'What is the only mammal that can truly fly?', a: ['The bat', 'The flying squirrel', 'The sugar glider', 'The colugo'], h: 'The others only glide.' },
  { t: 'mc', q: 'How many keys are on a standard full-size piano?', a: ['88', '76', '96', '104'], h: '52 white and 36 black.' },
  { t: 'mc', q: 'The Great Barrier Reef lies off which Australian state?', a: ['Queensland', 'New South Wales', 'Western Australia', 'Victoria'], h: 'The northeast.' },
  { t: 'mc', q: 'What is the only continent with no native species of ant?', a: ['Antarctica', 'Australia', 'Europe', 'South America'], h: 'Too cold.' },
  { t: 'mc', q: 'What does a Scoville rating measure?', a: ['The heat of a chili pepper', 'The hardness of a mineral', 'The strength of an earthquake', 'The brightness of a star'], h: 'Habaneros score high.' },
  { t: 'mc', q: 'Which ocean is the deepest?', a: ['The Pacific', 'The Atlantic', 'The Indian', 'The Southern'], h: 'The Mariana Trench is in it.' },
  { t: 'mc', q: 'What is the longest river in the United States?', a: ['The Missouri', 'The Mississippi', 'The Colorado', 'The Rio Grande'], h: 'It feeds the one everybody guesses.' },
  { t: 'mc', q: 'How many sides does a snowflake usually have?', a: ['Six', 'Eight', 'Five', 'Twelve'], h: 'Hexagonal ice.' },
  { t: 'mc', q: 'Which is the only U.S. state with a one-syllable name?', a: ['Maine', 'Ohio', 'Utah', 'Texas'], h: 'Lobsters.' },
  { t: 'mc', q: 'A baby kangaroo is called a what?', a: ['A joey', 'A pup', 'A kit', 'A calf'], h: 'Lives in a pouch.' },
  { t: 'mc', q: 'What is the hottest planet in the solar system?', a: ['Venus', 'Mercury', 'Mars', 'Jupiter'], h: 'Not the closest to the sun; it has a thick atmosphere.' },
  { t: 'mc', q: 'How many players are on the field for one team in a standard rugby union match?', a: ['15', '13', '11', '17'], h: 'More than a soccer side.' },
  { t: 'mc', q: 'Which city is the capital of Australia?', a: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'], h: 'Built to be the capital, not Sydney.' },
  { t: 'mc', q: 'What is the rarest blood type?', a: ['AB negative', 'O negative', 'B negative', 'A negative'], h: 'Under one percent of people.' },
  { t: 'mc', q: 'How long is a marathon, in miles?', a: ['26.2', '24.6', '25.8', '27.1'], h: 'Twenty-six and a bit.' },
  { t: 'mc', q: 'What is the currency of Switzerland?', a: ['The Swiss franc', 'The euro', 'The Swiss mark', 'The krone'], h: 'Not the euro.' },

  // ---- two right answers
  { t: 'double', q: 'Which two of these countries are landlocked?', a: ['Bolivia', 'Mongolia', 'Vietnam', 'Portugal'], h: 'One in South America, one in Asia.' },
  { t: 'double', q: 'Which two of these are prime numbers?', a: ['97', '83', '91', '87'], h: '91 is 7 × 13.' },
  { t: 'double', q: 'Which two of these animals are marsupials?', a: ['Koala', 'Tasmanian devil', 'Platypus', 'Lemur'], h: 'Pouches.' },
  { t: 'double', q: 'Which two of these U.S. states border the Pacific Ocean?', a: ['Oregon', 'Alaska', 'Nevada', 'Arizona'], h: 'One of them is way up north.' },
  { t: 'double', q: 'Which two of these words are in the NATO phonetic alphabet?', a: ['Tango', 'Whiskey', 'Dancer', 'Vodka'], h: 'One is a dance, one is a drink.' },
  { t: 'double', q: 'Which two of these are moons of Jupiter?', a: ['Europa', 'Ganymede', 'Titan', 'Triton'], h: 'Titan is Saturn’s, Triton is Neptune’s.' },
  { t: 'double', q: 'Which two of these languages are official languages of Switzerland?', a: ['Romansh', 'Italian', 'Dutch', 'Portuguese'], h: 'One of them is spoken by under 1% of the Swiss.' },

  // ---- hidden question: one phone reads it, the others each hold one of these
  { t: 'hidden', q: 'What is the capital of Canada?', a: ['Ottawa', 'Toronto', 'Montreal', 'Vancouver', 'Quebec City', 'Calgary', 'Winnipeg', 'Halifax'] },
  { t: 'hidden', q: 'Which element has the chemical symbol K?', a: ['Potassium', 'Krypton', 'Calcium', 'Carbon', 'Copper', 'Kryptonite', 'Chlorine', 'Cobalt'] },
  { t: 'hidden', q: 'What is the largest organ of the human body?', a: ['The skin', 'The liver', 'The brain', 'The lungs', 'The heart', 'The intestines', 'The stomach', 'The kidneys'] },
  { t: 'hidden', q: 'Which country has the most natural lakes?', a: ['Canada', 'Russia', 'The United States', 'Finland', 'Sweden', 'Brazil', 'China', 'Norway'] },
  { t: 'hidden', q: 'How many minutes are in a full day?', a: ['1,440', '1,240', '1,640', '2,440', '1,400', '1,540', '960', '1,800'] },
  { t: 'hidden', q: 'What is the tallest mountain in Africa?', a: ['Kilimanjaro', 'Mount Kenya', 'Mount Stanley', 'Mount Meru', 'Mount Elgon', 'Ras Dashen', 'Table Mountain', 'Mount Cameroon'] },
  { t: 'hidden', q: 'What is the name of the dog in the Peanuts comic strip?', a: ['Snoopy', 'Odie', 'Marmaduke', 'Garfield', 'Scooby', 'Pluto', 'Astro', 'Brian'] },
  { t: 'hidden', q: 'What is the most spoken language in the world by total speakers?', a: ['English', 'Mandarin Chinese', 'Spanish', 'Hindi', 'Arabic', 'French', 'Portuguese', 'Russian'] },
  { t: 'hidden', q: 'Which country is home to the most active volcanoes?', a: ['Indonesia', 'Japan', 'Iceland', 'Italy', 'The United States', 'Chile', 'The Philippines', 'Mexico'] },

  // ---- list it
  { t: 'list', q: 'Name the five Great Lakes.', a: [['Superior'], ['Michigan'], ['Huron'], ['Erie'], ['Ontario']], h: 'HOMES.' },
  { t: 'list', q: 'Name the seven continents.', a: [['Asia'], ['Africa'], ['North America'], ['South America'], ['Antarctica'], ['Europe'], ['Australia', 'Oceania']], h: 'Two are Americas.' },
  { t: 'list', q: 'Name the four states that meet at the Four Corners.', a: [['Arizona'], ['Utah'], ['Colorado'], ['New Mexico']], h: 'The Southwest.' },
  { t: 'list', q: 'Name the five boroughs of New York City.', a: [['Manhattan'], ['Brooklyn'], ['Queens'], ['The Bronx', 'Bronx'], ['Staten Island']], h: 'One is an island with a ferry.' },
  { t: 'list', q: 'Name the six colors of the classic rainbow besides indigo.', a: [['Red'], ['Orange'], ['Yellow'], ['Green'], ['Blue'], ['Violet', 'Purple']], h: 'ROY G BIV without the I.' },
  { t: 'list', q: 'Name the four suits in a standard deck of cards.', a: [['Hearts'], ['Diamonds'], ['Clubs'], ['Spades']], h: 'Two red, two black.' },
  { t: 'list', q: 'Name the five senses.', a: [['Sight', 'Vision', 'Seeing'], ['Hearing', 'Sound'], ['Smell'], ['Taste'], ['Touch']], h: 'Eyes, ears, nose…' },

  // ---- picture round: six cards, each phone gets one
  { t: 'picture', q: 'Which of these animals are mammals?', c: [['🐬', 'Dolphin', true], ['🦇', 'Bat', true], ['🐧', 'Penguin', false], ['🦈', 'Shark', false], ['🐳', 'Whale', true], ['🐊', 'Crocodile', false]] },
  { t: 'picture', q: 'Which of these fruits actually grow on trees?', c: [['🍌', 'Banana', false], ['🍎', 'Apple', true], ['🍍', 'Pineapple', false], ['🥭', 'Mango', true], ['🍓', 'Strawberry', false], ['🍒', 'Cherry', true]] },
  { t: 'picture', q: 'Which of these flags have the color red in them?', c: [['🇯🇵', 'Japan', true], ['🇺🇦', 'Ukraine', false], ['🇨🇦', 'Canada', true], ['🇸🇪', 'Sweden', false], ['🇨🇭', 'Switzerland', true], ['🇦🇷', 'Argentina', false]] },
  { t: 'picture', q: 'Which of these animals lay eggs?', c: [['🐢', 'Turtle', true], ['🦔', 'Hedgehog', false], ['🐍', 'Snake', true], ['🐨', 'Koala', false], ['🦆', 'Duck', true], ['🐇', 'Rabbit', false]] },
  { t: 'picture', q: 'Which of these instruments have strings?', c: [['🎻', 'Violin', true], ['🎺', 'Trumpet', false], ['🪕', 'Banjo', true], ['🥁', 'Drum', false], ['🎹', 'Piano', true], ['🎷', 'Saxophone', false]] },
  { t: 'picture', q: 'Which of these animals are nocturnal?', c: [['🦉', 'Owl', true], ['🦅', 'Eagle', false], ['🦇', 'Bat', true], ['🐓', 'Rooster', false], ['🦝', 'Raccoon', true], ['🦋', 'Butterfly', false]] },

  // ---- this or that: eight words, one at a time
  { t: 'tot', q: 'Country or U.S. state capital?', o: ['Country', 'State capital'], w: [['Jordan', 0], ['Jackson', 1], ['Georgia', 0], ['Pierre', 1], ['Chad', 0], ['Lincoln', 1], ['Montgomery', 1], ['Togo', 0]] },
  { t: 'tot', q: 'Is it a real bird or a made-up one?', o: ['Real bird', 'Made up'], w: [['Secretary bird', 0], ['Shoebill', 0], ['Carpenter finch', 1], ['Oilbird', 0], ['Thunder crane', 1], ['Kakapo', 0], ['Velvet gull', 1], ['Frogmouth', 0]] },
  { t: 'tot', q: 'Is this city north or south of the equator?', o: ['North', 'South'], w: [['Nairobi', 1], ['Singapore', 0], ['Lima', 1], ['Mumbai', 0], ['Jakarta', 1], ['Caracas', 0], ['Rio de Janeiro', 1], ['Manila', 0]] },
  { t: 'tot', q: 'Shakespeare play or Taylor Swift song?', o: ['Shakespeare', 'Taylor Swift'], w: [['Cymbeline', 0], ['Cardigan', 1], ['Pericles', 0], ['Willow', 1], ['Coriolanus', 0], ['Dorothea', 1], ['Timon of Athens', 0], ['Mirrorball', 1]] },
  { t: 'tot', q: 'Does this animal live in Africa or South America?', o: ['Africa', 'South America'], w: [['Capybara', 1], ['Okapi', 0], ['Tapir', 1], ['Meerkat', 0], ['Jaguar', 1], ['Aardvark', 0], ['Anaconda', 1], ['Hyena', 0]] },

  // ---- riddles
  { t: 'riddle', q: 'I have keys but open no locks. I have space but no room. You can enter but not go inside. What am I?', a: ['A keyboard', 'keyboard'], h: 'It’s under your fingers.' },
  { t: 'riddle', q: 'What has to be broken before you can use it?', a: ['An egg', 'egg', 'eggs'], h: 'Breakfast.' },
  { t: 'riddle', q: 'The more you take, the more you leave behind. What are they?', a: ['Footsteps', 'footprints', 'steps'], h: 'Look down.' },
  { t: 'riddle', q: 'What can travel around the world while staying in a corner?', a: ['A stamp', 'stamp', 'postage stamp'], h: 'On an envelope.' },
  { t: 'riddle', q: 'What gets wetter the more it dries?', a: ['A towel', 'towel'], h: 'After a shower.' },
  { t: 'riddle', q: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', a: ['An echo', 'echo'], h: 'Hello… hello… hello…' },
  { t: 'riddle', q: 'What has cities but no houses, forests but no trees, and water but no fish?', a: ['A map', 'map'], h: 'Fold it up.' },
  { t: 'riddle', q: 'What is seen in the middle of March and April that can’t be seen at the beginning or end of either month?', a: ['The letter R', 'r', 'letter r'], h: 'Spell them.' },
  { t: 'riddle', q: 'I’m tall when I’m young and short when I’m old. What am I?', a: ['A candle', 'candle'], h: 'Birthday cake.' },
  { t: 'riddle', q: 'What building has the most stories?', a: ['A library', 'library'], h: 'Books.' },
  { t: 'riddle', q: 'What runs but never walks, has a mouth but never talks, has a bed but never sleeps?', a: ['A river', 'river'], h: 'Follow it to the sea.' },
  { t: 'riddle', q: 'What can fill a room but takes up no space?', a: ['Light', 'light'], h: 'Flip the switch.' }
];
