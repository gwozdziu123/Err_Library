/* Rejestr danych – musi być wczytany przed plikami z data/ */
window.ErrLibREG = { catalog: null, sets: {}, waits: {} };
window.ErrLib = {
  setCatalog(c) { ErrLibREG.catalog = c; },
  addSet(s) { ErrLibREG.sets[s.id] = s; (ErrLibREG.waits[s.id] || []).forEach(f => f()); delete ErrLibREG.waits[s.id]; },
  addDevicelist(d) { this.addSet(d); }
};
