import { calculateProgress, getMilestone, getInsight } from '../goals';

describe('Savings Goals — calculateProgress', () => {
  it('returns 0 for zero target', () => {
    expect(calculateProgress(100000, 0)).toBe(0);
  });

  it('returns correct percentage for partial progress', () => {
    expect(calculateProgress(500000, 2000000)).toBe(25);
  });

  it('returns 50 for half progress', () => {
    expect(calculateProgress(1000000, 2000000)).toBe(50);
  });

  it('returns 100 when target is reached exactly', () => {
    expect(calculateProgress(2000000, 2000000)).toBe(100);
  });

  it('caps at 100 when balance exceeds target', () => {
    expect(calculateProgress(2350000, 2000000)).toBe(100);
  });

  it('returns 1 decimal place precision', () => {
    expect(calculateProgress(850000, 2000000)).toBe(42.5);
  });

  it('handles very small progress', () => {
    expect(calculateProgress(100, 1000000)).toBe(0);
  });
});

describe('Savings Goals — getMilestone', () => {
  it('returns null for 0%', () => {
    expect(getMilestone(0)).toBeNull();
  });

  it('returns null for 10%', () => {
    expect(getMilestone(10)).toBeNull();
  });

  it('returns Getting Started for 25%', () => {
    expect(getMilestone(25)).toEqual({ emoji: '🌱', label: 'Getting Started' });
  });

  it('returns Getting Started for 30%', () => {
    expect(getMilestone(30)).toEqual({ emoji: '🌱', label: 'Getting Started' });
  });

  it('returns Great Progress for 50%', () => {
    expect(getMilestone(50)).toEqual({ emoji: '🌿', label: 'Great Progress' });
  });

  it('returns Great Progress for 60%', () => {
    expect(getMilestone(60)).toEqual({ emoji: '🌿', label: 'Great Progress' });
  });

  it('returns Almost There for 75%', () => {
    expect(getMilestone(75)).toEqual({ emoji: '🌳', label: 'Almost There' });
  });

  it('returns Almost There for 80%', () => {
    expect(getMilestone(80)).toEqual({ emoji: '🌳', label: 'Almost There' });
  });

  it('returns Goal Achieved for 100%', () => {
    expect(getMilestone(100)).toEqual({ emoji: '🎉', label: 'Goal Achieved' });
  });
});

describe('Savings Goals — getInsight', () => {
  it('returns null when goal is achieved (100%)', () => {
    expect(getInsight(100, 2000000, 2000000, 50000)).toBeNull();
  });

  it('returns null when balance exceeds target', () => {
    expect(getInsight(100, 2350000, 2000000, 50000)).toBeNull();
  });

  it('returns "one more deposit" insight at 90%+', () => {
    const insight = getInsight(95, 1900000, 2000000, 50000);
    expect(insight).toBe('One more deposit completes this goal.');
  });

  it('returns monthly target deposit insight', () => {
    const insight = getInsight(42.5, 850000, 2000000, 50000);
    expect(insight).toContain('Deposit ₦50,000 this month to stay on track.');
  });

  it('returns null when no monthly target set', () => {
    expect(getInsight(42.5, 850000, 2000000, null)).toBeNull();
  });
});
