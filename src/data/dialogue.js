/**
 * Every spoken line in the game.
 *
 * `{name}`, `{guide}`, `{author}` and `{endearment}` are expanded from
 * src/config.js when a line is displayed, so this file never hard-codes a
 * person's name.
 *
 * Line shape: `{ who, text, mood?, choices? }`
 *   who   — 'theo' | 'hero' | 'narrator' | 'frog' | 'bird' | 'flowers' |
 *           'portrait' | 'guardian'
 *   mood  — nudges the drawn portrait ('happy', 'proud', 'worried', 'sly')
 */

export const PROLOGUE_PAGES = [
  {
    title: 'Once upon a page',
    paragraphs: [
      'Once, in a kingdom stitched together from lantern light and long grass, there was a story that everyone agreed was very nearly finished.',
      'It had a forest. It had a cottage with a crooked chimney. It had a castle whose hall had forgotten how to hold colour.',
      'It had a heroine, too, though she had not yet been told.'
    ]
  },
  {
    title: 'The missing page',
    paragraphs: [
      'What it did not have — what it had somehow lost, on a night nobody wrote down — was its final page.',
      'The last page came loose and scattered into three bright fragments, and without it the story simply stopped, holding its breath, waiting.',
      'A story cannot end itself. It has to be finished by someone who was there.'
    ]
  },
  {
    title: 'So the story sent for her',
    paragraphs: [
      'It sent a small blue guardian with silver stars in his fur, who insists he was chosen for his courage and not because he was the only one awake.',
      'And it sent, quietly, an invitation shaped like a forest path.',
      '{name}, the story is waiting.'
    ]
  }
];

export const WOODS = {
  theoIntro: [
    { who: 'theo', mood: 'proud', text: 'At last! The heroine arrives. I was beginning to think I would have to save the kingdom myself.' },
    { who: 'hero', text: '…You are a small blue bear.' },
    { who: 'theo', mood: 'proud', text: 'I am a highly respected royal guardian. There is a considerable difference, and I would like it noted down somewhere official.' },
    { who: 'theo', text: 'My name is {guide}. You may have heard of me. In some circles I am practically a prince.' },
    { who: 'theo', mood: 'worried', text: 'But listen. This story has lost its final page, and until it is found nothing here can end. Not properly. Not the way it deserves to.' },
    { who: 'theo', text: 'When the page came loose it scattered into three fragments. Three. It is always three in this kingdom — you will get used to that.' },
    {
      who: 'theo',
      text: 'Any questions before we begin? Be quick, I am extremely busy.',
      choices: [
        { id: 'who', label: 'Who sent you, exactly?' },
        { id: 'ready', label: 'Lead the way, {guide}.' }
      ]
    }
  ],
  theoWhoSent: [
    { who: 'theo', mood: 'sly', text: 'A friend. Someone who knows you rather well. That is genuinely all I am permitted to say, and I have already said more than I should.' },
    { who: 'theo', mood: 'happy', text: 'They did mention you would ask that immediately. They seemed very pleased about it.' }
  ],
  theoTutorial: [
    { who: 'theo', text: 'Walk wherever you like — the woods are yours. On a phone, hold the left side of the screen and steer with your thumb. Otherwise the arrow keys will do nicely.' },
    { who: 'theo', text: 'When a little star appears above something, press the round button — or Space — and I will explain whatever it is. Usually correctly.' },
    { who: 'theo', mood: 'proud', text: 'Three moonflowers are hidden among these trees. Find them and the first fragment will show itself. I shall supervise. Closely.' }
  ],
  moonflowers: {
    stream: [
      { who: 'narrator', text: 'A moonflower is growing at the water’s edge, pale as a held breath, opening only where the moonlight touches it.' },
      { who: 'theo', mood: 'happy', text: 'One. It hums when you lift it. Everything worth finding hums a little.' }
    ],
    stones: [
      { who: 'narrator', text: 'Between two old stones, half-hidden, a second moonflower has been quietly waiting for somebody observant.' },
      { who: 'theo', text: 'Two. You are alarmingly good at this. I had a whole speech prepared about patience.' }
    ],
    hollow: [
      { who: 'narrator', text: 'Deep in a hollow log, the third moonflower glows like a lantern that forgot it was one.' },
      { who: 'theo', mood: 'proud', text: 'Three. Three! Listen — do you hear that? The woods always chime three times when something is finished.' }
    ]
  },
  clues: {
    signpost: [
      { who: 'narrator', text: 'A leaning wooden signpost, its letters carved by someone in a hurry:' },
      { who: 'narrator', text: '“One grows where the water talks. One hides where the stones keep secrets. One sleeps inside a fallen tree.”' },
      { who: 'theo', text: 'Whoever carved that had lovely handwriting and no sense of direction. The clues are accurate, though.' }
    ],
    star: [
      { who: 'narrator', text: 'Through a gap in the branches, one star burns warmer and steadier than all the others. It does not twinkle so much as insist.' },
      { who: 'theo', mood: 'sly', text: 'Ah. That one. That star is spoken for.' },
      { who: 'hero', text: 'Spoken for?' },
      { who: 'theo', text: 'Later. It is a whole thing. There is a speech. I have been practising it in a mirror.' }
    ],
    lanterns: [
      { who: 'narrator', text: 'Three lanterns hang from a low branch. As you pass, they light one after another — never all at once, always in order.' },
      { who: 'theo', text: 'One, two, three. The old lanterns of the kingdom only ever light that way. Nobody remembers why. I have theories.' }
    ]
  },
  complete: [
    { who: 'theo', mood: 'proud', text: 'Three moonflowers, and the woods are pleased with you. Look — the light is putting itself back together.' },
    { who: 'narrator', text: 'The three blossoms rise from your hands, spin once around each other, and settle into a single page of warm parchment.' }
  ],
  fragment: {
    title: 'The First Fragment',
    paragraphs: [
      'And so the heroine walked into a wood that had been left unfinished, and the wood, recognising her, lit its lanterns one at a time.',
      'She gathered three small lights that had been waiting a very long time to be noticed.',
      'The story wrote a little of itself back down, and breathed out.'
    ]
  },
  toCottage: [
    { who: 'theo', text: 'The next fragment is at the cottage past the stones. Mind the guardians — they are dreadful gossips and they take their job extremely seriously.' },
    { who: 'theo', mood: 'sly', text: 'Also they cheat. Allegedly. I have never proved it.' }
  ],
  hintLines: [
    'One of them grows where the water talks — follow the stream to the north.',
    'One is tucked between two standing stones, on the east side of the wood.',
    'One sleeps inside the fallen log, down in the south-west corner.'
  ]
};

