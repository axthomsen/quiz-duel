// Categories and question bank. Each category's questions live in questions/<id>.js as
// [question, correctAnswer, wrong1, wrong2, wrong3, explanation].
// A question's id is "<category>-<index>", and games store those ids, so only ever
// APPEND new questions to the end of a file (reordering or deleting would change
// which question an existing game points at).

import geo from './questions/geo.js';
import hist from './questions/hist.js';
import sci from './questions/sci.js';
import nature from './questions/nature.js';
import sport from './questions/sport.js';
import film from './questions/film.js';
import music from './questions/music.js';
import food from './questions/food.js';
import arts from './questions/arts.js';
import tech from './questions/tech.js';
import space from './questions/space.js';
import body from './questions/body.js';
import myth from './questions/myth.js';
import words from './questions/words.js';
import games from './questions/games.js';
import math from './questions/math.js';
import landmarks from './questions/landmarks.js';
import capitals from './questions/capitals.js';
import heroes from './questions/heroes.js';
import earth from './questions/earth.js';
import invent from './questions/invent.js';

export const CATEGORIES = [
  { id: 'geo', name: 'Geography', icon: '🌍', color: '#1fa971' },
  { id: 'hist', name: 'History', icon: '🏛️', color: '#c27c2c' },
  { id: 'sci', name: 'Science', icon: '🔬', color: '#2f7ff0' },
  { id: 'nature', name: 'Animals & Nature', icon: '🦁', color: '#6aa827' },
  { id: 'sport', name: 'Sports', icon: '⚽', color: '#e5483b' },
  { id: 'film', name: 'Movies & TV', icon: '🎬', color: '#9b51e0' },
  { id: 'music', name: 'Music', icon: '🎵', color: '#e0459b' },
  { id: 'food', name: 'Food & Drink', icon: '🍕', color: '#f2994a' },
  { id: 'arts', name: 'Art & Literature', icon: '🎨', color: '#d4a017' },
  { id: 'tech', name: 'Technology', icon: '💻', color: '#17a2b8' },
  { id: 'space', name: 'Space', icon: '🚀', color: '#5b6bec' },
  { id: 'body', name: 'Human Body', icon: '🫀', color: '#e8566c' },
  { id: 'myth', name: 'Mythology', icon: '🔱', color: '#7b2cbf' },
  { id: 'words', name: 'Words & Language', icon: '🔤', color: '#2a9d8f' },
  { id: 'games', name: 'Video Games', icon: '🎮', color: '#f72585' },
  { id: 'math', name: 'Math & Numbers', icon: '🔢', color: '#4361ee' },
  { id: 'landmarks', name: 'Landmarks', icon: '🗼', color: '#bc6c25' },
  { id: 'capitals', name: 'Capitals & Flags', icon: '🏳️', color: '#d62828' },
  { id: 'heroes', name: 'Comics & Superheroes', icon: '🦸', color: '#ff006e' },
  { id: 'earth', name: 'Planet Earth', icon: '🌋', color: '#588157' },
  { id: 'invent', name: 'Inventions', icon: '💡', color: '#c9a227' },
];

export const QUESTIONS = {
  geo, hist, sci, nature, sport, film, music, food, arts, tech, space, body,
  myth, words, games, math, landmarks, capitals, heroes, earth, invent,
};
