export const ASSISTANT_SYNONYMS = {
  booking: [
    'booking',
    'bookings',
    'event',
    'events',
    'party',
    'parties',
    'project',
    'projects',
    'celebration',
    'celebrations',
    'brief',
    'setup',
  ],
  contract: [
    'contract',
    'contracts',
    'agreement',
    'agreements',
    'paperwork',
    'signature',
    'signatures',
    'signed',
    'signing',
  ],
  payment: [
    'payment',
    'payments',
    'invoice',
    'invoices',
    'due',
    'dues',
    'balance',
    'balances',
    'pending amount',
    'remaining amount',
    'remaining balance',
    'outstanding',
    'owed',
    'left to pay',
    'pay',
  ],
  chat: [
    'chat',
    'chats',
    'message',
    'messages',
    'reply',
    'replies',
    'inbox',
    'conversation',
    'conversations',
    'thread',
    'threads',
  ],
  unread: [
    'unread',
    'missed',
    'not seen',
    'not answered',
    'unanswered',
    'silent',
    'no response',
    'no replies',
  ],
  owner: [
    'who is handling',
    'who handles',
    'who owns',
    'who owns this',
    'booking owner',
    'assigned person',
    'handler',
    'responsible person',
    'coordinator',
  ],
  budgetLower: [
    'cheap',
    'cheaper',
    'lower budget',
    'reduce cost',
    'reduce the cost',
    'lower cost',
    'too expensive',
    'expensive',
    'costly',
    'affordable',
    'budget friendly',
    'budget-friendly',
    'less expensive',
    'make it cheaper',
    'trim cost',
    'cut cost',
  ],
  budgetHigher: [
    'premium',
    'more premium',
    'higher budget',
    'upscale',
    'better setup',
    'more expensive',
    'upgrade',
    'add more',
    'more service',
  ],
  privateEvent: [
    'private celebration',
    'private party',
    'private event',
    'private gathering',
    'friends party',
    'party with friends',
    'friends gathering',
    'friends get together',
    'friends celebration',
    'college friends',
    'friends meetup',
    'couples event',
    'couples celebration',
    'date night',
    'romantic dinner',
    'anniversary party',
    'anniversary celebration',
    'bachelor party',
    'bachelorette party',
    'intimate event',
    'intimate gathering',
    'private dinner',
  ],
  reminder: [
    'remind again',
    'follow up',
    'follow-up',
    'ping them',
    'resend',
    'send again',
    'remind them',
    'reminder',
  ],
  outdoor: [
    'outdoor',
    'outdoors',
    'outside venue',
    'outside',
    'open air',
    'move outdoors',
    'move outside',
    'al fresco',
  ],
  indoor: ['indoor', 'indoors', 'inside'],
  cityShift: [
    'another city',
    'different city',
    'move to',
    'switch to',
    'change to',
    'can we do this in',
  ],
  repair: [
    'no, i mean',
    'i mean',
    'not that',
    'wrong one',
    'other one',
    'same as before',
    'instead',
    'different booking',
    'different contract',
    'different payment',
    'different chat',
    'the other booking',
    'the other contract',
    'the other payment',
    'the other chat',
  ],
  frustration: [
    'not helping',
    'useless',
    'wrong again',
    'talk to human',
    'stop repeating',
    'you are not helping',
    'you are not useful',
    'this is useless',
    'this is wrong',
    'not working',
  ],
  alcohol: [
    'no alcohol',
    'without alcohol',
    'alcohol free',
    'dry event',
    'dry setup',
    'non-alcoholic',
    'non alcoholic',
    'mocktails only',
  ],
  followUp: [
    'also',
    'add',
    'instead',
    'same as before',
    'keep everything else same',
    'keep everything same',
    'keep the rest same',
    'remove that',
    'more guests',
    'less guests',
    'more people',
    'fewer people',
    'more premium',
    'cheaper',
    'premium',
    'indoor',
    'indoor setup',
    'outdoor',
    'outdoor setup',
    'another city',
    'different city',
    'same brief',
    'same setup',
    'keep it dry',
    'add snacks',
  ],
  pending: [
    'pending',
    'blocker',
    'blocked',
    'stuck',
    'waiting',
    'overdue',
    'missing',
    'unassigned',
    'what needs attention',
    'what am i missing',
    'what is overdue',
  ],
  clarification: [
    'which one',
    'which booking',
    'which contract',
    'which payment',
    'other one',
    'the other one',
    'same as before',
    'not that',
    'wrong one',
    'do you mean',
    'what do you mean',
    'latest one',
    'signed one',
    'current one',
  ],
  unsupported: [
    'sex party',
    'sexual',
    'explicit',
    'hookup',
    'threesome',
    'orgy',
    'porn',
    'nude',
    'naked',
    'escort',
    'prostitution',
    'illegal',
    'drugs',
    'weed',
    'marijuana',
    'cocaine',
    'gambling',
    'weapon',
    'violence',
    'bomb',
    'inappropriate',
    'nsfw',
    'adult content',
    'relationship advice',
    'personal task',
    'non business',
    'outside the platform',
    'outside your service',
    'not related to booking',
  ],
} as const;

