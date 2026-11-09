const documents = require('./knowledge.json');
function validDocuments() {
  if (!Array.isArray(documents)) return [];
  return documents.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.text === 'string' && item.text.length <= 12000 && Array.isArray(item.keywords) && item.keywords.every(word => typeof word === 'string' && word.length >= 2));
}
function searchKnowledge(input) {
  if (!input || typeof input.query !== 'string' || !input.query.trim() || input.query.length > 500 || Object.keys(input).some(key => !['query'].includes(key))) throw new Error('validation_error');
  const query = input.query.toLowerCase();
  const results = validDocuments().map(item => ({ item, score: item.keywords.filter(word => query.includes(word.toLowerCase())).length })).filter(match => match.score > 0).sort((left, right) => right.score - left.score).slice(0, 3).map(match => ({ chunk_id: match.item.id, title: match.item.title, excerpt: match.item.text.slice(0, 4000), source_url: /^https:\/\//.test(match.item.source_url || '') ? match.item.source_url : null, updated_at: match.item.updated_at || null }));
  return { ok: true, status: results.length ? 'found' : 'empty', results };
}
module.exports = { searchKnowledge, available: validDocuments().length > 0 };
