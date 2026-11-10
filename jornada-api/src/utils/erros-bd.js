// Reconhece violação de UNIQUE nos dois bancos:
//   PostgreSQL: code '23505'
//   SQLite (better-sqlite3): code 'SQLITE_CONSTRAINT_UNIQUE' (ou ..._PRIMARYKEY)
function ehViolacaoUnica(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return /unique|primary key/i.test(err.message || '');
  }
  return false;
}

module.exports = { ehViolacaoUnica };