const MULTILINGUAL_MARKERS = [
  'mujhe',
  'chahiye',
  'dikhao',
  'dikhado',
  'dikhaiye',
  'batao',
  'batado',
  'btao',
  'karo',
  'krdo',
  'kar do',
  'karna',
  'rakhna',
  'wala',
  'wali',
  'wale',
  'kitna',
  'kitni',
  'kitne',
  'thoda',
  'thodi',
  'thode',
  'zyaada',
  'zyada',
  'jaldi',
  'abhi',
  'nahi',
  'nahin',
  'nhi',
  'kyu',
  'kyun',
  'kaise',
  'koi',
  'bhi',
  'pending hai',
  'lag rahi',
  'lag raha',
  'lag rahe',
  'kam karo',
  'kam kar do',
  'same hi',
];

const LANGUAGE_SCRIPT_PATTERNS = [
  { label: 'Hindi', regex: /[\u0900-\u097f]/ },
  { label: 'Bengali', regex: /[\u0980-\u09ff]/ },
  { label: 'Telugu', regex: /[\u0c00-\u0c7f]/ },
  { label: 'Kannada', regex: /[\u0c80-\u0cff]/ },
  { label: 'Malayalam', regex: /[\u0d00-\u0d7f]/ },
  { label: 'Tamil', regex: /[\u0b80-\u0bff]/ },
] as const;

export function normalizeAssistantText(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function includesAnyPhrase(input: string, phrases: readonly string[]) {
  return phrases.some((phrase) => input.includes(phrase));
}

export function splitAssistantClauses(input: string) {
  const normalized = normalizeAssistantText(input);
  const clauses = normalized
    .split(
      /(?:[.!?;]+|\s+(?:and also|and then|also|plus|but|instead|rather|or)\s+|,\s*(?:and|also|plus|but|instead|rather|or)\s+)/g,
    )
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses.length ? clauses : [normalized];
}

export function detectRepairSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.repair);
}

export function detectGreetingSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(
    normalized,
  );
}

export function detectIdentityQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'who are you',
    'who is this',
    'what are you',
    'what is beer',
    'who am i talking to',
    'tell me about yourself',
  ]);
}

export function detectAssistantIdentityQuestion(input: string) {
  return detectIdentityQuestion(input);
}

export function detectCapabilityQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'what can you do',
    'what do you do',
    'what do you know',
    'how can you help',
    'how do you help',
    'what can you help with',
    'how do you work',
    'what can i ask you',
  ]);
}

export function detectUserIdentityQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'what is my name',
    "what's my name",
    'do you know my name',
    'do you remember me',
    'remember me',
    'who am i',
    'who am i talking to',
    'what do you know about me',
    'what can you tell me about me',
  ]);
}

export function detectPersonalQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'can you help me',
    'how are you',
    "how's it going",
    "what's up",
    'whats up',
    'are you there',
    'talk to me',
    'tell me something',
    'tell me a bit about yourself',
  ]);
}