export const COTTAGE = {
  arrive: [
    { who: 'theo', text: 'The cottage! I love the cottage. It smells like bread and old paper and somebody who never quite finishes tidying.' },
    { who: 'theo', mood: 'worried', text: 'The second fragment is inside the lantern above the door, and the lantern will not open until the guardians are satisfied.' },
    { who: 'theo', mood: 'proud', text: 'They will test you with Stone, Scroll and Shears. It is the kingdom’s oldest and most respected method for settling anything at all.' },
    { who: 'hero', text: 'Anything at all?' },
    { who: 'theo', text: 'Supper. What to watch afterwards. Wars, occasionally. Speak to all three of them first — each one will tell you exactly what beats it, because they cannot help boasting.' }
  ],
  guardians: {
    stone: [
      { who: 'guardian', mood: 'stone', text: 'I am Stone. I have stood here through four hundred winters and one very rude storm.' },
      { who: 'guardian', mood: 'stone', text: 'Shears grow dull and blunt against me. I have never once been cut.' }
    ],
    scroll: [
      { who: 'guardian', mood: 'scroll', text: 'I am Scroll. I hold every recipe, every promise, and one letter nobody has read yet.' },
      { who: 'guardian', mood: 'scroll', text: 'I wrap myself around Stone until nobody can even remember what it looked like.' }
    ],
    shears: [
      { who: 'guardian', mood: 'shears', text: 'I am Shears. I trim the hedges, the ribbons, and any argument that goes on too long.' },
      { who: 'guardian', mood: 'shears', text: 'Scroll parts beneath me in a single stroke. Neatly, too. I am very precise.' }
    ]
  },
  needClues: [
    { who: 'theo', mood: 'worried', text: 'Speak to the three guardians first. Each of them will boast about exactly what they beat — it is their favourite subject, and frankly it does half your work for you.' }
  ],
  props: {
    kettle: [
      { who: 'narrator', text: 'A copper kettle sits on the stove, still warm, with two mismatched cups set out beside it. Neither cup matches anything else in the cottage.' },
      { who: 'theo', text: 'Two cups. Always two. Whoever lives here is either very optimistic or expecting company.' }
    ],
    shelf: [
      { who: 'narrator', text: 'A shelf of jars, each labelled in the same careful hand: BRAVERY, PATIENCE, MOSTLY PATIENCE, and one simply marked FOR HER.' },
      { who: 'theo', mood: 'sly', text: 'Do not open that last one. I have been told, in no uncertain terms, that I am not to let you open that one.' }
    ],
    journal: [
      { who: 'narrator', text: 'An open journal. The page is a list of arguments settled by Stone, Scroll and Shears — where to eat, what to watch, who was getting up to close the window.' },
      { who: 'narrator', text: 'At the bottom, underlined twice: “Best of three. Always best of three.”' },
      { who: 'theo', mood: 'happy', text: 'You two are such freaks. Affectionately, of course. I am contractually obliged to say affectionately.' }
    ],
    portraitWall: [
      { who: 'narrator', text: 'A small painting hangs by the door: a blue bear in a paper crown, standing very straight, being taken extremely seriously by absolutely nobody.' },
      { who: 'theo', mood: 'proud', text: 'That is an official royal portrait and I will not be discussing it further.' }
    ]
  },
  beforeTrial: [
    { who: 'theo', text: 'Right. Three rounds, three guardians. Answer each one with the symbol that beats theirs.' },
    { who: 'theo', mood: 'sly', text: 'And if you get stuck, ask me. I will pretend it was obvious the entire time.' }
  ],
  solved: [
    { who: 'theo', mood: 'proud', text: 'Three for three. The guardians are furious and deeply impressed, which is their favourite emotional combination.' },
    { who: 'narrator', text: 'Above the door, the lantern swings open of its own accord and lets down a slow ribbon of light.' }
  ],
  fragment: {
    title: 'The Second Fragment',
    paragraphs: [
      'At the cottage with the crooked chimney, the heroine was asked to settle a question the old way: stone, scroll and shears, best of three.',
      'She won all three, which surprised nobody who knows her.',
      'Inside the lantern was a page, and on the page was the smell of bread, and two cups set out for somebody expected.'
    ]
  },
  toHall: [
    { who: 'theo', text: 'One fragment left. It is in the castle — the old hall that lost its colour.' },
    { who: 'theo', mood: 'worried', text: 'I should warn you: the portraits in there talk. Constantly. About each other. It is the best and worst room in the kingdom.' }
  ],
  hintLines: [
    'Speak to all three guardians before you begin — each one tells you what it beats.',
    'The rule goes in a circle: Stone blunts Shears, Shears cut Scroll, Scroll covers Stone.',
    'Whatever the guardian is holding, answer with the symbol that the rules say defeats it.'
  ]
};

