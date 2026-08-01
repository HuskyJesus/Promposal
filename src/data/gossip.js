/**
 * Optional conversations. None of these are required to finish the story —
 * they exist because the kingdom is very small and everyone in it talks.
 *
 * A few of them quietly contain the answers to the Storykeeper's Trial.
 */

export const GOSSIP = {
  frog: {
    id: 'frog',
    name: 'Bartholomew',
    lines: [
      { who: 'frog', text: 'You did not hear this from me. I want that established before I say anything else.' },
      { who: 'frog', text: 'The prince’s horse is wearing false horseshoes. Painted. I have seen them from underneath, which is where I do most of my best work.' },
      { who: 'theo', mood: 'sly', text: 'Bartholomew has never once been right about anything, and has never once let that slow him down.' },
      { who: 'frog', text: 'I heard that. I am ignoring it, because I am a professional.' }
    ],
    repeat: [
      { who: 'frog', text: 'Still painted. Still fake. I will be here when the kingdom is ready to admit it.' }
    ]
  },

  flowers: {
    id: 'flowers',
    name: 'Two arguing blossoms',
    lines: [
      { who: 'flowers', text: '— all I am saying is that they are never in the sky at the same time, and that means something.' },
      { who: 'flowers', text: '— it means nothing! They work different shifts! Not everything is romantic!' },
      { who: 'flowers', text: '— she waits for him at dusk. Every single evening. Explain that.' },
      { who: 'theo', mood: 'happy', text: 'They have been having this argument since before the castle was built. Neither of them is going to win. Both of them are enjoying it enormously.' }
    ],
    repeat: [
      { who: 'flowers', text: '— dusk! Every evening! I rest my case!' },
      { who: 'flowers', text: '— you have never once rested your case.' }
    ]
  },

  bird: {
    id: 'bird',
    name: 'A breathless sparrow',
    lines: [
      { who: 'bird', text: 'Pastries! Six of them! Gone from the cottage windowsill, and I know exactly who took them.' },
      { who: 'bird', text: 'A small blue individual. Silver stars. Paper crown. Blamed a passing dragon.' },
      { who: 'theo', mood: 'worried', text: 'There WAS a dragon. It was a very convincing dragon. This is defamation and I am not standing for it.' },
      { who: 'bird', text: 'There were crumbs on the crown, {guide}.' },
      { who: 'theo', mood: 'worried', text: '…The dragon put them there.' }
    ],
    repeat: [
      { who: 'bird', text: 'Crumbs. On. The. Crown.' }
    ]
  },

  hallPortraitLeft: {
    id: 'hallPortraitLeft',
    name: 'A painted lady',
    lines: [
      { who: 'portrait', mood: 'dark', text: 'Two hundred years I have hung on this wall with a scalloped gold frame, and then SHE arrives with — well. Look at it.' },
      { who: 'portrait', mood: 'dark', text: 'I am not saying she copied me. I am simply laying out the timeline and letting you draw your own conclusion.' },
      { who: 'theo', mood: 'sly', text: 'This has been going on for eleven decades. I bring snacks.' }
    ],
    repeat: [
      { who: 'portrait', mood: 'dark', text: 'Scalloped. Gold. The timeline speaks for itself.' }
    ]
  },

  hallPortraitRight: {
    id: 'hallPortraitRight',
    name: 'The other painted lady',
    lines: [
      { who: 'portrait', mood: 'light', text: 'Let me guess. She told you about the frames.' },
      { who: 'portrait', mood: 'light', text: 'Mine was scalloped first. The chandelier will confirm it, when the chandelier is speaking to me again.' },
      { who: 'theo', text: 'The chandelier has not spoken to anyone since the incident with the tax collector.' }
    ],
    repeat: [
      { who: 'portrait', mood: 'light', text: 'Scalloped. First. I will not be taking questions.' }
    ]
  }
};
