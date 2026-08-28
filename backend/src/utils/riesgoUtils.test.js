const { scoreNota, scoreAsistencia, scorePendientes, nivelDeScore } = require('./riesgoUtils');

describe('scoreNota', () => {
  test('nota muy baja da el score máximo', () => {
    expect(scoreNota(1.0)).toBe(100);
  });
  test('nota aprobatoria (>= 3.5) da score 0', () => {
    expect(scoreNota(3.5)).toBe(0);
    expect(scoreNota(5.0)).toBe(0);
  });
  test('umbrales intermedios', () => {
    expect(scoreNota(1.8)).toBe(85);
    expect(scoreNota(2.3)).toBe(70);
    expect(scoreNota(3.0)).toBe(50);
  });
});

describe('scoreAsistencia', () => {
  test('sin registros de asistencia da score 0', () => {
    expect(scoreAsistencia(0, 0)).toBe(0);
  });
  test('inasistencia alta (> 40%) da el score máximo', () => {
    expect(scoreAsistencia(5, 10)).toBe(100);
  });
  test('inasistencia baja (<= 5%) da score 0', () => {
    expect(scoreAsistencia(0, 20)).toBe(0);
  });
  test('umbral 25%-40% da 75', () => {
    expect(scoreAsistencia(3, 10)).toBe(75);
  });
});

describe('scorePendientes', () => {
  test('sin actividades asignadas da score 0', () => {
    expect(scorePendientes(0, 0)).toBe(0);
  });
  test('más del 60% pendiente da el score máximo', () => {
    expect(scorePendientes(7, 10)).toBe(100);
  });
  test('todo entregado da score 0', () => {
    expect(scorePendientes(0, 10)).toBe(0);
  });
});

describe('nivelDeScore', () => {
  test('clasifica los 4 niveles por los umbrales correctos', () => {
    expect(nivelDeScore(0)).toBe('bajo');
    expect(nivelDeScore(30)).toBe('bajo');
    expect(nivelDeScore(31)).toBe('medio');
    expect(nivelDeScore(60)).toBe('medio');
    expect(nivelDeScore(61)).toBe('alto');
    expect(nivelDeScore(80)).toBe('alto');
    expect(nivelDeScore(81)).toBe('critico');
    expect(nivelDeScore(100)).toBe('critico');
  });
});