export const HALL = {
  arrive: [
    { who: 'narrator', text: 'The doors open onto a long hall of black and white tiles, silver frames, and light that seems to be holding itself very carefully.' },
    { who: 'theo', text: 'The Monochrome Hall. Every colour in this room walked out at once, a long time ago, and it has been sulking ever since.' },
    { who: 'theo', mood: 'proud', text: 'Well. Not every colour. I am here. I count as blue.' },
    { who: 'theo', text: 'The great mural was split down the middle. Join the halves, answer what the hall asks, and the last fragment is yours.' }
  ],
  muralIntro: [
    { who: 'narrator', text: 'The mural fills the far wall — or half of it does. The dark panels hang on one side, the light panels on the other, and none of them quite line up.' },
    { who: 'theo', text: 'Every panel on the dark side has an opposite on the light side. Not a copy — an opposite. The two together make one whole idea.' }
  ],
  muralSolved: [
    { who: 'narrator', text: 'The panels slide toward one another and lock, and for the first time in a very long while the mural shows one picture instead of two.' },
    { who: 'narrator', text: 'Colour creeps back into the hall the way warmth returns to cold hands — slowly, then all at once.' },
    { who: 'theo', mood: 'proud', text: 'Two halves. One picture. I would like it on record that I understood this immediately.' }
  ],
  triviaIntro: [
    { who: 'narrator', text: 'A silver frame at the end of the hall clears its throat, which is unusual, because it is a frame.' },
    { who: 'portrait', text: 'Three questions, traveller. The Storykeeper’s Trial. Answer them and the hall will give up what it has been keeping.' },
    { who: 'theo', mood: 'worried', text: 'I was told these questions were difficult. Evidently, they did not account for you.' }
  ],
  triviaSolved: [
    { who: 'portrait', text: 'Three from three. The hall has not been this pleased since the year the chandelier fell on the tax collector.' },
    { who: 'theo', mood: 'proud', text: 'She has always been like this. I once watched her answer a riddle before the riddle had finished being a riddle.' }
  ],
  triviaFlawless: [
    { who: 'theo', mood: 'proud', text: 'Not one wrong. Not one. I am going to be insufferable about this on your behalf.' }
  ],
  gossipPortraits: {
    left: [
      { who: 'portrait', mood: 'dark', text: 'You will notice the frame across from mine. Gold leaf. Scalloped edge. Identical to mine, which I have had for two hundred years.' },
      { who: 'portrait', mood: 'dark', text: 'I am not saying she copied me. I am saying the timing was remarkable.' }
    ],
    right: [
      { who: 'portrait', mood: 'light', text: 'Whatever she told you about the frames, it is not true and I would like that on the record.' },
      { who: 'portrait', mood: 'light', text: 'Mine has always been scalloped. Ask the chandelier. The chandelier saw everything.' }
    ]
  },
  windowStar: [
    { who: 'narrator', text: 'Through the tall window, one warm star waits above the garden wall, brighter than the hall’s careful silver.' },
    { who: 'theo', mood: 'sly', text: 'Still spoken for. Still not explaining. We are nearly at the part where I explain.' }
  ],
  complete: [
    { who: 'narrator', text: 'The restored mural glows once, and the final fragment lifts away from it like a page turning by itself.' }
  ],
  fragment: {
    title: 'The Third Fragment',
    paragraphs: [
      'In a hall that had given up on colour, the heroine put two halves of a picture back together, and the picture forgave the room instantly.',
      'She answered three questions asked by a frame, and the frame — who had been trying to be intimidating — gave up and simply admired her.',
      'And the last piece of the missing page came loose into her hands, warm as a lantern.'
    ]
  },
  toGarden: [
    { who: 'theo', mood: 'happy', text: 'That is all three. Come with me — there is a garden behind this hall, and it has been kept for exactly this evening.' },
    { who: 'theo', text: 'Do not run. Or do. I cannot really stop you. But I have arranged things, and I would like them to happen in order.' }
  ],
  hintLines: [
    'Every dark panel has an opposite on the light side — not a copy, an opposite.',
    'The three questions only ask about things you have already seen tonight.',
    'The way out is the tall doors at the far end, once the mural and the trial are done.'
  ]
};

