function scoreNota(promedio) {
  if (promedio < 1.5) return 100;
  if (promedio < 2.0) return 85;
  if (promedio < 2.5) return 70;
  if (promedio < 3.5) return 50;
  return 0;
}

function scoreAsistencia(ausencias, total) {
  if (!total) return 0;
  const pct = ausencias / total;
  if (pct > 0.40) return 100;
  if (pct > 0.25) return 75;
  if (pct > 0.15) return 50;
  if (pct > 0.05) return 25;
  return 0;
}

function scorePendientes(pendientes, total) {
  if (!total) return 0;
  const pct = pendientes / total;
  if (pct > 0.60) return 100;
  if (pct > 0.40) return 75;
  if (pct > 0.20) return 50;
  if (pct > 0.10) return 25;
  return 0;
}

function nivelDeScore(score) {
  if (score >= 81) return 'critico';
  if (score >= 61) return 'alto';
  if (score >= 31) return 'medio';
  return 'bajo';
}

module.exports = { scoreNota, scoreAsistencia, scorePendientes, nivelDeScore };