export function detectCasualChatQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'how are you',
    "how's it going",
    "what's up",
    'whats up',
    'are you there',
    'talk to me',
    'tell me something',
  ]);
}

export function detectUnsupportedPersonalDataQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'my phone number',
    'my email',
    'my email address',
    'my address',
    'my birthday',
    'my dob',
    'my date of birth',
    'my password',
    'my credit card',
    'my bank account',
    'my otp',
    'my social security',
  ]);
}

export function detectOffTopicRequest(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'tell me a joke',
    'joke',
    'weather',
    'sports',
    'news',
    'movie',
    'song',
    'poem',
    'recipe',
    'translate',
    'fun fact',
    'random fact',
  ]);
}

export function detectServiceRecommendationQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'which service is best',
    'which service should i choose',
    'which service should i use',
    'which service do you recommend',
    'which service would you recommend',
    'best service',
    'best fit',
    'best option',
    'best for',
    'recommend a service',
    'suggest a service',
    'compare services',
    'compare setups',
    'service options',
    'service comparison',
  ]);
}

export function detectFrustrationSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.frustration);
}

export function detectBudgetPreference(input: string) {
  const normalized = normalizeAssistantText(input);

  if (includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.budgetLower)) {
    return 'lower' as const;
  }

  if (includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.budgetHigher)) {
    return 'premium' as const;
  }

  return null;
}

export function detectPrivateCelebrationRequest(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.privateEvent);
}

export function detectVenuePreference(input: string) {
  const normalized = normalizeAssistantText(input);

  if (includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.indoor)) {
    return 'indoor' as const;
  }

  if (includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.outdoor)) {
    return 'outdoor' as const;
  }

  return null;
}

export function detectAlcoholPreference(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.alcohol)
    ? 'dry'
    : null;
}

export function detectOwnershipQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.owner);
}

export function detectPaymentRemainingQuestion(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'how much is still left to pay',
    'how much is left to pay',
    'how much left to pay',
    'what is still left to pay',
    'remaining amount',
    'amount remaining',
    'balance',
    'outstanding',
    'owed',
    'due',
    'left to pay',
  ]);
}

export function detectReminderRequest(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.reminder);
}

export function detectUnsupportedRequest(input: string) {
  const normalized = normalizeAssistantText(input);

  if (includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.unsupported)) {
    return true;
  }

  return /\b(sex(?:ual)?|hookup|threesome|orgy|porn|nude|naked|escort|prostitution|drug(?:s)?|weed|marijuana|cocaine|gambling|weapon(?:s)?|violence|bomb|kill)\b/.test(
    normalized,
  ) ||
    /\b(call my|text my|email my|buy groceries|book my flight|plan my trip|doctor appointment|dentist appointment|homework|laundry|tax return|personal finance)\b/.test(
      normalized,
    );
}

export function detectChatSilence(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, [
    'not replying',
    'is not replying',
    "isn't replying",
    'did not reply',
    "didn't reply",
    'no response',
    'silent',
    'unanswered',
    'ghosting',
  ]);
}

export function detectClarificationSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.clarification);
}

export function detectFollowUpSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.followUp);
}

export function detectPendingAttentionSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  return includesAnyPhrase(normalized, ASSISTANT_SYNONYMS.pending);
}

export function detectMultilingualSignal(input: string) {
  const normalized = normalizeAssistantText(input);
  const sourceLanguage = detectSourceLanguage(normalized);

  return sourceLanguage !== 'English';
}

export function detectSourceLanguage(input: string) {
  const normalized = normalizeAssistantText(input);

  if (!normalized) {
    return 'English';
  }

  const hasLatinLetters = /[a-z]/i.test(normalized);
  const scriptHits = LANGUAGE_SCRIPT_PATTERNS.filter(({ regex }) =>
    regex.test(normalized),
  );

  if (scriptHits.length > 1) {
    return 'Mixed language';
  }

  if (scriptHits.length === 1) {
    return hasLatinLetters ? 'Mixed language' : scriptHits[0].label;
  }

  if (includesAnyPhrase(normalized, MULTILINGUAL_MARKERS)) {
    return 'Hinglish';
  }

  return 'English';
}
