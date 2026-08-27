const WEIGHTS = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const MAX_INTERVAL = 36500;

export const FSRS = {
  clampD: (difficulty: number) => Math.min(10, Math.max(1, difficulty)),
  initStability: (grade: number) => Math.max(0.1, WEIGHTS[grade - 1]),
  initDifficulty(grade: number) {
    return FSRS.clampD(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (grade - 1)) + 1);
  },
  linearDamping: (delta: number, difficulty: number) => (delta * (10 - difficulty)) / 9,
  meanReversion: (initial: number, current: number) => WEIGHTS[7] * initial + (1 - WEIGHTS[7]) * current,
  nextDifficulty(difficulty: number, grade: number) {
    const delta = -WEIGHTS[6] * (grade - 3);
    const next = difficulty + FSRS.linearDamping(delta, difficulty);
    return FSRS.clampD(FSRS.meanReversion(FSRS.initDifficulty(4), next));
  },
  retrievability(elapsedDays: number, stability: number) {
    return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
  },
  nextRecallStability(difficulty: number, stability: number, retrievability: number, grade: number) {
    const hardPenalty = grade === 2 ? WEIGHTS[15] : 1;
    const easyBonus = grade === 4 ? WEIGHTS[16] : 1;
    return stability * (1 + Math.exp(WEIGHTS[8]) * (11 - difficulty) * Math.pow(stability, -WEIGHTS[9]) * (Math.exp((1 - retrievability) * WEIGHTS[10]) - 1) * hardPenalty * easyBonus);
  },
  nextForgetStability(difficulty: number, stability: number, retrievability: number) {
    return WEIGHTS[11] * Math.pow(difficulty, -WEIGHTS[12]) * (Math.pow(stability + 1, WEIGHTS[13]) - 1) * Math.exp((1 - retrievability) * WEIGHTS[14]);
  },
  nextInterval(stability: number, retention: number) {
    const interval = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
    return Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval)));
  },
};