export const GARDEN = {
  arrive: [
    { who: 'narrator', text: 'The garden lies open under a moon that has clearly been polished for the occasion.' },
    { who: 'theo', text: 'Three lanterns. Light them in order, please. Order matters here more than most places.' }
  ],
  lantern: [
    [{ who: 'theo', text: 'One.' }],
    [{ who: 'theo', text: 'Two.' }],
    [{ who: 'theo', mood: 'proud', text: 'Three. There. Now the garden knows we are serious.' }]
  ],
  beforeStar: [
    { who: 'theo', text: 'The kingdom has an old promise, {name}. Older than the castle. Older than me, and I am practically a prince.' },
    { who: 'theo', text: 'It is never spoken aloud. It is made with three small signs, in order, every time — because saying it once was never going to be enough for anyone who meant it.' },
    { who: 'theo', mood: 'proud', text: 'One for “I”. One for “love”. One for “you”.' },
    { who: 'theo', text: 'Three lanterns. Three moonflowers. Three chimes at the end of every chapter. You have been making that promise all evening without being told.' },
    { who: 'hero', text: 'Three kisses.' },
    { who: 'theo', mood: 'happy', text: 'Three kisses. Yes. I did wonder how long it would take you.' }
  ],
  starSequence: [
    { who: 'theo', text: 'Now. That star. The one that has been following us since the woods.' },
    { who: 'narrator', text: 'The warm star brightens, and a second, smaller star wakes up beside it — a neighbour, close enough to lean on.' },
    { who: 'theo', text: 'Watch. This is the part I have been practising.' }
  ],
  afterStar: [
    { who: 'theo', mood: 'happy', text: 'There and back. Twice. And it will keep going as many times as it takes — that is the arrangement, apparently. I did not write it. I merely deliver it.' },
    { who: 'theo', text: 'I have watched this whole story from the shelf, you know. I am blue, I have stars, and I have excellent hearing.' },
    { who: 'theo', mood: 'proud', text: 'I know who left the moonflowers. I know who taught the guardians to cheat. And I know who has been waiting all evening for you to reach this page.' },
    { who: 'narrator', text: 'The three fragments rise out of your hands, find one another, and settle into a single unfinished page.' },
    { who: 'theo', text: 'Go on, {name}. Read it. It was written for you.' }
  ],
  yesResponse: [
    { who: 'theo', mood: 'proud', text: 'YES. I KNEW IT. I would like everyone present to note that I never doubted her for a moment.' },
    { who: 'theo', mood: 'happy', text: 'Right — flowers, stars, the whole arrangement. I have been holding this in since the woods.' }
  ],
  talkResponse: [
    { who: 'theo', mood: 'happy', text: 'Of course. Some pages are meant to be read out loud, in person, by the person who wrote them.' },
    { who: 'theo', text: 'He will be delighted either way. He has been pacing. I have never seen anyone pace like that.' }
  ],
  hintLines: [
    'Light the three lanterns, then follow the path to the centre of the garden.',
    'The lanterns are along the hedge — walk up to each one and press to interact.',
    'Everything left in this garden happens on its own. Just keep walking toward the light.'
  ]
};

